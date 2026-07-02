# Codebase Concerns

**Analysis Date:** 2026-07-02

## Tech Debt

**`auth.admin.listUsers()` called on every swipe and connection fetch:**
- Issue: `swipes.ts` (line 76) and `connections.ts` (line 46) call `supabaseAdmin.auth.admin.listUsers()` on every POST swipe and GET connections request. This returns the full user list from `auth.users` to resolve display names. It's an O(n-users) paginated admin call used inside a hot path.
- Files: `apps/api/src/routes/swipes.ts`, `apps/api/src/routes/connections.ts`
- Impact: Latency spike on the swipe action; the call is unbounded as user count grows. Also unnecessarily exposes full user records.
- Fix approach: Add a `public.profiles` table (id, full_name) populated via a Supabase trigger on `auth.users` insert. Replace `listUsers()` with a targeted `select` on `profiles` with an `.in('id', friendIds)` filter. This is a single indexed query instead of a full-table scan.

**Multiple Supabase client instances created per module:**
- Issue: Every route file (`swipes.ts`, `connections.ts`, `saves.ts`, `notifications.ts`, `recommendations.ts`, `restaurants.ts`) calls `createClient()` at module load time, producing 6+ separate client instances with duplicate HTTP connection pools.
- Files: `apps/api/src/routes/swipes.ts`, `apps/api/src/routes/connections.ts`, `apps/api/src/routes/saves.ts`, `apps/api/src/routes/notifications.ts`, `apps/api/src/routes/recommendations.ts`, `apps/api/src/routes/restaurants.ts`, `apps/api/src/services/geo-cache.ts`, `apps/api/src/services/cron.ts`
- Impact: Wastes memory; on Render's 512 MB RAM ceiling this is a meaningful concern. Each client maintains its own fetch pool and PostgREST headers.
- Fix approach: Create `apps/api/src/lib/supabase.ts` exporting a singleton `supabaseAdmin` and `supabaseAnon`, imported by all routes. Two instances total.

**Inconsistent user identity sourcing: `req.user` vs `res.locals.user`:**
- Issue: Most routes read the authenticated user from `req.user?.id` (set by the `requireAuth` middleware via `(req as Request & { user }).user = user`). However `connections.ts` and `matches.ts` read from `res.locals.user.id` — a path that the middleware never populates, meaning these routes will runtime-error with `Cannot read properties of undefined` when accessed.
- Files: `apps/api/src/routes/connections.ts` (lines 23, 72, 102, 154), `apps/api/src/routes/matches.ts` (line 20)
- Impact: All connection and match endpoints are broken for any request that reaches the userId read. The GET /connections, POST /connections/code, POST /connections/link, and DELETE /connections/:friendId endpoints all fail silently or crash.
- Fix approach: Replace all `res.locals.user.id` with `(req as Request & { user?: { id: string } }).user?.id` to match the pattern used in `swipes.ts`, `saves.ts`, `users.ts`, and `recommendations.ts`.

**`prerenderItems={7}` violates CLAUDE.md memory guidance:**
- Issue: `SwipeDeck.tsx` passes `prerenderItems={7}` to the `Swiper` component. CLAUDE.md explicitly warns that loading more than 5–7 cards simultaneously can crash low-end Android devices and recommends 5–7 as the maximum.
- Files: `apps/mobile/components/SwipeDeck/SwipeDeck.tsx` (line 122)
- Impact: 7 is the upper bound of the documented safe range; at 7 pre-rendered cards with expo-image loading, OOM on low-RAM Android is a real risk. The CLAUDE.md recommendation was to use the `prerenderItems` prop to limit to 5–7.
- Fix approach: Lower to `prerenderItems={5}` and pair with `Image.prefetch` (already implemented in `handleIndexChange`) for the next 2–3 URLs to maintain visual smoothness.

**`react-native-worklets` polyfill stub used instead of real package:**
- Issue: `apps/mobile/polyfills/react-native-worklets.js` exports an empty object (`module.exports = {}`). This is a web stub that has been mapped into the Metro resolver. rn-swiper-list 3.0.0 requires `react-native-worklets` as a real peer dependency for worklet execution on the native UI thread.
- Files: `apps/mobile/polyfills/react-native-worklets.js`, `apps/mobile/metro.config.js`
- Impact: If the stub is being used at runtime on device (not just web), swipe animations would silently fall back to JS-thread execution, eliminating the 60fps guarantee — the core product promise.
- Fix approach: Confirm whether `react-native-worklets-core` is installed as a real native dependency via `pnpm why --recursive react-native-worklets`. If not, install it with `expo install react-native-worklets-core` and confirm the babel plugin is configured.

