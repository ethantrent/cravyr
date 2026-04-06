# Domain Pitfalls

**Domain:** Swipe-based restaurant discovery app (Cravyr)
**Researched:** 2026-04-06
**Stack:** Turborepo + pnpm, Expo SDK 50+, Expo Router, Reanimated v3, rn-swiper-list, Supabase + PostGIS, Express.js on Render, Google Places API (New), Expo Push Notifications, Zustand

> **Note on research method:** WebSearch and WebFetch were unavailable in this environment. All findings are drawn from deep training knowledge of this exact stack (cutoff August 2025), cross-referenced against the PROJECT.md constraints. Confidence levels are noted per source.

---

## Critical Pitfalls

Mistakes that cause rewrites, $1,000+ costs, or App Store rejections.

---

### Pitfall 1: Google Places API Field Mask Omission — The $30K/Month Trap

**Severity:** Critical
**What goes wrong:** Every call to the Places API (New) without a restrictive `X-Goog-FieldMask` header bills for the most expensive SKU tier available on that endpoint. A `searchNearby` or `searchText` call with no field mask defaults to "Basic + Advanced + Preferred" data — roughly $0.032–$0.040 per call instead of $0.003 for Basic-only. At 1,000 DAU each triggering 5–10 deck refreshes, the unmasked cost reaches $30,000+/month.
**Why it happens:** The Places API (New) changed billing from per-field to per-SKU-tier, and the tier is determined by which fields are present in the response, not which fields you use. Forgetting the header is a silent mistake — the API returns data successfully and logs no warning.
**Consequences:** A bill spike that hits within the first billing cycle. Google does not proactively cap free-tier overruns; you need to set a budget alert manually. The spike can be thousands of dollars before it's noticed.
**Prevention:**
- Always set `X-Goog-FieldMask` on every Places API request in the Express layer, never in client code.
- Use only Basic tier fields (`id`, `displayName`, `formattedAddress`, `location`, `rating`, `priceLevel`, `primaryTypeDisplayName`, `photos`) unless an Advanced field is explicitly required.
- Store `place_id` permanently in Supabase so repeat fetches hit your DB, not the API.
- Implement geographic cluster batching: one `searchNearby` call per geographic cell rather than one per user session.
- Set a Google Cloud billing alert at $50/day with automatic API key suspension.
**Detection:** Monitor Google Cloud Console > Billing > Cost breakdown daily during development. An unexpected spike in "Places API - Nearby Search" line item is the signal.
**Phase to address:** Phase 1 (monorepo/API scaffold) — add field masks before writing any Places fetch code.

---

### Pitfall 2: Google Places Photo URLs Expire — Cannot Be Stored or Cached

**Severity:** Critical
**What goes wrong:** The Places API (New) returns photo URIs of the form `https://places.googleapis.com/v1/places/{place_id}/photos/{photo_reference}/media?...`. These URIs are ephemeral — they expire (typically within hours to a few days). Storing them in Supabase and serving them to clients results in broken images for returning users.
**Why it happens:** Google's ToS for Places API explicitly prohibits downloading photos to your own storage. The photo reference itself (not the full URI) is the stable token, but generating the signed URI requires a live API call with your key — which costs money and is rate-limited.
**Consequences:** Returning users see broken restaurant images. If you cache the full URI client-side (e.g., in AsyncStorage or Zustand persist), the cache poisons itself silently. Regenerating on every app open costs API quota.
**Prevention:**
- Store only `photo_reference` strings in Supabase, never full photo URIs.
- Generate signed photo URLs server-side (Express) on demand, with a short TTL cache (node-cache, 1–4 hours).
- Serve photo URLs through your API endpoint, not directly from client to Google.
- Prefetch the next 3–5 cards' photo URLs server-side so they're ready before swipe.
**Detection:** Images break for users who open the app more than a few hours after initial load. Check by suspending the app for 6 hours and reopening.
**Phase to address:** Phase 2 (Google Places integration).

---

### Pitfall 3: Supabase Free Tier Auto-Pause After 7 Days Inactivity

**Severity:** Critical
**What goes wrong:** Supabase free-tier projects pause after 7 consecutive days with no database activity. When paused, all API calls return 503. The project takes 30–60 seconds to resume after the first request, meaning the first user after a pause gets a hard failure.
**Why it happens:** Supabase's free tier policy to reclaim resources from abandoned projects. "Activity" means a database query — a health-check ping to the REST API without a DB read does not count.
**Consequences:** During development, weekends off = Monday morning broken demo. In production on a free plan, low-traffic periods (vacation, pre-launch) can cause user-facing 503s.
**Prevention:**
- Add a cron job (Express `node-cron` or Render Cron Job service) that runs a lightweight DB query every 3 days: `SELECT 1 FROM restaurants LIMIT 1`.
- Upgrade to Supabase Pro ($25/month) before public launch — auto-pause is disabled on Pro.
- Add exponential retry logic in the Express API layer for 503 responses with a "warming up" user-facing message.
**Detection:** Connect to Supabase dashboard on Monday morning after a weekend without traffic. The project status indicator shows "Paused."
**Phase to address:** Phase 1 (infrastructure setup) — add keep-alive cron before any integration work.

