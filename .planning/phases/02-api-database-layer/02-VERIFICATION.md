---
phase: 02-api-database-layer
verified: 2026-04-12T15:03:39Z
status: human_needed
score: 6/8
overrides_applied: 0
human_verification:
  - test: "Cache hit confirmed via server logs on second GET /restaurants/nearby request with same coordinates"
    expected: "Second identical request returns source:'memory' in the meta field and does NOT trigger a new outbound Places API call (visible in server logs)"
    why_human: "Requires a running server with a live GOOGLE_PLACES_API_KEY and log inspection — cannot be verified by static analysis or TypeScript compilation alone"
  - test: "Billing alert configured at $50/day in Google Cloud Console"
    expected: "A test notification fires from Google Cloud Billing Budgets & Alerts confirming the alert is active and wired to the correct billing account and project"
    why_human: "External Google Cloud configuration that cannot be verified from the codebase — explicitly noted as Task 2 pending user action in 02-03-SUMMARY.md"
---

# Phase 2: API + Database Layer — Verification Report

**Phase Goal:** The Express API correctly proxies Google Places with field masks enforced, geographic cluster caching active, and the PostGIS recommendation function returning scored results — so the financial risk of a $30K/month Places billing trap is eliminated before any UI is written.
**Verified:** 2026-04-12T15:03:39Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Field masks enforced (FIELD_MASK_NEARBY uses Pro tier, FIELD_MASK_DETAIL uses Enterprise tier) | VERIFIED | `FIELD_MASK_NEARBY` = `places.id,places.displayName,places.photos,places.location,places.formattedAddress,places.primaryType,places.priceLevel`; `FIELD_MASK_DETAIL` adds `rating,userRatingCount,regularOpeningHours,nationalPhoneNumber,websiteUri`. Both are set as `X-Goog-FieldMask` headers in `searchNearby` (lines 77) and `getPlaceDetails` (line 112). No inline field strings — structural enforcement via named constants. |
| 2 | Geohash-keyed two-layer cache (node-cache hot + Supabase cold) with stale-while-refresh | VERIFIED | `geo-cache.ts` implements three distinct code paths: (1) `geoCache.get(hash)` → memory hit; (2) Supabase geo_cache query + `isStale()` check → cold hit; (3) full miss → `fetchAndCacheCell()`. Stale path calls `refreshCellInBackground()` without await and returns `source:'stale'`. `is_refreshing` flag toggled in geo_cache table during background refresh. |
| 3 | Daily budget counter at 500 req/day cap persisted across cold starts | VERIFIED | `isBudgetExhausted()` checks `budgetCache` first, falls back to `api_budget` Supabase table on cold start. `incrementBudgetCount()` updates `budgetCache` in memory and fire-and-forgets a Supabase upsert. Cap of 500 enforced at lines 79 and 187. |
| 4 | GET /nearby validates lat/lng ranges and returns { restaurants, meta } | VERIFIED | Range validation at lines 67–80 (isNaN check + -90/90/-180/180 bounds). Response shape `{ restaurants, meta: { source, cache_only, cache_refreshing, count } }` at lines 85–93. Router mounted at `/api/v1/restaurants` in `server.ts` line 45. |
| 5 | GET /:id performs lazy Enterprise field fetch when rating is null | VERIFIED | Lines 191–209: `if (data.rating === null && data.external_id)` → calls `getPlaceDetails(data.external_id)`, applies `mapPlaceDetailToUpdate()`, writes update to DB via `supabaseAdmin`, merges into response. Error is caught and logged non-fatally. Result cached in `detailCache` (2hr TTL). |
| 6 | GET /:id/photos resolves photo resource names to fresh Google URLs | VERIFIED | Lines 143–155: `Promise.allSettled()` maps all `photo_urls` resource names through `resolvePhotoUrl()`. Returns only fulfilled non-null results — graceful degradation on expired names. `skipHttpRedirect=true` ensures JSON response with `photoUri` field. |
| 7 | Route ordering prevents path collisions (/nearby before /:id/photos before /:id) | VERIFIED | Registration order confirmed: line 63 (`/nearby`), line 100 (`/:id/photos`), line 163 (`/:id`). The comment at line 7 explicitly documents why order matters. |
| 8 | upsert_restaurant RPC uses ST_MakePoint with correct extensions search_path | VERIFIED | Migration line 66: `ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::extensions.geography`. Line 56: `SET search_path TO 'public', 'extensions'`. The `extensions` schema inclusion was added in commit `c2c5c85` (a post-plan fix that corrected a bug where PostGIS functions were unreachable). |

**Score:** 6/8 truths verified programmatically. 2 require human verification (SC-1 cache behavior via logs, SC-5 billing alert).

---

### ROADMAP Success Criteria Mapping

