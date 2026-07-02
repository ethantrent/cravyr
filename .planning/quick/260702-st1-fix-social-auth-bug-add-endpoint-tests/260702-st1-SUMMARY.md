---
phase: 260702-st1
plan: 01
subsystem: api/routes, api/tests
tags: [bugfix, social-features, integration-tests, vitest]
status: complete
commit: 66b7326
requires:
  - apps/api/src/middleware/auth.ts (requireAuth sets req.user — the contract the bug violated)
provides:
  - Working authenticated social endpoints (connections CRUD, matches RPC proxy)
  - 14-test authenticated integration suite with mocked @supabase/supabase-js
affects:
  - Friends/connections feature viability in production (was 100% broken)
key-files:
  created:
    - apps/api/src/__tests__/social-endpoints.test.ts
  modified:
    - apps/api/src/routes/connections.ts
    - apps/api/src/routes/matches.ts
decisions:
  - "Mirrored the users.ts inline `Request & { user?: { id: string } }` + 401-guard pattern instead of introducing a global Express type augmentation — consistency over cleverness in a pre-launch codebase"
  - "Mocked the Supabase client at module level with vi.hoisted per-table result state — thenable query builders resolve configured results, so route logic runs unmodified"
verification:
  - "pnpm turbo test typecheck → 6 tasks successful; 39 API tests pass (was 24)"
  - "Bug 1 regression-guarded by every authenticated test (any res.locals read would 500)"
  - "Bug 2 regression-guarded by /^\\d{6}$/ assertion on generated codes"
---

# Summary: Fix social-route auth bug + 6-digit codes, add integration tests

Two production-breaking bugs found and fixed in the June social features:

1. **res.locals.user → req.user**: all five social handlers read
   `res.locals.user.id`, which is never set (requireAuth sets `req.user`).
   Every authenticated request 500'd. Fixed with the codebase-standard guard.
2. **3-digit invite codes**: `randomBytes(3)` mapped one digit per byte, but the
   link schema and the mobile input both require exactly 6 digits — generated
   codes were unredeemable. Now `randomBytes(6)`.

Neither was caught earlier because the pre-existing suite only asserted 401s on
these routes, and Render deploys had been silently failing since June 28 (fixed
earlier today, commit 652b7ff), so no live traffic ever hit the handlers.

New `social-endpoints.test.ts` (14 tests): authenticated happy paths for all five
handlers, 401 without token, 400 malformed body, 404 invalid/expired code,
400 self-link, 409 duplicate connection, 409 code collision, RPC error → 500,
and an assertion that `get_group_matches` receives the JWT-derived user id.
