# Testing Patterns

**Analysis Date:** 2026-07-02

## Test Framework

**Runner:**
- Vitest (configured in `apps/api/vitest.config.ts`)
- No test framework configured in `apps/mobile` — mobile app has no tests

**Assertion Library:**
- Vitest built-in (`expect`) — no separate assertion library

**HTTP Testing:**
- `supertest` used for integration-style route testing against the live Express app

**Run Commands:**
```bash
# From apps/api/
pnpm test           # Run all tests once (vitest run)
pnpm typecheck      # TypeScript check only (tsc --noEmit)

# From repo root (if turbo pipeline is configured)
pnpm turbo test
```

## Test File Organization

**Location:**
- All API tests are co-located in `apps/api/src/__tests__/`
- Named `<subject>.test.ts` — `health.test.ts`, `auth-guard.test.ts`, `validation.test.ts`
- Setup file: `apps/api/src/__tests__/setup.ts`

**Vitest config scope:**
- `include: ['src/**/*.test.ts']` — catches tests placed outside `__tests__/` if needed
- `setupFiles: ['src/__tests__/setup.ts']` — runs before every test file

**Structure:**
```
apps/api/src/
└── __tests__/
    ├── setup.ts              # Env var stubs for all tests
    ├── health.test.ts        # HTTP smoke tests for public endpoints
    ├── auth-guard.test.ts    # Auth middleware enforcement across routes
    └── validation.test.ts    # Zod schema unit tests
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../server';

describe('Feature or endpoint', () => {
  it('describes the expected behavior', async () => {
    const res = await request(app).get('/path');
    expect(res.status).toBe(200);
  });
});
```

**Patterns:**
- `describe` blocks group by endpoint, schema, or feature boundary
- `it` descriptions are plain English behavior statements (not "should X")
- No `beforeEach`/`afterEach` — each test is self-contained
- Parameterized tests use `for...of` loops over a route array (see `auth-guard.test.ts`)

## Mocking

**Framework:** No mocking library — tests run against the real Express app with stubbed environment variables

**Environment Stub Pattern (in `setup.ts`):**
```typescript
process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.GOOGLE_PLACES_API_KEY = 'test-google-key';
process.env.PORT = '0';
```

**What is mocked:**
- Environment variables only — all external service calls use fake credentials that will be rejected by real endpoints (Supabase, Google Places)

**What is NOT mocked:**
- Supabase client — auth guard tests rely on the real `supabase.auth.getUser()` rejecting the fake token, producing a real 401
- Express middleware chain — tests exercise the full middleware stack

**Implication:** Tests that require real DB reads/writes are not present. The test suite is limited to:
1. Public endpoint smoke tests (no auth or DB needed)
2. Auth enforcement (Supabase rejects fake tokens → 401)
3. Zod schema unit tests (pure in-process, no I/O)

## Fixtures and Factories

**Test Data:**
- Hard-coded inline literals used directly in test cases — no factory functions or shared fixtures
- UUID fixtures: `'550e8400-e29b-41d4-a716-446655440000'` used as a canonical valid UUID across schema tests

**Location:**
- No separate fixtures directory — test data is inline in each `.test.ts` file

## Coverage

**Requirements:** Not enforced — no coverage threshold configured in `vitest.config.ts`

**View Coverage:**
```bash
# From apps/api/
pnpm vitest run --coverage
```

## Test Types

**Unit Tests:**
- Zod schema validation in `validation.test.ts` — pure input/output, no I/O
- Each schema tested for: valid input, each invalid case, coercion behavior, default values

**Integration Tests:**
- HTTP route tests using `supertest` against the mounted Express app
- Tests in `health.test.ts` and `auth-guard.test.ts` are integration-level (real middleware stack, real Supabase client behavior)

**E2E Tests:**
- Not present — no Detox, Maestro, or Playwright configuration

**Mobile Tests:**
- Not present — `apps/mobile` has no test configuration or test files

## Common Patterns

**Schema validation testing (positive + negative):**
```typescript
it('accepts valid swipe', () => {
  const result = SwipeBodySchema.safeParse({
    restaurant_id: '550e8400-e29b-41d4-a716-446655440000',
    direction: 'right',
  });
  expect(result.success).toBe(true);
});

it('rejects invalid direction', () => {
  const result = SwipeBodySchema.safeParse({
    restaurant_id: '550e8400-e29b-41d4-a716-446655440000',
    direction: 'up',
  });
  expect(result.success).toBe(false);
});
```

**Coercion testing (verify parsed type, not just success):**
```typescript
it('coerces string coords to numbers', () => {
  const result = LatLngQuerySchema.safeParse({ lat: '37.7749', lng: '-122.4194' });
  expect(result.success).toBe(true);
  if (result.success) {
    expect(result.data.lat).toBe(37.7749);
  }
});
```

**Auth enforcement via parameterized loop:**
```typescript
const protectedRoutes = [
  { method: 'get', path: '/api/v1/recommendations?lat=37&lng=-122' },
  { method: 'post', path: '/api/v1/swipes' },
  // ...
];

for (const route of protectedRoutes) {
  it(`${route.method.toUpperCase()} ${route.path} returns 401 without auth`, async () => {
    const agent = request(app) as any;
    const res = await agent[route.method](route.path);
    expect(res.status).toBe(401);
  });
}
```

**HTTP smoke test:**
```typescript
it('returns 200 with status ok', async () => {
  const res = await request(app).get('/health');
  expect(res.status).toBe(200);
  expect(res.body.status).toBe('ok');
  expect(res.body.timestamp).toBeDefined();
});
```

## Coverage Gaps

**No mobile tests** — `apps/mobile` has zero test infrastructure. Zustand stores, API lib, and components are untested.

**No database tests** — All routes that touch Supabase DB (swipes, recommendations, saves, connections) are untested because the test environment uses fake credentials with no DB seeding.

**No service-layer tests** — `apps/api/src/services/places.ts`, `geo-cache.ts`, `cron.ts`, and `push.ts` have no tests.

---

*Testing analysis: 2026-07-02*