**`connection_codes` table lacks cleanup beyond best-effort delete:**
- Issue: `connections.ts` deletes the code after use but only as a "nice to have" — the comment says "let it expire is fine." Expired codes are only cleaned up if someone uses the code. The `expires_at` column prevents redemption after 15 minutes, but rows accumulate indefinitely if codes are generated but never used (abandoned flow).
- Files: `apps/api/src/routes/connections.ts` (line 142)
- Impact: Table bloat over time. On Supabase free tier with 500 MB total DB limit, uncleaned rows compound with swipe history.
- Fix approach: Add a Supabase `pg_cron` job to `DELETE FROM connection_codes WHERE expires_at < now()` hourly, or add a Supabase Row Security cleanup policy.

**`discover.tsx` nearbyRes response body is consumed but discarded:**
- Issue: The discover screen fires a warm-up call to `/api/v1/restaurants/nearby` and awaits `nearbyRes.json()` to consume the stream, but the result is unused. This is correct for warming the geo-cache, but the code comment says "Warm the geo-cache so restaurants exist in the DB" — any error from this call is silently swallowed.
- Files: `apps/mobile/app/(tabs)/discover.tsx` (lines 73–77)
- Impact: If the nearby warming call fails (budget exhausted, Render cold start), the subsequent recommendations call may return an empty deck with no user-visible error.
- Fix approach: Log or surface cache_only state from the warming response so the UI can show a "Limited results" banner rather than an empty deck.

## Known Bugs

**`res.locals.user` access crash in connections and matches routes:**
- Symptoms: GET /api/v1/connections, POST /api/v1/connections/code, POST /api/v1/connections/link, DELETE /api/v1/connections/:friendId, and GET /api/v1/matches all throw `TypeError: Cannot read properties of undefined (reading 'id')` at runtime because `res.locals.user` is never populated by the `requireAuth` middleware.
- Files: `apps/api/src/routes/connections.ts`, `apps/api/src/routes/matches.ts`
- Trigger: Any authenticated request to these endpoints.
- Workaround: None — the endpoints return 500 or crash the request.

**Undo finds restaurant from wrong source after swipe:**
- Symptoms: In `discover.tsx` line 121, when a match is detected after a swipe, the code attempts `useSwipeDeckStore.getState().deck.find(r => r.id === restaurantId)` — but the just-swiped card has already been removed from the deck by `rn-swiper-list`. It falls back to `undoStack[0]` which is only set after `pushUndo` completes, creating a race condition.
- Files: `apps/mobile/app/(tabs)/discover.tsx` (line 121)
- Trigger: A swipe that results in a friend match — the MatchModal may show `null` as the restaurant.
- Workaround: The MatchModal renders null when `matchData` is null, so it just silently fails to show.

**`saved.tsx` silently ignores fetch errors on the Picks tab:**
- Symptoms: The `fetchPicks` catch block swallows all errors with a comment "Silent failure — empty list is acceptable fallback." A user seeing an empty Picks list during a network hiccup gets no indication that something went wrong vs. genuinely having no picks.
- Files: `apps/mobile/app/(tabs)/saved.tsx` (lines 113–118)
- Trigger: Any Supabase query error during fetchPicks (bad session, network drop, etc.)

## Security Considerations

**CORS wildcard in production:**
- Risk: `server.ts` uses `origin: process.env.CORS_ORIGIN || '*'` — if `CORS_ORIGIN` is not set in the production environment, the API accepts cross-origin requests from any domain.
- Files: `apps/api/src/server.ts` (line 52)
- Current mitigation: JWT auth on all sensitive routes provides a secondary defense layer.
- Recommendations: Ensure `CORS_ORIGIN` is explicitly set in Render environment variables before going live. The mobile app has no origin, but the backend should at minimum restrict to a known domain list to prevent web-based token theft attacks.

**Rate limiting skips the photo resolve endpoint:**
- Risk: `server.ts` (line 74) explicitly skips rate limiting for `/api/v1/photos/resolve`. This endpoint proxies Google Places photo URLs and calls `resolvePhotoUrl`, which itself is cached — but cache misses hit the Google API.
- Files: `apps/api/src/server.ts` (line 74)
- Current mitigation: `photoUrlCache` in `places.ts` has a 20-hour TTL for resolved URLs.
- Recommendations: Apply a separate, more permissive rate limit (e.g., 200/15min per IP) to the photo endpoint rather than skipping entirely.

