---
phase: 02-api-database-layer
plan: 02
subsystem: api
tags: [geo-cache, geohash, node-cache, google-places, supabase, express, budget-counter, stale-while-refresh]

# Dependency graph
requires:
  - phase: 02-api-database-layer/02-01
    provides: Google Places API client (searchNearby, getPlaceDetails, resolvePhotoUrl, mapPlaceToRestaurant, mapPlaceDetailToUpdate), geo_cache table, api_budget table, upsert_restaurant RPC, ngeohash dependency
provides:
  - Geohash cache orchestration service (geo-cache.ts) with two-layer caching and daily budget
  - getRestaurantsForLocation: node-cache hot layer (1hr) backed by Supabase geo_cache (24hr) with Google Places fallback
  - Stale-while-refresh pattern: stale cells serve data while background refresh runs
  - isBudgetExhausted and incrementBudgetCount: daily 500-request cap persisted to api_budget table
  - GET /restaurants/nearby: geohash-cached cluster fetch with source tracking and budget awareness
  - GET /restaurants/:id: restaurant detail with lazy Enterprise field fetch on first tap (D-10)
  - GET /restaurants/:id/photos: resolves stored photo resource names to fresh Google Photo URLs (D-07)
affects: [02-03, 04-swipe-core-secondary-screens, restaurants-consumer, mobile-discover-screen]

# Tech tracking
tech-stack:
  added: []
  patterns: [two-layer-cache, stale-while-refresh, lazy-enterprise-fetch, budget-counter-pattern, uuid-validation-regex]

key-files:
  created:
    - apps/api/src/services/geo-cache.ts
  modified:
    - apps/api/src/routes/restaurants.ts

key-decisions:
  - "Supabase PromiseLike vs Promise: Supabase FilterBuilder returns PromiseLike not Promise -- fixed fire-and-forget calls by wrapping with Promise.resolve() to access .catch()"
  - "Express 5 req.params typed as string | string[]: cast with `as string` since Express route params are always single strings for named params"
  - "Daily budget counter persists to api_budget via upsert (fire-and-forget) on every increment -- survives Render cold starts per Pitfall 7"

patterns-established:
  - "Two-layer cache: node-cache hot layer checked first (memory hit), Supabase cold layer second (database hit), Google API only on full miss"
  - "Stale-while-refresh: return existing data immediately, call refreshCellInBackground() without await, mark is_refreshing in geo_cache"
  - "Lazy Enterprise fetch: check rating === null before calling getPlaceDetails -- once fetched, cached in DB and node-cache, no repeat calls"
  - "UUID validation: regex test before any DB query on /:id routes to prevent malformed ID injection"
  - "Fire-and-forget with Promise.resolve(): wrap Supabase PromiseLike in Promise.resolve() to attach .catch() for safe background operations"

requirements-completed: [API-01]

# Metrics
duration: 40min
completed: 2026-04-12
---

# Phase 02 Plan 02: Geo-Cache Orchestration + Restaurants Route Summary

**Two-layer geohash cache (node-cache hot + Supabase cold) with stale-while-refresh, 500 req/day budget cap, and three REST endpoints (nearby/detail/photos) implementing the $200/month vs $30K/month cost architecture**

## Performance

- **Duration:** ~40 min (split across two sessions)
- **Started:** 2026-04-12T02:48:29Z
- **Completed:** 2026-04-12T14:30:52Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Built geo-cache.ts with full three-layer cache: node-cache (1hr hot), Supabase geo_cache (24hr cold), Google Places Nearby Search (miss source)
- Implemented stale-while-refresh so users always get a fast response while background refresh updates stale cells
- Daily budget counter persists to api_budget table on every increment -- survives Render cold starts by reading from Supabase on startup
- Rewrote restaurants.ts with three public endpoints in correct route order: /nearby, /:id/photos, /:id
- Lazy Enterprise field fetch on /:id: calls getPlaceDetails only when rating is null, caches result in DB and node-cache
- Photo endpoint resolves stored resource names to fresh Google Photo URLs via Promise.allSettled (graceful degradation on expired names)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create geo-cache orchestration service** - `ecfba98` (feat)
2. **Task 2: Rewrite restaurants route with nearby, detail, and photo endpoints** - `40f86c4` (feat)