---

### Pitfall 4: Supabase 500MB Database Limit — Silent Read-Only Mode

**Severity:** Critical
**What goes wrong:** Supabase free tier enforces a 500MB database size limit. When exceeded, the project silently transitions to read-only mode. Writes fail with a PostgreSQL error (`cannot execute INSERT in a read-only transaction`) but reads continue normally. The app appears to work but swipe saves, preference updates, and user creation all fail silently if errors aren't surfaced.
**Why it happens:** PostGIS geometry data is large. Restaurant records with `geography(Point, 4326)` columns, indexed with GIST, plus JSONB attributes, can consume 1–5KB per restaurant row. A moderate import of 100K restaurants = 100–500MB before other tables.
**Consequences:** New users can't register. Swipe events aren't saved. The app looks functional but all write operations fail. Without proper error handling surfaced to the UI, users just see stale data.
**Prevention:**
- Monitor DB size in Supabase dashboard weekly during development.
- Use `geography` type (not `geometry`) — it's more compact for point data and avoids the SRID-mismatch footguns (see PostGIS pitfall below).
- Don't bulk-import restaurant data into Supabase; fetch from Google Places on demand and cache only `place_id` + metadata.
- Set up a Supabase database size alert webhook.
**Detection:** `INSERT` statements start returning `read-only transaction` errors in server logs while `SELECT` queries succeed normally.
**Phase to address:** Phase 1 (data model design) — design schema to minimize row size from the start.

---

### Pitfall 5: Apple Sign-In Full Name Only Available on First Authorization

**Severity:** Critical
**What goes wrong:** Apple Sign-In returns `givenName` and `familyName` only on the very first time a user authorizes the app. All subsequent sign-ins return `null` for the name fields. If your backend doesn't capture and persist the name on first login, you lose it forever — the user must revoke app access in their Apple ID settings and re-authorize to trigger name delivery again.
**Why it happens:** This is intentional Apple privacy design. The JWT from subsequent logins contains only `sub` (user ID) and `email`.
**Consequences:** Users have blank display names. Support burden of asking users to revoke and re-authorize. No graceful fallback without a name-prompt screen.
**Prevention:**
- On first Apple Sign-In, immediately `upsert` the user row in Supabase with `given_name` and `family_name` before any navigation occurs.
- Add a "What should we call you?" prompt in onboarding that pre-fills with the Apple name but is editable — this serves as the fallback for returning users and for Google/email auth users.
- Never assume subsequent Apple auth calls will return name data.
**Detection:** Sign out of the app, delete the app from test device, reinstall, and sign in with Apple a second time (without revoking Apple ID access). Name fields will be null.
**Phase to address:** Phase 3 (auth integration).

---

### Pitfall 6: App Store Minimum Functionality — ~40% First Submission Rejection

**Severity:** Critical
**What goes wrong:** Apple rejects apps that lack sufficient functionality for end users. For Cravyr, a skeleton swipe UI without working onboarding, preferences, restaurant detail view, saved list, and settings is nearly guaranteed rejection under guideline 4.0 (Minimum Functionality). Apple reviewers test the app as a real user, not a developer.
**Why it happens:** Apple's guidelines require apps to have "lasting value" and not be "barely functional." A swipe app with no way to see restaurant details, no way to manage preferences, and no way to view saved picks is classified as incomplete.
**Consequences:** 1–2 week review delay per rejection cycle. Requires resubmission with a complete feature set.
**Prevention:**
- All of these must be fully functional before first submission: onboarding flow (location permission → cuisine preferences → price range), swipe deck with real restaurant data, restaurant detail view (photos, hours, rating, address, directions), Tonight's Picks list, user preferences screen, settings screen (sign out, delete account).
- "Delete account" is now mandatory for App Store apps with accounts (App Store guideline 5.1.1).
- Test with a fresh Apple ID that has never used the app.
**Detection:** Internal TestFlight beta with 5 non-developer users. If any of them can't figure out what the app does or gets stuck within 2 minutes, it will likely be rejected.
**Phase to address:** Phase 4 (pre-submission) — build the full feature set before submitting.

---

### Pitfall 7: Location Permission Wording Causes Apple Rejection

