import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const FRIEND_ID = '22222222-2222-2222-2222-222222222222';
const VALID_TOKEN = 'test-valid-token';

// Per-table results the tests configure before each request. Every query-builder
// chain on a table resolves to the entry for that table (or empty data).
const mock = vi.hoisted(() => {
  const tableResults: Record<string, { data: unknown; error: unknown }> = {};
  let rpcResult: { data: unknown; error: unknown } = { data: [], error: null };
  const rpcCalls: Array<{ fn: string; params: Record<string, unknown> }> = [];

  function makeBuilder(table: string) {
    const builder: Record<string, unknown> = {};
    for (const m of ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'or', 'gt', 'lt', 'single', 'limit', 'order']) {
      builder[m] = vi.fn(() => builder);
    }
    // PostgREST builders are thenables — awaiting resolves the configured result
    builder.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve(tableResults[table] ?? { data: [], error: null }).then(resolve, reject);
    return builder;
  }

  const client = {
    auth: {
      getUser: vi.fn(async (token: string) =>
        token === 'test-valid-token'
          ? { data: { user: { id: '11111111-1111-1111-1111-111111111111' } }, error: null }
          : { data: { user: null }, error: { message: 'invalid token' } }
      ),
      admin: {
        listUsers: vi.fn(async () => ({
          data: {
            users: [
              {
                id: '22222222-2222-2222-2222-222222222222',
                email: 'friend@example.com',
                user_metadata: { full_name: 'Friend Name' },
              },
            ],
          },
          error: null,
        })),
      },
    },
    from: vi.fn((table: string) => makeBuilder(table)),
    rpc: vi.fn(async (fn: string, params: Record<string, unknown>) => {
      rpcCalls.push({ fn, params });
      return rpcResult;
    }),
  };

  return {
    client,
    tableResults,
    rpcCalls,
    setRpcResult(r: { data: unknown; error: unknown }) {
      rpcResult = r;
    },
    reset() {
      for (const k of Object.keys(tableResults)) delete tableResults[k];
      rpcResult = { data: [], error: null };
      rpcCalls.length = 0;
    },
  };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mock.client),
}));

import app from '../server';

const authed = (method: 'get' | 'post' | 'delete', path: string) =>
  (request(app) as any)[method](path).set('Authorization', `Bearer ${VALID_TOKEN}`);

beforeEach(() => {
  mock.reset();
});

describe('GET /api/v1/connections', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/v1/connections');
    expect(res.status).toBe(401);
  });

  it('returns [] for a user with no connections (authenticated — regression guard for res.locals.user 500)', async () => {
    mock.tableResults['connections'] = { data: [], error: null };
    const res = await authed('get', '/api/v1/connections');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns friends with display names resolved from auth users', async () => {
    mock.tableResults['connections'] = {
      data: [{ user1_id: TEST_USER_ID, user2_id: FRIEND_ID }],
      error: null,
    };
    const res = await authed('get', '/api/v1/connections');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: FRIEND_ID, name: 'Friend Name' }]);
  });
});

describe('POST /api/v1/connections/code', () => {
  it('returns a 6-digit code with an expiry', async () => {
    mock.tableResults['connection_codes'] = { data: null, error: null };
    const res = await authed('post', '/api/v1/connections/code');
    expect(res.status).toBe(200);
    expect(res.body.code).toMatch(/^\d{6}$/);
    expect(new Date(res.body.expires_at).getTime()).toBeGreaterThan(Date.now());
  });

  it('returns 409 on code collision', async () => {
    mock.tableResults['connection_codes'] = { data: null, error: { code: '23505', message: 'dup' } };
    const res = await authed('post', '/api/v1/connections/code');
    expect(res.status).toBe(409);
  });
});

describe('POST /api/v1/connections/link', () => {
  it('rejects a malformed body (code not 6 chars)', async () => {
    const res = await authed('post', '/api/v1/connections/link').send({ code: '123' });
    expect(res.status).toBe(400);
  });

  it('returns 404 for an invalid or expired code', async () => {
    mock.tableResults['connection_codes'] = { data: null, error: { message: 'no rows' } };
    const res = await authed('post', '/api/v1/connections/link').send({ code: '123456' });
    expect(res.status).toBe(404);
  });

  it('returns 400 when linking to your own code', async () => {
    mock.tableResults['connection_codes'] = { data: { user_id: TEST_USER_ID }, error: null };
    const res = await authed('post', '/api/v1/connections/link').send({ code: '123456' });
    expect(res.status).toBe(400);
  });

  it('creates the connection on a valid code', async () => {
    mock.tableResults['connection_codes'] = { data: { user_id: FRIEND_ID }, error: null };
    mock.tableResults['connections'] = { data: {}, error: null };
    const res = await authed('post', '/api/v1/connections/link').send({ code: '123456' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, friendId: FRIEND_ID });
  });

  it('returns 409 when already connected', async () => {
    mock.tableResults['connection_codes'] = { data: { user_id: FRIEND_ID }, error: null };
    mock.tableResults['connections'] = { data: null, error: { code: '23505', message: 'dup' } };
    const res = await authed('post', '/api/v1/connections/link').send({ code: '123456' });
    expect(res.status).toBe(409);
  });
});

describe('DELETE /api/v1/connections/:friendId', () => {
  it('removes the connection', async () => {
    mock.tableResults['connections'] = { data: null, error: null };
    const res = await authed('delete', `/api/v1/connections/${FRIEND_ID}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
  });
});

describe('GET /api/v1/matches', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).get(`/api/v1/matches?friendIds=${FRIEND_ID}`);
    expect(res.status).toBe(401);
  });

  it('returns [] when no friendIds param is given', async () => {
    const res = await authed('get', '/api/v1/matches');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('calls get_group_matches with the JWT user id, never a client-supplied one', async () => {
    mock.setRpcResult({ data: [{ id: 'r1', name: 'Testaurant' }], error: null });
    const res = await authed('get', `/api/v1/matches?friendIds=${FRIEND_ID}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 'r1', name: 'Testaurant' }]);
    expect(mock.rpcCalls).toEqual([
      { fn: 'get_group_matches', params: { p_user_id: TEST_USER_ID, p_friend_ids: [FRIEND_ID] } },
    ]);
  });

  it('returns 500 (not a crash) when the RPC errors', async () => {
    mock.setRpcResult({ data: null, error: { message: 'rpc failed' } });
    const res = await authed('get', `/api/v1/matches?friendIds=${FRIEND_ID}`);
    expect(res.status).toBe(500);
  });
});