**Google Places API key exposed in photo media URL:**
- Risk: `resolvePhotoUrl` in `places.ts` (line 144) constructs the URL with `key=${process.env.GOOGLE_PLACES_API_KEY}` as a query parameter. The server then returns the resolved `photoUri` to clients. Google photo CDN URLs include the key embedded in the URL itself.
- Files: `apps/api/src/services/places.ts` (line 144)
- Current mitigation: The CDN URL is returned to the client, not the API key itself.
- Recommendations: This is the expected Google Places photo URL format — no change needed. Ensure the returned `photoUri` is not logged at debug level.

**`connection_codes` 6-digit numeric code has a small keyspace:**
- Risk: `connections.ts` generates codes using `randomBytes(3)` mapped to `(b % 10)` — producing 6 decimal digits (000000–999999, 1 million possibilities). Within the 15-minute window, an attacker could brute-force connections by cycling through codes.
- Files: `apps/api/src/routes/connections.ts` (lines 73–75)
- Current mitigation: 15-minute expiry limits the window. No rate limit specifically on POST /connections/link.
- Recommendations: Add a per-IP rate limit on POST /connections/link (e.g., 10 attempts/minute). Consider alphanumeric codes to increase keyspace to ~2.8 billion.

## Performance Bottlenecks

**`auth.admin.listUsers()` on every swipe with a match:**
- Problem: The match detection flow in `swipes.ts` calls `listUsers()` synchronously in the POST /swipes response path when the user has any connections. This is O(total users) and blocks the swipe response.
- Files: `apps/api/src/routes/swipes.ts` (lines 56–83)
- Cause: No `public.profiles` table exists; names must be fetched from `auth.users` via admin API.
- Improvement path: Add `public.profiles` table with a trigger. Single indexed query replaces full user scan.

**Background `warmNeighboringCells` fires 8 sequential Google API calls without concurrency control:**
- Problem: `warmNeighboringCells` in `geo-cache.ts` loops over up to 8 neighboring geohash cells sequentially, calling `fetchAndCacheCell` for each uncached neighbor. Each call includes a `searchNearby` to Google Places. Sequential execution means a single user triggering cache warming could consume 9 of the 500 daily budget in one request.
- Files: `apps/api/src/services/geo-cache.ts` (lines 302–344)
- Cause: `for...of` loop with `await` inside is sequential.
- Improvement path: Add a concurrency limit (e.g., warm max 2 neighbors per request, or run neighbors concurrently with `Promise.allSettled`). Log budget consumption per warming event.

**`discover.tsx` makes two sequential API calls before rendering the deck:**
- Problem: The deck fetch in `fetchDeck` first calls `/api/v1/restaurants/nearby` (which may itself hit Google Places if cold), waits for it to complete, then calls `/api/v1/recommendations`. These run serially. Total time-to-first-card is the sum of both latencies.
- Files: `apps/mobile/app/(tabs)/discover.tsx` (lines 73–84)
- Cause: Intentional design to warm the geo-cache before querying recommendations, but the sequential dependency adds perceived latency.
- Improvement path: Fire the nearby call and show a skeleton immediately. Transition to real cards once recommendations resolve. Or have the recommendations endpoint internally trigger cache warming and return results once complete.

## Fragile Areas

**`cron.ts` uses `setInterval` inside a Render free-tier service:**
- Files: `apps/api/src/services/cron.ts` (lines 163–174)
- Why fragile: Render free tier spins down after 15 minutes of no traffic. `setInterval` state is lost on every cold start. If the cron fires during the spin-down window, no notification is sent for that hour. The `tickDailyReminder` call on startup mitigates restarts during the send window but not mid-window spin-downs.
- Safe modification: The push dedupe logic (`push_sends` table) is correctly in Postgres, so if the server restarts within the same UTC hour, a restart-triggered fire will be deduplicated. The main risk is a full-hour gap if the server is cold during the send window.
- Test coverage: No tests for `cron.ts`.

**`budget counter` race condition between node-cache and Supabase:**
- Files: `apps/api/src/services/geo-cache.ts` (lines 101–123)
- Why fragile: `incrementBudgetCount` reads from `budgetCache`, increments locally, then writes to Supabase in a fire-and-forget. Multiple concurrent requests during a cache miss can each read the same value (e.g., 498), all increment to 499, and all persist 499, effectively allowing more than 500 calls. Under load, this could result in 2–8x the intended daily budget.
- Safe modification: For MVP scale this is acceptable. At higher traffic, use Supabase atomic `update request_count = request_count + 1` with a returned value, or use `pg_advisory_lock`.

**`res.locals.validated` cast pattern is type-unsafe:**
- Files: `apps/api/src/middleware/validate.ts`, all route files using `validate()`
- Why fragile: Routes cast `res.locals.validated as { ... }` with a hand-written type assertion. If the Zod schema changes, the cast does not update automatically — type errors are silently swallowed.
- Safe modification: Use `z.infer<typeof Schema>` passed as a generic to `validate()` so `res.locals.validated` carries the correct type without casting.