**Severity:** Critical
**What goes wrong:** Apple requires the `NSLocationWhenInUseUsageDescription` string to be specific about why location is needed and what it's used for. Generic strings ("This app uses your location") are rejected. Additionally, requesting `Always` location permission without a clear background use case is rejected.
**Why it happens:** Apple's privacy guidelines require purpose strings to be specific and truthful. Reviewers manually check these strings.
**Consequences:** Automatic rejection during App Store review. Requires a code change, rebuild, and resubmission.
**Prevention:**
- Use a string like: `"Cravyr uses your location to find restaurants near you and personalize your swipe deck."` — specific, truthful, and proportionate.
- Request `WhenInUse` only, never `Always`, unless you have a legitimate background use case (Cravyr does not).
- In Expo, set this in `app.json` under `ios.infoPlist.NSLocationWhenInUseUsageDescription`.
- Also set `NSLocationAlwaysAndWhenInUseUsageDescription` even if you don't request Always — Apple's system requires both strings to be present in the binary if `Always` could theoretically be requested.
**Detection:** Review your `app.json` infoPlist strings before submission. Run through the Expo Doctor checklist.
**Phase to address:** Phase 4 (pre-submission configuration).

---

### Pitfall 8: Render Free Tier Cold Starts — 25–60 Second Delay

**Severity:** Critical (first impression)
**What goes wrong:** Render's free web service tier spins down after 15 minutes of inactivity. The next request triggers a cold start that takes 25–60 seconds. For a mobile app, this means the first API call after any idle period hangs for up to a minute. The user sees a spinner or a timeout error on first open.
**Why it happens:** Render free tier deliberately spins down idle services to save resources.
**Consequences:** App appears broken on first open. Users abandon before the swipe deck loads. The problem is invisible in development (where the server is always warm).
**Prevention:**
- Use Render's Starter tier ($7/month) which has no spin-down — the only safe option for a production app.
- Alternatively, add a keep-alive pinger (UptimeRobot free tier pings every 5 minutes) to prevent spin-down, but this is against Render's ToS for free tier and can result in account suspension.
- Implement a splash screen loading state in the app that shows progress rather than a blank spinner, so a slow cold start feels intentional rather than broken.
- Pre-warm the server with a health-check endpoint hit from the app's startup sequence before making data requests.
**Detection:** Kill the server process, wait 20 minutes, then open the app fresh. Time the first API response.
**Phase to address:** Phase 1 (infrastructure) — budget for Render Starter from day one.

---

### Pitfall 9: Duplicate React Native Versions in Monorepo — Instant Crash

**Severity:** Critical
**What goes wrong:** In a pnpm + Turborepo monorepo, if `react-native` appears as a dependency in multiple `package.json` files (e.g., `apps/mobile/package.json` AND `packages/shared/package.json`), pnpm may hoist two different versions into `node_modules`. Metro bundler resolves modules by file path and will find both, causing duplicate React Native initialization — an immediate crash on app start with an error like `Invariant Violation: "main" has not been registered`.
**Why it happens:** pnpm's strict hoisting differs from npm/yarn. The `shamefully-hoist` flag and `.npmrc` configuration are critical. Metro also doesn't understand pnpm's symlink structure without explicit `watchFolders` configuration.
**Consequences:** App won't start at all. The error message is cryptic and doesn't point to the real cause (duplicate dependency).
**Prevention:**
- `react-native` must appear ONLY in `apps/mobile/package.json`, never in shared packages.
- Add `react-native` to `peerDependencies` (not `dependencies`) in any shared package that imports RN APIs.
- Configure `.npmrc` with `node-linker=hoisted` OR configure Metro's `resolver.nodeModulesPaths` to look at the monorepo root `node_modules`.
- Use `pnpm why react-native` after every `pnpm install` to verify only one version is resolved.
- Add a `turbo.json` pipeline that runs `pnpm why react-native | grep -c 'react-native '` and fails the build if count > 1.
**Detection:** `pnpm why react-native` from the monorepo root shows more than one version resolved. App crashes immediately on `expo start`.
**Phase to address:** Phase 1 (monorepo scaffold) — validate before writing any app code.

---

### Pitfall 10: Memory Crashes from 50+ Cards with Images in Swipe Deck