## Files Created/Modified
- `apps/api/src/services/geo-cache.ts` - Geohash cache orchestration: getRestaurantsForLocation, isBudgetExhausted, incrementBudgetCount, fetchAndCacheCell, refreshCellInBackground (289 lines)
- `apps/api/src/routes/restaurants.ts` - Three REST endpoints with input validation, lazy Enterprise fetch, NodeCache detail cache (213 lines)

## Decisions Made
- Wrapped Supabase PromiseLike returns in `Promise.resolve()` for fire-and-forget `.catch()` chains -- Supabase FilterBuilder implements PromiseLike not Promise, so direct `.catch()` calls fail TypeScript strict checks
- Cast `req.params.id as string` in Express 5 -- @types/express v5 types params as `string | string[]` but named route params are always `string` at runtime
- Budget counter upsert is fire-and-forget (not awaited) -- allows incrementBudgetCount to return synchronously while Supabase write happens in background; cold-start safety provided by reading from DB at startup

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Supabase PromiseLike incompatibility with .catch() chaining**
- **Found during:** Task 1 (geo-cache.ts creation)
- **Issue:** Three fire-and-forget Supabase calls (api_budget upsert, geo_cache is_refreshing mark, geo_cache is_refreshing clear) used `.catch()` directly, but Supabase PostgrestFilterBuilder returns `PromiseLike<void>` not `Promise<void>` -- TypeScript strict mode TS2339 errors
- **Fix:** Wrapped each with `Promise.resolve(supabase...)` to convert PromiseLike to a real Promise with `.catch()` support; used `async` in `.then()` callbacks to `await` Supabase calls in background refresh
- **Files modified:** apps/api/src/services/geo-cache.ts
- **Verification:** `tsc --noEmit` passes with zero errors
- **Committed in:** ecfba98 (Task 1 commit, fix applied inline before commit)

**2. [Rule 1 - Bug] Fixed Express 5 req.params type incompatibility**
- **Found during:** Task 2 (restaurants.ts rewrite)
- **Issue:** `UUID_REGEX.test(req.params.id)` failed TypeScript strict check -- @types/express@5 types `req.params[key]` as `string | string[]`, but `RegExp.test()` only accepts `string`
- **Fix:** Changed `const { id } = req.params` to `const id = req.params.id as string` in both /:id and /:id/photos handlers
- **Files modified:** apps/api/src/routes/restaurants.ts
- **Verification:** `tsc --noEmit` passes with zero errors
- **Committed in:** 40f86c4 (Task 2 commit, fix applied inline before commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes were TypeScript strict mode incompatibilities in the planned implementation. Logic and behavior unchanged from plan. No scope creep.

## Issues Encountered
- Session interrupted at Task 2 TypeScript fix stage; resumed from the uncommitted `restaurants.ts` with inline type assertion fixes already applied

## User Setup Required

None - no external service configuration required. `GOOGLE_PLACES_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` already documented in dev environment setup from Phase 01.

## Next Phase Readiness
- Geo-cache service ready for any consumer (recommendations route, future personalization endpoints)
- All three restaurant endpoints operational; mobile discover screen can call GET /restaurants/nearby with lat/lng
- Photo resolution endpoint ready for detail view photo gallery
- Daily budget cap active; 500 requests/day prevents cost overruns before launch
- Enterprise lazy fetch means only restaurants users tap get rated/hours data -- cost stays minimal at MVP scale

## Self-Check: PASSED

- `apps/api/src/services/geo-cache.ts` exists (289 lines, >80 min)
- `apps/api/src/routes/restaurants.ts` exists (213 lines, >80 min)
- Commit ecfba98 in git log: confirmed
- Commit 40f86c4 in git log: confirmed
- `pnpm --filter cravyr-api exec tsc --noEmit` exits 0: confirmed

---
*Phase: 02-api-database-layer*
*Completed: 2026-04-12*
