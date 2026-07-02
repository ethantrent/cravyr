import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../server';

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
  });
});

describe('GET /version', () => {
  it('returns 200 with a commit field', async () => {
    const res = await request(app).get('/version');
    expect(res.status).toBe(200);
    expect(res.body.commit).toBeDefined();
  });
});

describe('GET /privacy', () => {
  it('returns 200 with HTML content', async () => {
    const res = await request(app).get('/privacy');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
  });
});

describe('GET /auth/callback', () => {
  it('returns 200 with HTML content', async () => {
    const res = await request(app).get('/auth/callback');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
  });
});