**Severity:** Critical
**What goes wrong:** Pre-rendering 50+ restaurant cards, each with a full-resolution Google Places photo loaded into a React Native `Image` component, exhausts device memory on low-end Android devices (2–3GB RAM). The OS kills the app process. On iOS, the app receives memory pressure warnings and eventually crashes. The crash is silent — no JS error, just process termination.
**Why it happens:** Each uncompressed restaurant photo at 1080p consumes ~3–6MB of GPU memory when decoded. 50 cards × 4MB = 200MB of image memory alone, exceeding the safe limit for low-end devices.
**Consequences:** App crashes mid-swipe session on real-world budget Android devices. Undetectable on high-RAM dev devices.
**Prevention:**
- Render only 3–5 cards at a time in the swipe stack (the visible card + 2 pre-loaded behind it).
- Use `rn-swiper-list`'s windowing/virtualization if available, or implement manual card recycling.
- Request resized photo URLs from the Google Places photo endpoint using the `maxWidthPx` / `maxHeightPx` parameters (400px is sufficient for card thumbnails).
- Implement explicit `Image` cache management — use `expo-image` instead of the built-in `Image` component, which has better memory management and a disk cache.
- Test specifically on a 2GB RAM Android emulator or device, not on a flagship simulator.
**Detection:** Profile memory in Android Studio's Memory Profiler while swiping through 30+ cards. Watch for memory climbing without release.
**Phase to address:** Phase 2 (swipe deck implementation).

---

## Moderate Pitfalls

Mistakes that cost days of debugging.

---

### Pitfall 1: PostGIS geography vs geometry Type Confusion

**Severity:** Moderate
**What goes wrong:** PostGIS has two spatial type systems: `geometry` (Cartesian plane, SRID-dependent) and `geography` (spherical earth, always WGS84). Mixing them in queries — e.g., using `ST_DWithin` with a `geometry` column but passing meters instead of degrees — produces silently wrong distance results. `ST_DWithin(geometry_col, point, 1000)` means 1000 *degrees* not 1000 meters on a geometry column, which returns every restaurant in the database.
**Why it happens:** `ST_DWithin` interprets the distance parameter differently depending on column type. `geography` columns interpret distance in meters (correct for restaurant discovery). `geometry` columns interpret distance in the column's native units (degrees for EPSG:4326, which is almost always wrong for distance queries).
**Prevention:**
- Declare all spatial columns as `geography(Point, 4326)`, not `geometry`.
- Always pass distance in meters to `ST_DWithin` — e.g., `ST_DWithin(location, ST_MakePoint(lng, lat)::geography, 5000)`.
- Add a GIST index on the `geography` column: `CREATE INDEX ON restaurants USING GIST (location)`.
- Write a unit test that inserts two known restaurants at a known distance and asserts `ST_DWithin` returns the expected result.
**Phase to address:** Phase 1 (database schema design).

---

### Pitfall 2: EAS Build Fails in Monorepo — Missing `eas.json` and Metro Config

**Severity:** Moderate
**What goes wrong:** EAS Build expects to find `eas.json` in the same directory as `app.json`. In a Turborepo monorepo where the Expo app lives at `apps/mobile/`, EAS Build run from the repo root fails to find either file. Additionally, Metro's default module resolver doesn't follow pnpm symlinks into the monorepo root's `node_modules`, causing "Unable to resolve module" errors during build.
**Why it happens:** EAS Build's monorepo support requires explicit `appDir` configuration in `eas.json` and correct `projectRoot`/`watchFolders` in `metro.config.js`. Without these, EAS treats the repo root as the app root.
**Consequences:** EAS Build fails immediately with a cryptic "no app.json found" error. Even after fixing, Metro build errors appear because shared packages symlinked by pnpm can't be resolved.
**Prevention:**
- Set `"appDir": "apps/mobile"` in the root `eas.json`.
- Configure `metro.config.js` in `apps/mobile/` to include `watchFolders: [path.resolve(__dirname, '../../')]` (the monorepo root) and `resolver.nodeModulesPaths: [path.resolve(__dirname, '../../node_modules')]`.
- Add a `turbo.json` `build` task that runs `eas build` from the correct directory.
- Use the official Expo monorepo template as a reference: `https://github.com/byCedric/eas-monorepo-example`.
**Phase to address:** Phase 1 (monorepo scaffold).

---

### Pitfall 3: Expo Router Deep Link / Navigation State Mismatch on Cold Start

**Severity:** Moderate
**What goes wrong:** Expo Router uses file-system routing. When a push notification deep-links into a specific route (e.g., `/(tabs)/picks`), and the user has no active session, Expo Router can render the target route before the auth state is loaded from AsyncStorage — causing a flash of authenticated content followed by a redirect to login, or worse, a navigation state error.
**Why it happens:** Expo Router's initial route resolution happens synchronously from the file system, but Supabase auth session restoration from AsyncStorage is async (can take 200–500ms). The window between "route rendered" and "auth state loaded" causes a race condition.
**Consequences:** Users see a flash of protected content before being redirected. In some cases, the navigation stack gets corrupted and the back button behaves unexpectedly.
**Prevention:**
- Use a root layout (`_layout.tsx`) that renders a loading splash until `supabase.auth.getSession()` resolves. The `SplashScreen.preventAutoHideAsync()` / `SplashScreen.hideAsync()` pattern in Expo is purpose-built for this.
- Protect all authenticated routes with a layout-level auth guard that redirects to `/login` if session is null and loading is false.
- Never render authenticated route content until `isLoading === false && session !== null`.
**Phase to address:** Phase 3 (auth integration).

