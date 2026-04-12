---
phase: 02-api-database-layer
plan: 01
subsystem: api
tags: [google-places, geohash, postgis, field-masks, ngeohash, supabase-rpc]

# Dependency graph
requires:
  - phase: 01-monorepo-scaffold-infrastructure
    provides: Express.js API server scaffold, Supabase restaurants table with PostGIS
provides:
  - Google Places API v1 HTTP client (searchNearby, getPlaceDetails, resolvePhotoUrl)
  - Field mask constants enforcing Pro/Enterprise cost tiers (FIELD_MASK_NEARBY, FIELD_MASK_DETAIL)
  - Place-to-restaurant mapping functions (mapPlaceToRestaurant, mapPlaceDetailToUpdate)
  - Price level mapping (Google string enums to DB integers)
  - Primary type to cuisine mapping (23 Google types to cuisine arrays)
  - geo_cache table for geohash-based geographic cluster caching
  - api_budget table for daily request count persistence across cold starts
  - upsert_restaurant RPC function with ST_MakePoint for PostGIS geography inserts
  - restaurants.geohash column with index for per-cell lookups
  - ngeohash dependency for geohash encoding
affects: [02-02, 02-03, restaurants-route, geo-cache-service, photo-endpoint]

# Tech tracking
tech-stack:
  added: [ngeohash@0.6.3, "@types/ngeohash@0.6.8"]
  patterns: [field-mask-constants, google-places-v1-fetch, price-level-enum-mapping, upsert-rpc-pattern]

key-files:
  created:
    - apps/api/src/services/places-constants.ts
    - apps/api/src/services/places.ts
    - supabase/migrations/20260411100000_geo_cache.sql
  modified:
    - apps/api/package.json

key-decisions:
  - "Keep priceLevel in FIELD_MASK_NEARBY despite Enterprise tier -- geohash caching means ~50 requests/month, making $3/1K cost delta negligible (per D-08)"
  - "Use SECURITY DEFINER + search_path on upsert_restaurant RPC -- called only from backend with service role key, not exposed to client"
  - "Store photo resource names (not photoUri URLs) in photo_urls column -- names refresh with geo_cache cell TTL"

patterns-established:
  - "Field mask constants: FIELD_MASK_NEARBY and FIELD_MASK_DETAIL as named string constants, not inline -- enforcement is structural per D-09"
  - "Google Places v1 via fetch: POST for searchNearby, GET for getPlaceDetails, API key in X-Goog-Api-Key header"
  - "PostGIS inserts via RPC: upsert_restaurant uses ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography -- avoids WKT parsing issues"
  - "Price level mapping: centralized PRICE_LEVEL_MAP record converts Google string enums to DB integer 1-4"

requirements-completed: [API-01]

# Metrics
duration: 5min
completed: 2026-04-12
---

# Phase 02 Plan 01: Google Places API Client + Geo Cache Migration Summary

**Google Places API v1 HTTP client with two-tier field mask constants, place-to-restaurant mapping, geo_cache table, api_budget table, and upsert_restaurant RPC function**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-12T02:39:49Z
- **Completed:** 2026-04-12T02:45:06Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created Places API v1 HTTP client with searchNearby (Pro-tier), getPlaceDetails (Enterprise-tier), and resolvePhotoUrl functions using native fetch
- Defined field mask constants that structurally enforce billing tier separation ($200/month vs $30K/month difference)
- Built place-to-restaurant mapping with 23 Google primaryType-to-cuisine mappings and price level enum conversion
- Created geo_cache table, api_budget table, restaurants.geohash column, and upsert_restaurant RPC function in Supabase
- All migrations pushed to remote Supabase and verified; existing get_restaurant_recommendations function confirmed intact

## Task Commits

Each task was committed atomically:

1. **Task 1: Install ngeohash, create Places constants and API client** - `57a88d7` (feat)
2. **Task 2: Create geo_cache migration and push schema to Supabase** - `1c56472` (feat)

## Files Created/Modified
- `apps/api/src/services/places-constants.ts` - Field mask constants (FIELD_MASK_NEARBY, FIELD_MASK_DETAIL), PRICE_LEVEL_MAP, mapPrimaryTypeToCuisines
- `apps/api/src/services/places.ts` - Google Places API v1 HTTP client with searchNearby, getPlaceDetails, resolvePhotoUrl, mapPlaceToRestaurant, mapPlaceDetailToUpdate
- `supabase/migrations/20260411100000_geo_cache.sql` - geo_cache table, api_budget table, restaurants.geohash column, upsert_restaurant RPC, RLS policies
- `apps/api/package.json` - Added ngeohash and @types/ngeohash dependencies

## Decisions Made
- Kept priceLevel in FIELD_MASK_NEARBY despite Enterprise tier -- geohash caching means ~50 requests/month, making the $3/1K cost delta negligible (matches D-08 user decision)
- Used SECURITY DEFINER with explicit search_path on upsert_restaurant RPC for safe PostGIS inserts from backend only
- Photo resource names stored in photo_urls column with understanding they refresh when geo_cache cell TTL expires

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript strict mode type assertions on fetch .json()**
- **Found during:** Task 1 (places.ts creation)
- **Issue:** `response.json()` returns `unknown` under strict mode; assigning to typed variables caused TS2322 errors
- **Fix:** Used `as` type assertions on `.json()` results for PlacesNearbyResponse and photoUri response
- **Files modified:** apps/api/src/services/places.ts
- **Verification:** `tsc --noEmit` passes with zero errors
- **Committed in:** 57a88d7 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor type assertion fix for strict TypeScript. No scope creep.

## Issues Encountered
- `supabase db push` required `supabase link` first in the worktree since the `.supabase` config was not present -- resolved by running `supabase link --project-ref dxkvtcpgqkbkhjshvqji` before push
- `supabase db query` defaults to local database; `--linked` flag required for remote queries

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Places API client ready for geo-cache orchestration service (Plan 02)
- geo_cache table ready for geohash cell metadata storage
- upsert_restaurant RPC ready for bulk restaurant inserts from Nearby Search results
- api_budget table ready for daily request counting
- GOOGLE_PLACES_API_KEY env var must be set in apps/api/.env before live API calls work (already documented in dev environment setup)

## Self-Check: PASSED

- All 4 files verified present on disk
- Both commit hashes (57a88d7, 1c56472) verified in git log
- TypeScript compilation confirmed passing
- Supabase tables (geo_cache, api_budget) confirmed via remote query (count=2)
- upsert_restaurant and get_restaurant_recommendations functions confirmed in pg_proc

---
*Phase: 02-api-database-layer*
*Completed: 2026-04-12*
