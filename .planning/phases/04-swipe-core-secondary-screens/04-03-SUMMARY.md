---
phase: 04-swipe-core-secondary-screens
plan: 03
subsystem: ui
tags: [react-native, expo, supabase, zustand, reanimated, swipe-to-delete, flatlist]

# Dependency graph
requires:
  - phase: 04-01
    provides: "SavedRestaurant type, picksStore (usePicksStore), navigation skeleton"
provides:
  - "RestaurantRow component: 80px list row with thumbnail, superlike badge, name/cuisine/distance"
  - "Tonight's Picks screen: FlatList with swipe-to-delete, empty state, loading skeleton"
  - "lib/supabase.ts: Supabase client singleton for mobile app"
affects:
  - 04-02 (discover screen can addPick to picksStore)
  - 04-04 (detail view navigated to from RestaurantRow tap)

# Tech tracking
tech-stack:
  added:
    - "@supabase/supabase-js ^2.101.1 (mobile app dependency)"
  patterns:
    - "Default import for ReanimatedSwipeable (not named export)"
    - "Optimistic delete: removePick immediately, background DELETE fetch with Bearer auth"
    - "Supabase fetchPicks: query saves JOIN restaurants, map to SavedRestaurant shape"
    - "lib/supabase.ts singleton with detectSessionInUrl: false (required for RN)"

key-files:
  created:
    - apps/mobile/components/RestaurantRow/RestaurantRow.tsx
    - apps/mobile/lib/supabase.ts
  modified:
    - apps/mobile/app/(tabs)/saved.tsx
    - apps/mobile/package.json

key-decisions:
  - "ReanimatedSwipeable from react-native-gesture-handler uses default export, not named export — plan template used named export syntax which TypeScript rejected"
  - "lib/supabase.ts created with detectSessionInUrl: false and autoRefreshToken: true per Supabase React Native requirements"
  - "@supabase/supabase-js added to mobile package.json (was missing from scaffold)"

patterns-established:
  - "Named export only for components (RestaurantRow, SavedScreen) — no default-only exports"
  - "Supabase client imported from ../../lib/supabase in screen files"
  - "Bearer auth header pattern via getAuthHeader() for Express API calls"

requirements-completed:
  - CORE-02

# Metrics
duration: 12min
completed: 2026-04-06
---

# Phase 4 Plan 03: Tonight's Picks Screen Summary

**Tonight's Picks screen with FlatList, ReanimatedSwipeable swipe-to-delete, gold superlike badge, and Supabase saves query — plus RestaurantRow component and Supabase client singleton**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-04-06T00:00:00Z
- **Completed:** 2026-04-06T00:12:00Z
- **Tasks:** 2
- **Files modified:** 4 (2 created, 2 new files added)