---

### Pitfall 4: Supabase Auth Session Lost on App Foreground (React Native Background)

**Severity:** Moderate
**What goes wrong:** When an iOS app goes to background for an extended period (>10 minutes), the Supabase JS client's in-memory session can expire. When the app comes back to foreground, API calls return 401 — but if there's no `onAuthStateChange` listener connected to the app's foreground/background event, the session is never refreshed and the user appears logged out without actually being logged out.
**Why it happens:** Supabase uses JWT access tokens with a short expiry (default 1 hour) and refresh tokens with a long expiry. The auto-refresh logic in `@supabase/supabase-js` uses `setInterval`, which is suspended when the app is backgrounded on React Native. The token expires while backgrounded; the interval never fires to refresh it.
**Consequences:** Users return to a broken app state — the UI shows them as logged in (Zustand state persisted), but all API calls fail with 401. They must force-quit and reopen the app.
**Prevention:**
- Use `AppState` from React Native to detect foreground transitions and call `supabase.auth.startAutoRefresh()` on foreground and `supabase.auth.stopAutoRefresh()` on background.
- Configure the Supabase client with `auth: { autoRefreshToken: true, detectSessionInUrl: false }` (detectSessionInUrl must be false for React Native).
- Add a global axios/fetch interceptor that retries once with a forced token refresh on any 401 response.
**Phase to address:** Phase 3 (auth integration).

---

### Pitfall 5: rn-swiper-list Imperative API Requires Ref — No Programmatic Undo Without It

**Severity:** Moderate
**What goes wrong:** `rn-swiper-list` exposes swipe actions (swipe left, right, up, undo) via an imperative ref API (`useRef` + `ref.current.swipeLeft()`). If the ref is not properly attached to the `Swiper` component — which is common when the swiper is nested inside a conditional render or a `FlatList` — calling ref methods throws `Cannot read property 'swipeLeft' of null`. The undo button (a core Cravyr feature) becomes non-functional.
**Why it happens:** React refs are nullified when the component unmounts. If the swiper is conditionally rendered (e.g., hidden while loading), the ref is null during that window.
**Consequences:** Undo button crashes the app. Programmatic swipe animations (e.g., a "superlike" triggered by tapping a button) fail silently or crash.
**Prevention:**
- Always mount the `Swiper` component unconditionally; use `opacity: 0` or a loading overlay instead of conditional rendering.
- Guard all ref calls: `if (swiperRef.current) { swiperRef.current.swipeLeft(); }`.
- Test undo immediately after the first card loads, before any other interaction.
**Phase to address:** Phase 2 (swipe deck implementation).

---

### Pitfall 6: Reanimated v3 Worklet Debugging Is Near-Impossible

**Severity:** Moderate
**What goes wrong:** Code running in Reanimated v3 worklets executes on the native UI thread, completely outside the JS runtime. Errors in worklets produce cryptic native crash logs (`SIGABRT`, `EXC_BAD_ACCESS`) with no JavaScript stack trace. `console.log` does not work inside worklets. React Native's standard debugger (Hermes, Chrome DevTools) cannot inspect worklet state.
**Why it happens:** This is by design — worklets are compiled to native code by the Reanimated Babel plugin. The isolation that gives 60fps performance also makes debugging opaque.
**Consequences:** A bug in a gesture handler worklet (e.g., the swipe animation logic) can take hours to diagnose. The error "Your Reanimated version does not match" appears when the Reanimated Babel plugin is misconfigured, producing a build-time error that's hard to trace in a monorepo.
**Prevention:**
- Use `runOnJS` to call JS-thread functions from worklets for logging during development.
- Keep worklet code minimal — only the animation math. Move business logic (what to do after a swipe) to JS-thread callbacks via `runOnJS`.
- Ensure `react-native-reanimated/plugin` appears as the LAST entry in `babel.config.js` `plugins` array — order matters and placing it before other plugins breaks the worklet compilation.
- Verify `@react-native-reanimated` version matches between `apps/mobile` and any shared packages using it.
**Phase to address:** Phase 2 (swipe deck implementation).

---

### Pitfall 7: Google Places API (New) vs Legacy — Breaking Field Name Changes

