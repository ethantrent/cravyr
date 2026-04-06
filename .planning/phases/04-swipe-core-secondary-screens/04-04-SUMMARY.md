---
phase: 04-swipe-core-secondary-screens
plan: "04"
subsystem: ui

tags:
  - react-native
  - expo-image
  - expo-router
  - flatlist
  - linking
  - supabase
  - zustand

requires:
  - phase: 04-01
    provides: "Restaurant type from @cravyr/shared, picksStore, lib/supabase client"

provides:
  - "PhotoGallery component: horizontal paging FlatList with dot indicators and empty-state fallback"
  - "RestaurantDetailScreen: 40% photo header + scrollable info sheet + 4-button action bar"
  - "lib/supabase.ts typed stub for parallel-worktree compile compatibility"

affects:
  - 04-05
  - any plan consuming apps/mobile/app/restaurant/[id].tsx or PhotoGallery

tech-stack:
  added:
    - expo-image (existing — used for photo rendering with thumbhash placeholder)
    - react-native-safe-area-context (existing — useSafeAreaInsets for back button)
  patterns:
    - "lib/supabase.ts stub pattern: type-compatible stub allows parallel worktrees to compile without the real package"
    - "Optimistic UI toggle: capture current state into wasSaved before flip, revert on API failure"
    - "Photo URL rendering: expo-image uri prop used directly — never stored in state between sessions (Google Places ToS)"
    - "Platform.select for maps deeplink: ios=maps.apple.com, android=google.com/maps/dir"
    - "Linking.canOpenURL guard before Linking.openURL on both maps and tel: URLs"

key-files:
  created:
    - apps/mobile/components/PhotoGallery/PhotoGallery.tsx
    - apps/mobile/lib/supabase.ts
  modified:
    - apps/mobile/app/restaurant/[id].tsx

key-decisions:
  - "PhotoGallery uses FlatList (not ScrollView) for horizontal paging — FlatList virtualizes off-screen photos, reducing memory pressure on low-end Android"
  - "lib/supabase.ts as a typed stub (no @supabase/supabase-js package) so Plan 04 files compile in isolation in parallel worktrees; plan 01 replaces with real client"
  - "tel: scheme guarded by Linking.canOpenURL — iPads and simulators cannot open tel: URLs; silently no-op if unavailable"
  - "handleSaveToggle uses optimistic state flip (capture wasSaved before setIsSaved) with revert on API failure"

patterns-established:
  - "Typed stub pattern: create interface-only files in lib/ for dependencies not yet installed to enable parallel worktree compile"
  - "Google Places photo ToS: photo_urls rendered via expo-image uri only — no useState, no AsyncStorage, no DB write of URL strings"

requirements-completed:
  - CORE-03

duration: 14min
completed: "2026-04-06"
---

# Phase 4 Plan 04: Restaurant Detail Screen Summary

**Photo-first detail view with FlatList gallery (40% header), scrollable info sheet, platform-aware maps deep links, and optimistic save toggle — satisfying CORE-03 and the App Store minimum functionality bar**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-04-06T18:09:00Z
- **Completed:** 2026-04-06T18:23:35Z
- **Tasks:** 2
- **Files modified:** 3 created + 1 modified (4 total)

## Accomplishments

- PhotoGallery component: horizontal paging FlatList, dot indicators (shown only when 2+ photos), empty-state icon fallback, expo-image with thumbhash placeholder
- RestaurantDetailScreen: 40% screen height photo header, back button with safe area inset, scrollable info sheet with name/rating/price/cuisine/address/hours
- Action bar: Directions (platform-detected maps URL), Call (conditional on phone_number, hidden when absent), Share (native Share sheet), Save toggle (optimistic with revert on failure)
- lib/supabase.ts typed stub enabling parallel worktree compilation without the actual package

## Task Commits

Each task was committed atomically:

1. **Task 1: PhotoGallery component** - `beb541a` (feat)
2. **Task 2: Restaurant detail screen** - `9ab74b8` (feat)
3. **Fix: tel: canOpenURL guard** - `fb3a2ac` (fix — Rule 2 auto-fix, part of Task 2 scope)

## Files Created/Modified

- `apps/mobile/components/PhotoGallery/PhotoGallery.tsx` — Horizontal paging gallery with dot indicators, expo-image, empty-state fallback
- `apps/mobile/lib/supabase.ts` — Typed stub for supabase client; provides `auth.getSession()` interface without @supabase/supabase-js package
- `apps/mobile/app/restaurant/[id].tsx` — Full detail screen: photo header, info sheet, action bar, Directions/Call/Share/Save

