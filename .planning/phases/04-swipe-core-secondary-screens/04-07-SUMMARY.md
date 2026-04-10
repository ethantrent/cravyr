---
phase: 04-swipe-core-secondary-screens
plan: 07
subsystem: api, mobile
tags: [expo-location, express, supabase, postgis, saves, swipes, geolocation]

requires:
  - phase: 04-06
    provides: "GET /api/v1/recommendations endpoint, saves router, swipes router, server.ts registration"
provides:
  - "Location-aware deck fetch in discover.tsx with lat/lng query params"
  - "POST /api/v1/saves for manual save from restaurant detail view"
  - "DELETE /api/v1/swipes/:id for undo swipe reversal"
affects: [05-notifications, onboarding, settings]

tech-stack:
  added: [expo-location]
  patterns: [foreground-location-permission, idempotent-upsert, idempotent-delete]

key-files:
  created: []
  modified:
    - apps/mobile/app/(tabs)/discover.tsx
    - apps/mobile/package.json
    - apps/api/src/routes/saves.ts
    - apps/api/src/routes/swipes.ts

key-decisions:
  - "Location.Accuracy.Balanced for restaurant discovery (~100m precision, fast response)"
  - "requestForegroundPermissionsAsync is idempotent -- returns granted immediately if already permitted"
  - "DELETE /swipes/:id param is restaurant_id (not swipe UUID) matching client calling convention"
  - "204 idempotent delete for best-effort undo operation"

patterns-established:
  - "Location permission request pattern: request in fetchDeck, show error state on denial, retry re-requests"
  - "POST upsert on (user_id, restaurant_id) for idempotent saves"

requirements-completed: [CORE-01, CORE-02, CORE-03]

duration: 2min
completed: 2026-04-10
---

# Phase 04 Plan 07: Gap Closure Summary

**expo-location integration for discover.tsx lat/lng params, plus POST /saves and DELETE /swipes/:id route handlers closing all verification gaps**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-10T16:32:52Z
- **Completed:** 2026-04-10T16:35:08Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Fixed BLOCKER: discover.tsx now obtains user location via expo-location and passes lat/lng as query parameters to GET /api/v1/recommendations, so the endpoint returns scored restaurants instead of 400
- Added POST /api/v1/saves for the "Add to Picks" button in restaurant detail view, with input validation and upsert for idempotent re-saves
- Added DELETE /api/v1/swipes/:id for undo swipe reversal in discover.tsx, with dual ownership filter (restaurant_id + user_id from JWT)

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix BLOCKER -- Add expo-location to discover.tsx for lat/lng query params** - `83a0787` (feat)
2. **Task 2: Add POST /saves and DELETE /swipes/:id route handlers** - `dcc3d09` (feat)

## Files Created/Modified
- `apps/mobile/package.json` - Added expo-location dependency (~55.1.8)
- `apps/mobile/app/(tabs)/discover.tsx` - Rewrote fetchDeck to request location permission, obtain coordinates, and pass lat/lng query params to recommendations API
- `apps/api/src/routes/saves.ts` - Added POST / handler for manual save with restaurant_id + interaction_type validation, upsert on conflict
- `apps/api/src/routes/swipes.ts` - Added DELETE /:id handler for undo swipe reversal, dual filter on restaurant_id + user_id

## Decisions Made
- Used Location.Accuracy.Balanced (~100m precision) rather than High accuracy -- sufficient for restaurant discovery and returns faster
- requestForegroundPermissionsAsync is called inside fetchDeck (idempotent -- returns 'granted' immediately if already permitted from onboarding)
- DELETE /swipes/:id uses restaurant_id as the URL param (not swipe UUID) to match the client calling convention in discover.tsx
- Returns 204 for delete regardless of row count -- idempotent best-effort undo

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 5 VERIFICATION.md key links are now wired (none remain BROKEN or NOT_WIRED)
- The discover screen loads restaurant cards with location-aware recommendations
- POST /saves and DELETE /swipes/:id complete the API surface for detail view and undo
- Phase 04 gap closure is complete; ready for Phase 05 (notifications, onboarding, settings)

## Self-Check: PASSED

All 4 modified files verified present on disk. Both task commits (83a0787, dcc3d09) verified in git log.

---
*Phase: 04-swipe-core-secondary-screens*
*Completed: 2026-04-10*