**Severity:** Moderate
**What goes wrong:** The Google Places API (New) uses completely different field names from the legacy Places API. Legacy fields like `name`, `vicinity`, `price_level`, `opening_hours`, `photos` (array of objects) have been renamed to `displayName`, `formattedAddress`, `priceLevel`, `regularOpeningHours`, `photos` (array with different structure). Code written against legacy API examples (abundant on Stack Overflow) fails silently — the fields are just undefined, not errored.
**Why it happens:** Google's API (New) was a ground-up redesign. Legacy API continues to work but will be sunset. Most existing tutorials and StackOverflow answers still reference the legacy API.
**Consequences:** Restaurant names, addresses, and hours are all undefined in the UI. Photo references fail to load. Price level displays incorrectly. These bugs may not be caught until integration testing if unit tests use mocked legacy-format data.
**Prevention:**
- Use ONLY the official Places API (New) documentation (`developers.google.com/maps/documentation/places/web-service/op-overview`) — ignore all legacy Places API resources.
- Define a TypeScript interface for the Places API (New) response and use it throughout. The TypeScript compiler will catch field name mismatches.
- The field mask for a complete restaurant card: `places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.priceLevel,places.photos,places.regularOpeningHours,places.primaryTypeDisplayName,places.nationalPhoneNumber,places.websiteUri`.
**Phase to address:** Phase 2 (Google Places integration).

---

### Pitfall 8: Expo Push Notifications — Device Token Invalidation Not Handled

**Severity:** Moderate
**What goes wrong:** Expo Push Notification tokens (EPNs) are not permanent. They are invalidated when a user uninstalls and reinstalls the app, resets their device, or disables/re-enables notifications. If your backend stores a token in Supabase and never checks for `DeviceNotRegistered` errors from the Expo Push API, you accumulate stale tokens and miss-send notifications to real users.
**Why it happens:** The Expo Push API returns `DeviceNotRegistered` or `InvalidCredentials` receipt errors for expired tokens. These errors are only available via the receipts endpoint (a separate async check), not the initial send response.
**Consequences:** Notification delivery rate degrades silently over time. High bounce rate can cause Expo to throttle your push sends. Push notification debugging is difficult because the failure is asynchronous.
**Prevention:**
- Implement the two-step Expo Push flow: send via `/send`, then check `/getReceipts` with the ticket IDs 15–30 minutes later.
- On `DeviceNotRegistered` receipt error, delete that push token from Supabase.
- Re-register the push token every time the app opens and the user is authenticated — upsert, not insert.
**Phase to address:** Phase 4 (push notifications).

---

### Pitfall 9: Turborepo Task Pipeline Caching Stales Native Builds

**Severity:** Moderate
**What goes wrong:** Turborepo's task caching is designed for pure build artifacts (JS bundles, transpiled packages). If `turbo build` is configured to cache the EAS build output or native binary, Turborepo can serve a cached artifact even when native code has changed — resulting in a production build that's missing native module changes or uses the wrong binary.
**Why it happens:** Turborepo uses file hashing to determine cache validity. If native files (`ios/`, `android/`) aren't included in the hash inputs, Turborepo considers the task up-to-date and returns a cached result.
**Consequences:** A `eas build` run via Turborepo returns the previous build without error. The deployed app is missing native changes. This is especially dangerous for Reanimated v3 (native module) and PostGIS pgvector extension changes.
**Prevention:**
- Do NOT cache EAS build tasks in `turbo.json`. Mark the build task with `"cache": false`.
- Use Turborepo caching only for pure JS tasks: `type-check`, `lint`, `test`, `build` of shared packages.
- Run `eas build` directly, not through `turbo run build`.
**Phase to address:** Phase 1 (monorepo scaffold).

---

## Minor Pitfalls

Hours of debugging, annoying but recoverable.

---

### Pitfall 1: Supabase RLS Row-Level Security Kills Query Performance

**What goes wrong:** Default RLS policies using `auth.uid()` re-evaluate the function on every row in a table scan. On a `swipe_events` table with 100K+ rows, a query like `SELECT * FROM swipe_events WHERE user_id = auth.uid()` with a naive RLS policy can take seconds instead of milliseconds.
**Prevention:** Use `(SELECT auth.uid())` (with parentheses, making it a subquery) instead of `auth.uid()` directly in RLS policies. This causes Postgres to evaluate the expression once per query rather than once per row — up to 99% faster. Add this as a lint rule checked in code review.

---

### Pitfall 2: AsyncStorage Supabase Session Adapter Not Set — Sessions Lost on App Restart