**`RestaurantRow` in Matches tab cast with `as any`:**
- Files: `apps/mobile/app/(tabs)/saved.tsx` (line 270)
- Why fragile: `<RestaurantRow pick={{ id: item.id, restaurant: item } as any} />` bypasses TypeScript for the matches list rendering. If `RestaurantRow` prop types change, this silently passes broken data.

## Scaling Limits

**Supabase free tier 500 MB database ceiling:**
- Current capacity: Approximately 10K–15K cached restaurant rows at full data.
- Limit: At 500 MB, Supabase puts the database in read-only mode without warning. Swipe records accumulate at ~200 bytes/row; 50K users each with 500 swipes = 25M rows, which would exceed the limit.
- Scaling path: Enable swipe archiving (delete inactive user swipes older than 30 days). Upgrade to Supabase Pro ($25/month) before launch.

**Google Places API daily budget at 500 requests:**
- Current capacity: 500 nearby search calls/day is sufficient for low hundreds of DAU in dense cities (most users share geohash cells).
- Limit: At ~500 DAU in new areas (e.g., suburban users with uncached cells), budget could exhaust before noon. When exhausted, new users receive empty decks with `cache_only: true`.
- Scaling path: Increase the budget ceiling in `geo-cache.ts` (`>= 500` check at line 79) when migrating to Render Starter and paid Google Places billing.

## Dependencies at Risk

**`rn-swiper-list` — single maintainer, 295 stars:**
- Risk: The library is actively maintained but has a small community. Version 3.0.0 added `react-native-worklets` as a required peer dependency. Any breaking change in the library's worklet integration or rn-reanimated v4 compatibility could require a fork.
- Impact: Swipe animation is the core product interaction — a broken dependency here is fatal.
- Migration plan: Maintain awareness of the library's release cadence. The custom ~150-line Reanimated v3 implementation described in CLAUDE.md is the fallback path.

**Render free tier — service spin-down:**
- Risk: Render's free tier spins down after 15 minutes. The cron-based push notification system requires the server to be running at the send hour.
- Impact: Push notifications may not fire for users whose timezone aligns with a Render spin-down window.
- Migration plan: Upgrade to Render Starter ($7/month) before any real users — this is already documented in CLAUDE.md.

## Missing Critical Features

**No `public.profiles` table:**
- Problem: User display names are fetched via `auth.admin.listUsers()` in both `connections.ts` and `swipes.ts`. This is a known hack (see comment in `connections.ts` line 43: "In a real app we'd query a public.profiles table. Here we hack it via admin auth users").
- Blocks: Efficient match name resolution and friend display name lookup at scale.

**No error state for location permission denial on discover screen:**
- Problem: If location permission is denied in `discover.tsx`, `setError(true)` is called (line 56) which shows the generic "Couldn't load restaurants" error — not a permission-specific message with guidance to enable location.
- Files: `apps/mobile/app/(tabs)/discover.tsx` (lines 54–57)
- Blocks: App Store compliance. Apple reviewers test permission denial paths.

## Test Coverage Gaps

**Zero mobile test files:**
- What's not tested: All mobile screens, components, Zustand stores, and the `lib/api.ts` fetch helpers have no tests.
- Files: Entire `apps/mobile/` directory.
- Risk: Swipe handler logic (`handleSave`, `handleSkip`, `handleSuperlike`, `handleUndo`) in `discover.tsx` is untested. The optimistic pick pattern and undo rollback are invisible to CI.
- Priority: High — these are the core user flows.

**API routes only tested at schema level, not route level:**
- What's not tested: `apps/api/src/__tests__/` has 3 files: health check, auth guard, and Zod schema unit tests. No integration tests exist for `swipes.ts`, `connections.ts`, `restaurants.ts`, `recommendations.ts`, `geo-cache.ts`, or `cron.ts`.
- Files: `apps/api/src/__tests__/`
- Risk: The `res.locals.user` bug in `connections.ts` would be caught immediately by an integration test. The match detection flow, budget enforcement, and background refresh are entirely untested.
- Priority: High — the connection/match feature is most likely broken and has no test coverage to confirm.

**No tests for `geo-cache.ts` budget enforcement:**
- What's not tested: The daily budget cap, race condition between hot cache and Supabase, and background warming logic in `apps/api/src/services/geo-cache.ts`.
- Risk: Over-calling Google Places API due to budget counter race, which would result in unexpected billing.
- Priority: High — financial impact.

---

*Concerns audit: 2026-07-02*