| SC | Criterion | Status | Notes |
|----|-----------|--------|-------|
| SC-1 | GET /nearby returns cached results on second call (no new Places API request) | NEEDS HUMAN | Cache path exists in code; live log confirmation requires running server |
| SC-2 | Every outbound Places API request includes X-Goog-FieldMask header | VERIFIED | Header set unconditionally in `searchNearby` and `getPlaceDetails` — no code path exists to call Places without the mask |
| SC-3 | GET /:id returns photo_reference strings (not expiring URLs), stored in place_id-keyed rows | VERIFIED | `photo_urls` column stores resource names (e.g. `places/ChIJ.../photos/AXCi3Q...`) not expiring URLs; rows keyed by `external_id` (Google `place_id`). Matches intent of SC. |
| SC-4 | PostGIS `get_restaurant_recommendations` executes without error and returns scored results excluding recently swiped restaurants | VERIFIED | Function in `20260411000000_remote_schema.sql` uses `ST_DWithin`, 4-factor weighted scoring (distance 40%, cuisine 25%, rating 20%, price 15%), and excludes swipes within 7 days (`s.swiped_at > NOW() - INTERVAL '7 days'`). Called via `supabase.rpc()` in `recommendations.ts`. |
| SC-5 | Billing alert configured at $50/day and verified to send test notification | NEEDS HUMAN | External Google Cloud configuration — no code artifact to verify. Explicitly deferred to user in 02-03-SUMMARY.md Task 2. |

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/api/src/services/places-constants.ts` | Field mask constants, PRICE_LEVEL_MAP, mapPrimaryTypeToCuisines | VERIFIED | 91 lines. Exports: `FIELD_MASK_NEARBY`, `FIELD_MASK_DETAIL`, `PLACES_BASE`, `PRICE_LEVEL_MAP`, `mapPrimaryTypeToCuisines`. 23 cuisine mappings present. |
| `apps/api/src/services/places.ts` | searchNearby, getPlaceDetails, resolvePhotoUrl, mapPlaceToRestaurant, mapPlaceDetailToUpdate | VERIFIED | 229 lines. All 5 functions exported. Imports constants from places-constants.ts. |
| `apps/api/src/services/geo-cache.ts` | getRestaurantsForLocation, isBudgetExhausted, incrementBudgetCount, two-layer cache, stale-while-refresh, daily budget | VERIFIED | 289 lines. All 3 public functions exported. node-cache + Supabase layers + background refresh implemented. |
| `apps/api/src/routes/restaurants.ts` | GET /nearby, GET /:id, GET /:id/photos in correct order | VERIFIED | 213 lines. All 3 routes present in correct order. Wired to `restaurantsRouter` exported and mounted in server.ts. |
| `apps/api/.env.example` | GOOGLE_PLACES_API_KEY documented | VERIFIED | Line 16: `GOOGLE_PLACES_API_KEY=your-google-places-api-key` with comments for Google Cloud Console path, API Library requirement, and key restriction guidance. |
| `supabase/migrations/20260411100000_geo_cache.sql` | geo_cache table, api_budget table, upsert_restaurant RPC, restaurants.geohash | VERIFIED | 87 lines. All required DDL present: geo_cache, api_budget, geohash column + index, upsert_restaurant with `ST_SetSRID(ST_MakePoint())` and `search_path TO 'public', 'extensions'`. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `places.ts` | `places-constants.ts` | `import { FIELD_MASK_NEARBY, FIELD_MASK_DETAIL, PRICE_LEVEL_MAP, mapPrimaryTypeToCuisines }` | WIRED | Import at lines 15–21; constants used in `searchNearby` (line 77), `getPlaceDetails` (line 112), `mapPlaceToRestaurant` (lines 184–185), `mapPlaceDetailToUpdate` (line 213). |
| `geo-cache.ts` | `places.ts` | `import { searchNearby, mapPlaceToRestaurant }` | WIRED | `searchNearby` called in `fetchAndCacheCell` line 207; `mapPlaceToRestaurant` called line 212. |
| `restaurants.ts` | `geo-cache.ts` | `import { getRestaurantsForLocation }` | WIRED | Used in `/nearby` handler line 83. |
| `restaurants.ts` | `places.ts` | `import { getPlaceDetails, resolvePhotoUrl, mapPlaceDetailToUpdate }` | WIRED | All three used: `getPlaceDetails` line 193, `resolvePhotoUrl` line 144, `mapPlaceDetailToUpdate` line 194. |
| `server.ts` | `restaurants.ts` | `app.use('/api/v1/restaurants', restaurantsRouter)` | WIRED | Import line 8, mount line 45. |
| `geo-cache.ts` | `api_budget` table | Supabase upsert in `incrementBudgetCount` | WIRED | Fire-and-forget upsert at lines 108–119. Cold-start DB read at lines 82–90. |
| `geo-cache.ts` | `upsert_restaurant` RPC | `supabase.rpc('upsert_restaurant', {...})` | WIRED | Called in `fetchAndCacheCell` loop lines 214–225, passing `p_lng` and `p_lat` as separate params per the RPC signature. |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `restaurants.ts` GET /nearby | `result.restaurants` | `getRestaurantsForLocation()` → Supabase `restaurants` table (or Google Places API on miss) | Yes — Supabase SELECT with real geohash filter, Google API fallback | FLOWING |
| `restaurants.ts` GET /:id | `data` | Supabase `restaurants` SELECT by UUID | Yes — real DB query; lazy Enterprise enrichment via `getPlaceDetails` | FLOWING |
| `restaurants.ts` GET /:id/photos | `photoUrls` | Supabase `photo_urls` column → `resolvePhotoUrl()` → Google Media API | Yes — resource names from DB resolved to live Google URLs | FLOWING |
| `geo-cache.ts` budget check | `data.request_count` | Supabase `api_budget` table SELECT | Yes — real DB query with date_key filter | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compilation | `pnpm --filter cravyr-api exec tsc --noEmit` | Exit 0, no output | PASS |
| Commit 57a88d7 exists | `git log --oneline` | `57a88d7 feat(02-01): install ngeohash, create Places constants and API client` | PASS |
| Commit 1c56472 exists | `git log --oneline` | `1c56472 feat(02-01): create geo_cache migration and push schema to Supabase` | PASS |
| Commit ecfba98 exists | `git log --oneline` | `ecfba98 feat(02-02): create geo-cache orchestration service with two-layer caching and budget counter` | PASS |
| Commit 40f86c4 exists | `git log --oneline` | `40f86c4 feat(02-02): rewrite restaurants route with nearby, detail, and photo endpoints` | PASS |
| Commit c2c5c85 exists (search_path fix) | `git log --oneline` | `c2c5c85 fix(02-03): add extensions to upsert_restaurant search_path for PostGIS ST_MakePoint` | PASS |
| ngeohash in package.json | grep dependencies | `"ngeohash": "^0.6.3"` present | PASS |
| Route order correct | grep restaurantsRouter.get | Lines 63(/nearby), 100(/:id/photos), 163(/:id) | PASS |
| Cache hit behavior (live server) | GET /nearby twice, inspect logs | Cannot verify without running server | SKIP |
| Billing alert (Google Cloud) | Manual Google Cloud Console inspection | Cannot verify from codebase | SKIP |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| API-01 | 02-01-PLAN.md, 02-02-PLAN.md | Google Places API client with field masks, caching, and restaurant endpoints | PARTIALLY SATISFIED | All code artifacts implemented and compiling. Live end-to-end verification (Task 2 in 02-03) pending user action on GOOGLE_PLACES_API_KEY setup and billing alert. |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | — |

No TODO/FIXME comments, no empty return stubs, no hardcoded placeholder data, no console.log-only handlers detected in any Phase 2 service or route file.

**Notable pattern review:**
- `geo-cache.ts` line 187 returns `{ restaurants: [], ... }` on budget exhaustion — this is intentional behavior (cache_only mode), not a stub. The empty array is the correct response when the daily cap is hit.
- `resolvePhotoUrl` returns `null` on non-ok HTTP responses — intentional graceful degradation, not a stub.

---

### Human Verification Required

#### 1. Cache Hit Confirmation via Server Logs

**Test:** Start the API server (`cd apps/api && pnpm dev`) with a valid `GOOGLE_PLACES_API_KEY` in `.env`. Make two sequential GET requests: `GET /api/v1/restaurants/nearby?lat=40.7128&lng=-74.0060`. Inspect server logs between the two calls.

**Expected:** The first call triggers a Google Places API fetch (log shows either a Places API HTTP call or the geo_cache being written). The second identical call returns immediately with `meta.source: "memory"` in the response body, and NO outbound Places API request appears in server logs (confirming the node-cache hot layer served it).

**Why human:** Requires a live running server with a valid API key. The cache-hit code path exists and is structurally correct, but confirming the timing (first call populates, second call hits memory) requires runtime observation of actual HTTP traffic and node-cache TTL behavior.

#### 2. Google Cloud Billing Alert Verification

**Test:** Log into Google Cloud Console for the project associated with the `GOOGLE_PLACES_API_KEY`. Navigate to Billing → Budgets & Alerts. Verify a budget alert exists for the Places API at $50/day. Send a test notification to confirm the alert fires to the configured notification channel.

**Expected:** A budget alert for the Cravyr project is visible, set to $50/day, and a test notification fires successfully (email, Pub/Sub, or other configured channel).

**Why human:** External Google Cloud configuration — no code artifact can represent this. Explicitly listed as Task 2 in 02-03-PLAN.md and marked as pending user action in 02-03-SUMMARY.md. Without this, a Places API billing runaway remains possible before launch.

---

### Gaps Summary

No gaps found in the code implementation. All 8 must-haves from the phase specification are implemented correctly in the codebase.

The 2 items requiring human verification (`human_needed` status) are:
1. Live cache-hit confirmation — the code is correct; this is a runtime behavior check
2. Google Cloud billing alert — external infrastructure configuration outside the codebase

The `search_path` fix (commit `c2c5c85`) is noteworthy: the plan spec showed `SET search_path TO 'public'` but the live migration correctly has `SET search_path TO 'public', 'extensions'`. This was a bug found and fixed during execution — the migration on disk (the artifact being verified) is correct.

---

_Verified: 2026-04-12T15:03:39Z_
_Verifier: Claude (gsd-verifier)_