**What goes wrong:** By default, `@supabase/supabase-js` uses `localStorage` for session persistence, which doesn't exist in React Native. Without configuring the `AsyncStorage` adapter, users are logged out on every app restart.
**Prevention:** Initialize the Supabase client with `auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false }`. This requires `@react-native-async-storage/async-storage` as a dependency. Easy to miss because the app "works" in Expo Go (which has a custom localStorage shim) but breaks in production builds.

---

### Pitfall 3: Expo SDK Version Lock — Can't Use Latest Reanimated Without SDK Upgrade

**What goes wrong:** Expo SDK pins compatible versions of all native libraries. Using `react-native-reanimated` at a version higher than what the current Expo SDK supports causes build failures or runtime crashes. Upgrading Reanimated to get a bug fix may require a full Expo SDK upgrade, which is a non-trivial migration.
**Prevention:** Check `https://docs.expo.dev/versions/latest/` for the exact Reanimated version supported by your Expo SDK before upgrading either. Pin exact versions in `package.json`, not ranges.

---

### Pitfall 4: Zustand Persist Middleware Hydration Lag Causes UI Flash

**What goes wrong:** Zustand's `persist` middleware rehydrates from AsyncStorage asynchronously. Components that render before hydration is complete see the initial (empty) state, causing a flash of "not logged in" or empty preferences UI even for returning users.
**Prevention:** Use Zustand's `onRehydrateStorage` callback to set a `hasHydrated` flag, and render a loading screen until `hasHydrated === true`. Alternatively, use the `useHydration` hook pattern documented in the Zustand docs.

---

### Pitfall 5: Android Swipe Gesture Conflicts with React Navigation Drawer/Back

**What goes wrong:** React Native's Android back gesture and React Navigation's swipe-to-go-back gesture can intercept horizontal swipe gestures intended for the card swiper. Users trying to swipe left on a restaurant card instead trigger a navigation-back action.
**Prevention:** Wrap the swipe deck screen with `gestureEnabled: false` in the React Navigation screen options. Use `react-native-gesture-handler`'s `GestureHandlerRootView` at the app root and ensure all gesture handlers use RNGH, not the built-in RN touch system. Test on Android physical device specifically — emulators don't replicate Android back gesture behavior accurately.

---

### Pitfall 6: `expo-location` Returns Stale Coordinates on iOS Without Fresh Permission Request

**What goes wrong:** On iOS, if the user granted location permission a long time ago and has moved significantly, `expo-location`'s `getCurrentPositionAsync` with `accuracy: Low` can return a cached location from hours ago. The user sees restaurants from their home location when they're actually downtown.
**Prevention:** Use `accuracy: Balanced` or higher for the initial location fetch. Set `maximumAge: 60000` (60 seconds) to reject cached results older than 1 minute. Always show the user's detected neighborhood name so they can spot incorrect location.

---

### Pitfall 7: pnpm Phantom Dependencies — Shared Package Imports Break in Production Builds

**What goes wrong:** In a pnpm monorepo, `packages/shared` can accidentally import a package that is installed in `apps/mobile` but not listed in `packages/shared/package.json`. This works locally because pnpm's `node_modules` structure sometimes makes the dependency accessible, but EAS Build creates an isolated build environment where only declared dependencies are available, causing "Cannot find module" errors during cloud builds.
**Why it happens:** pnpm's strict isolation is correct behavior — the phantom dependency was always wrong. But it only manifests as a failure in EAS Build's isolated environment, not in local development.
**Prevention:** Run `pnpm ls --depth=1` in `packages/shared/` and verify every import has a corresponding `package.json` entry. Add a CI step that runs `tsc --noEmit` from the `packages/shared/` directory in isolation.

---

### Pitfall 8: Google Places `regularOpeningHours` Missing for New/Unverified Businesses