## Accomplishments
- RestaurantRow component: 80px row with 64px expo-image thumbnail, optional 20px gold superlike badge (#eab308), name/cuisine/distance text, Ionicons chevron, navigates to detail view
- Tonight's Picks screen: Supabase saves query on mount, FlatList with ReanimatedSwipeable rows, optimistic delete with Bearer auth to DELETE /api/v1/saves/:id, 3 skeleton rows while loading, empty state with bookmark-outline icon
- Supabase client singleton (lib/supabase.ts) with detectSessionInUrl: false — required for React Native environments

## Task Commits

1. **Task 1: RestaurantRow component** - `d8f9416` (feat)
2. **Task 2: Tonight's Picks screen (saved.tsx)** - `6aafdb4` (feat)

## Files Created/Modified
- `apps/mobile/components/RestaurantRow/RestaurantRow.tsx` - Picks list row component with thumbnail, superlike badge, name/cuisine/distance
- `apps/mobile/app/(tabs)/saved.tsx` - Tonight's Picks screen with FlatList, swipe-to-delete, empty/loading states
- `apps/mobile/lib/supabase.ts` - Supabase client singleton (new — required by saved.tsx)
- `apps/mobile/package.json` - Added @supabase/supabase-js ^2.101.1

## Decisions Made
- Used default import for ReanimatedSwipeable per its actual TypeScript type definitions (plan template showed named import which fails tsc)
- Created lib/supabase.ts rather than inlining the client — establishes the singleton pattern all screens will use
- Added @supabase/supabase-js to mobile package.json (was absent from scaffold — required for Supabase queries and auth in saved.tsx)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed ReanimatedSwipeable import syntax**
- **Found during:** Task 2 (Tonight's Picks screen)
- **Issue:** Plan template used `import { ReanimatedSwipeable } from 'react-native-gesture-handler/ReanimatedSwipeable'` (named export), but TypeScript reported no such named export — the module uses a default export
- **Fix:** Changed to `import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable'`
- **Files modified:** apps/mobile/app/(tabs)/saved.tsx
- **Verification:** `pnpm tsc --noEmit` exits 0
- **Committed in:** 6aafdb4 (Task 2 commit)

**2. [Rule 3 - Blocking] Added missing @supabase/supabase-js dependency**
- **Found during:** Task 2 (Tonight's Picks screen)
- **Issue:** saved.tsx imports from lib/supabase.ts which uses @supabase/supabase-js, but the package was not in apps/mobile/package.json
- **Fix:** Added `"@supabase/supabase-js": "^2.101.1"` to mobile package.json dependencies
- **Files modified:** apps/mobile/package.json
- **Verification:** TypeScript resolves types successfully; tsc exits 0
- **Committed in:** 6aafdb4 (Task 2 commit)

**3. [Rule 3 - Blocking] Created missing lib/supabase.ts**
- **Found during:** Task 2 (Tonight's Picks screen)
- **Issue:** saved.tsx imports from `../../lib/supabase` but no such file existed in the scaffold
- **Fix:** Created apps/mobile/lib/supabase.ts with createClient call, detectSessionInUrl: false per Supabase React Native requirement
- **Files modified:** apps/mobile/lib/supabase.ts (new)
- **Verification:** Import resolves; tsc exits 0
- **Committed in:** 6aafdb4 (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 bug fix, 2 blocking)
**Impact on plan:** All auto-fixes necessary for correctness and compilation. No scope creep.

## Issues Encountered
- None beyond deviations documented above.

## Threat Flags

None — all surfaces are within the plan's threat model scope. RLS on saves table (T-04-03-01) is Phase 1/2 responsibility. DELETE authorization (T-04-03-02) is Express API responsibility. Bearer token attachment (T-04-03-03) is implemented in getAuthHeader().

## Known Stubs

None — RestaurantRow renders live data from SavedRestaurant.restaurant fields. The `distance_km` field defaults to 0 if not returned by Supabase, which is intentional — the recommendation endpoint (not a stored column) provides this value. The UI displays "0 km" in this fallback case, which is acceptable for the scaffold phase.

## User Setup Required

None - no external service configuration required beyond environment variables already defined in project setup.

## Next Phase Readiness
- RestaurantRow component is ready for use in any future FlatList context
- lib/supabase.ts singleton is available to all mobile screens (discover.tsx, preferences.tsx, settings.tsx)
- Tonight's Picks screen is fully functional; relies on DB trigger from Phase 2 to auto-populate on right-swipe/superlike
- Plan 04 (detail view) can navigate from RestaurantRow tap via /restaurant/:id

## Self-Check: PASSED

- FOUND: apps/mobile/components/RestaurantRow/RestaurantRow.tsx
- FOUND: apps/mobile/app/(tabs)/saved.tsx
- FOUND: apps/mobile/lib/supabase.ts
- FOUND commit: d8f9416 (feat: RestaurantRow component)
- FOUND commit: 6aafdb4 (feat: Tonight's Picks screen)

---

*Phase: 04-swipe-core-secondary-screens*
*Completed: 2026-04-06*