## Decisions Made

- Used FlatList (not ScrollView) for PhotoGallery: FlatList virtualizes off-screen images, keeping memory footprint low on low-end Android devices
- Typed supabase stub in `lib/supabase.ts`: allows this plan's files to compile cleanly in a parallel worktree where @supabase/supabase-js is not yet installed; real implementation from plan 01 takes over when branches merge
- `Linking.canOpenURL` guard applied to both maps URLs (in `openDirections`) and `tel:` URLs (in Call button onPress): iPads and simulators don't have phone dialers

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created lib/supabase.ts typed stub**
- **Found during:** Task 2 (Restaurant detail screen)
- **Issue:** `[id].tsx` imports `supabase` from `../../lib/supabase` but this file did not exist and `@supabase/supabase-js` is not installed in apps/mobile — would cause compile failure
- **Fix:** Created `apps/mobile/lib/supabase.ts` with a type-compatible interface stub that matches the `auth.getSession()` call shape used in `getAuthHeader()`; returns `{ data: { session: null }, error: null }` until real client is wired
- **Files modified:** apps/mobile/lib/supabase.ts (created)
- **Verification:** `pnpm tsc --noEmit` exits 0
- **Committed in:** beb541a (Task 1 commit, bundled since it unblocks Task 2)

**2. [Rule 2 - Missing Critical] Added Linking.canOpenURL guard for tel: scheme**
- **Found during:** Task 2 (Restaurant detail screen — threat model review T-04-04-03)
- **Issue:** The threat model (T-04-04-03) requires `Linking.canOpenURL` before `Linking.openURL`. The maps deeplink in `openDirections` was guarded, but the Call button's `tel:` URL was not — this would crash on iPad and simulator
- **Fix:** Wrapped the Call button `onPress` in an async function that calls `Linking.canOpenURL(telUrl)` and only proceeds if it returns true
- **Files modified:** apps/mobile/app/restaurant/[id].tsx
- **Verification:** `pnpm tsc --noEmit` exits 0; `Linking.canOpenURL` present before `Linking.openURL` in Call button handler
- **Committed in:** fb3a2ac

---

**Total deviations:** 2 auto-fixed (1 blocking/Rule 3, 1 missing critical/Rule 2)
**Impact on plan:** Both auto-fixes necessary for build correctness and threat-model compliance. No scope creep.

## Issues Encountered

TypeScript typo (`wassaved` / `wasaved` mismatch) in the initial write of the optimistic toggle — caught immediately by `tsc --noEmit` on first verification pass and fixed before committing.

## Known Stubs

- `apps/mobile/lib/supabase.ts` — The exported `supabase` object is a typed stub. `getSession()` always returns `{ session: null }` until plan 01 replaces this file with the real `createClient(...)` implementation. Until then, the detail screen's `getAuthHeader()` will return an empty object (unauthenticated requests) — consistent with T-04-04-04 acceptance disposition: "Detail screen reads public restaurant data; missing token on GET /restaurants/:id has low security impact."

## Threat Flags

None — all new network surface (GET /restaurants/:id, POST /saves, DELETE /saves/:id, Linking.openURL) is covered by the plan's threat model (T-04-04-01 through T-04-04-04) and mitigations are implemented.

## User Setup Required

None — no external service configuration required for this plan in isolation.

## Next Phase Readiness

- PhotoGallery is a standalone component ready for use anywhere photo display is needed
- RestaurantDetailScreen is navigation-ready via Expo Router `restaurant/[id]` route (already registered in `_layout.tsx`)
- `lib/supabase.ts` stub must be replaced by plan 01's real client before the save toggle or auth-protected API calls function in production
- Call button will silently no-op until the Express API returns `phone_number` in restaurant responses

---
*Phase: 04-swipe-core-secondary-screens*
*Completed: 2026-04-06*

## Self-Check: PASSED

- FOUND: apps/mobile/components/PhotoGallery/PhotoGallery.tsx
- FOUND: apps/mobile/lib/supabase.ts
- FOUND: apps/mobile/app/restaurant/[id].tsx
- FOUND: .planning/phases/04-swipe-core-secondary-screens/04-04-SUMMARY.md
- FOUND commit: beb541a (Task 1)
- FOUND commit: 9ab74b8 (Task 2)
- FOUND commit: fb3a2ac (fix)