**What goes wrong:** The `regularOpeningHours` field in the Places API (New) is not present for businesses that haven't been claimed or verified by their owners. For a restaurant discovery app, this means a significant percentage of restaurants (especially new or small establishments) will have no hours data. UI components that destructure `regularOpeningHours.weekdayDescriptions` without null-checking will crash.
**Prevention:** Treat all Places API fields except `id`, `displayName`, and `location` as potentially undefined. Use optional chaining everywhere: `place.regularOpeningHours?.weekdayDescriptions ?? ['Hours not available']`. Test with places known to have sparse data (new restaurants, food trucks).

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|----------------|------------|
| Monorepo setup | Duplicate RN versions crash Metro immediately | `pnpm why react-native` after every install; RN only in `apps/mobile` deps |
| Monorepo setup | Turborepo caching EAS builds returns stale native artifacts | Set `"cache": false` for build tasks in `turbo.json` |
| Monorepo setup | pnpm phantom dependencies break EAS cloud builds | Explicit deps in every `package.json`; CI isolation check |
| Infrastructure | Render cold starts break first impression | Budget $7/month for Render Starter tier from day one |
| Infrastructure | Supabase auto-pause after 7 days | Add keep-alive cron (SELECT 1 every 3 days) before any integration |
| Database schema | PostGIS geometry vs geography distance math is silently wrong | Use `geography(Point, 4326)` exclusively; unit-test `ST_DWithin` with known coordinates |
| Database schema | Supabase 500MB limit → read-only mode with no warning | Cache only `place_id` in Supabase; fetch restaurant data on demand from Places API |
| Google Places integration | Field mask omission = $30K/month billing | Mandatory field mask middleware in Express; billing alert at $50/day |
| Google Places integration | Photo URLs expire; storing them breaks returning user images | Store only `photo_reference`; generate signed URLs server-side with node-cache TTL |
| Google Places integration | Legacy API field names silently return undefined | TypeScript interface for Places API (New); reject all legacy-format code/examples |
| Swipe card implementation | Memory crashes on low-end Android with 50+ cards | Render 3–5 cards max; `expo-image`; resize photos to 400px via API params |
| Swipe card implementation | rn-swiper-list imperative ref is null on conditional render | Mount swiper unconditionally; guard all `ref.current` calls |
| Swipe card implementation | Reanimated worklet errors have no JS stack trace | `runOnJS` for logging; keep worklet code minimal; Reanimated plugin last in Babel config |
| Swipe card implementation | Android back gesture intercepts horizontal swipes | `gestureEnabled: false` on swipe screen; RNGH root at app level |
| Auth integration | Apple Sign-In name only on first login | Persist name immediately on first sign-in; add editable name prompt in onboarding |
| Auth integration | Supabase session expires while app is backgrounded | `AppState` listener to call `startAutoRefresh`/`stopAutoRefresh` |
| Auth integration | AsyncStorage adapter not configured → session lost on restart | Configure Supabase client with AsyncStorage storage adapter from day one |
| Auth integration | Expo Router renders protected routes before auth state loads | Loading splash until `supabase.auth.getSession()` resolves; layout-level auth guard |
| Push notifications | Stale device tokens accumulate silently | Two-step Expo Push flow; check receipts; delete `DeviceNotRegistered` tokens |
| App Store submission | Skeleton MVP rejected (~40% rate) | All screens functional before submission: onboarding, detail, picks, settings, delete-account |
| App Store submission | Generic location permission string triggers rejection | Specific `NSLocationWhenInUseUsageDescription` in `app.json`; `WhenInUse` only |

---

## Sources

- **PROJECT.md** — Cravyr project constraints, stack decisions, and known pitfalls (confidence: primary source)
- **Google Places API (New) official documentation** — Field mask billing tiers, photo reference handling, field name changes from legacy API (confidence: high — based on training data through Aug 2025; verify current billing SKUs at `developers.google.com/maps/documentation/places/web-service/usage-and-billing`)
- **Supabase official documentation** — Free tier limits, auto-pause policy, RLS performance patterns, React Native auth setup (confidence: high — verify current limits at `supabase.com/docs/guides/platform/org-based-billing`)
- **Expo documentation** — EAS Build monorepo configuration, Expo Router auth patterns, push notification two-step flow (confidence: high — verify at `docs.expo.dev`)
- **Render documentation** — Free tier spin-down behavior, Starter tier pricing (confidence: high — verify current pricing at `render.com/pricing`)
- **react-native-reanimated documentation** — Worklet debugging limitations, Babel plugin ordering requirements (confidence: high — verify at `docs.swmansion.com/react-native-reanimated`)
- **rn-swiper-list GitHub** — Imperative ref API design, conditional render gotchas (confidence: moderate — based on library design patterns; verify open issues at `github.com/Skipperlla/rn-swiper-list/issues`)
- **pnpm + Turborepo monorepo community knowledge** — Phantom dependency behavior, Metro resolver configuration for pnpm symlinks (confidence: high — well-documented ecosystem issue)
- **PostGIS documentation** — `geography` vs `geometry` type behavior with `ST_DWithin` (confidence: high — fundamental PostGIS behavior, unchanged)
- **Apple App Store Review Guidelines** — Minimum functionality (4.0), privacy strings, Apple Sign-In requirements, account deletion requirement (confidence: high — verify current guidelines at `developer.apple.com/app-store/review/guidelines/`)

> **Recommendation:** Re-run live web research (WebSearch/WebFetch) when those tools become available to validate rn-swiper-list specific bugs, latest EAS Build monorepo docs, and current Google Places API billing SKU structure, as these areas change frequently.
