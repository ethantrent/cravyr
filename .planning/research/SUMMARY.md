# Research Summary: Cravyr

**Domain:** Swipe-based restaurant discovery mobile app
**Researched:** 2026-04-06
**Overall confidence:** MEDIUM

---

## Executive Summary

Cravyr is a Tinder-style restaurant discovery app built on a well-understood but version-sensitive stack. The product premise — swipe right to save, left to skip, up to superlike, powered by a PostGIS recommendation engine — is straightforward to describe but technically demanding to execute correctly. The single most critical engineering decision is the Google Places API proxy layer: a naïve implementation costs ~$30K/month at 1K DAU; the optimized field mask + geographic cluster batching + node-cache approach brings that to $150–275/month. This cost control architecture must be the first thing built, not the last.

The stack has meaningful version drift from the project's original assumptions. Expo SDK 55 (not 52), Reanimated v4 (not v3), and rn-swiper-list 3.0.0 introducing `react-native-worklets` as a new required peer dependency are the three changes that require explicit action before writing implementation code. Express 5 and Zustand 5 are additive improvements with minimal migration cost. The overall stack is sound — the choices are well-justified and alternatives were correctly rejected. The risk is not in the stack selection but in the setup details: pnpm `node-linker=hoisted`, Metro `watchFolders`, the Reanimated Babel plugin position, and the Supabase React Native client configuration all have exact-or-broken failure modes.

App Store compliance is a first-class engineering constraint, not a post-launch concern. Apple's ~40% first-submission rejection rate for skeleton MVPs means the full core loop — onboarding, swipe deck with real data, restaurant detail view, Tonight's Picks, user preferences, settings with account deletion — must be complete before the first submission attempt. Apple Sign-In is mandatory given Google Sign-In is offered, and the name-on-first-login-only behavior requires a specific implementation pattern captured at sign-in time. The recommended build order (monorepo scaffold → API + DB → auth → swipe core → secondary screens → App Store) maps directly to dependency order and risk reduction.

Infrastructure choices favor simplicity over scale-readiness, which is correct for an MVP: Render Starter ($7/month) over free tier (eliminates cold start problem), Supabase Pro ($25/month) before public launch (eliminates auto-pause), in-memory node-cache over Redis, PostGIS SQL scoring function over ML. The total operational cost ceiling is ~$325/month at 1K DAU, well within a solo developer's budget.

---

## Key Findings

### Stack

- **Expo SDK 55** is current stable — all SDK-versioned packages (expo-image 55.0.8, expo-router 55.0.10) are already aligned. Any SDK 52-specific guides are outdated.
- **Reanimated v4.3.0** — all project documentation references "v3"; mentally substitute v4. Core worklet APIs are forward-compatible but verify import paths and changelog before writing animation code.
- **rn-swiper-list 3.0.0** adds `react-native-worklets` as a new required peer dependency (separate package, result of Reanimated v4 splitting worklets out). Must be installed explicitly in `apps/mobile/package.json` — confirm exact package name (`react-native-worklets` vs `react-native-worklets-core`) from the library's README before installing.
- **Express 5.2.1** is now GA and is the npm `latest` tag. Async route handlers auto-propagate errors — no `try/catch` boilerplate needed. Use it.
- **Zustand 5.0.12** — minimal migration from v4. `create` must use a function form (was already the pattern). Use v5.
- **Supabase JS v2.101.1** — requires `detectSessionInUrl: false` and `AsyncStorage` adapter in React Native. Omitting either causes runtime crashes or session loss on restart.
- **pnpm `node-linker=hoisted`** in root `.npmrc` is mandatory for Metro and EAS Build. Must be set before the first `pnpm install`.
- **`npx expo install`** is preferred over `pnpm add` for any SDK-versioned package — it resolves the correct version for the installed SDK automatically.

### Features

- **Table stakes (must ship):** Swipe deck at 60fps (right/left/up + undo), location-based deck via Google Places API, user account with email + Google + Apple Sign-In, onboarding flow, restaurant detail view, Tonight's Picks list, user preferences screen, settings screen with delete-account, empty state and location-denied fallback handling, daily 6PM push notification.
- **App Store hard requirements:** Apple Sign-In mandatory when Google Sign-In is offered; full name must be captured and persisted on first Apple Sign-In only (Apple sends it once); `NSLocationWhenInUseUsageDescription` must be specific (not generic); account deletion must be discoverable in-app (guideline 5.1.1, enforced since 2022); location permission denied must show graceful fallback — not a crash or blank screen; push notification permission must not be requested on cold launch before core value is demonstrated.
- **Differentiators to ship in v1:** Superlike (swipe up) is already part of the gesture set — store as separate `interaction_type` at zero extra UI cost. Daily 6PM push notification is the highest-ROI retention mechanism. PostGIS recommendation scoring (distance 35%, cuisine 30%, rating 20%, price 15%) is invisible to users but reduces churn.
- **Defer to v1.1:** Closing-soon alerts (per-pick cron scan complexity), search (conflicts with swipe paradigm), social features (requires graph, moderation), booking/reservations (deep-link to website instead), group decision mode (real-time infra, explicitly out of scope).
- **Anti-features to avoid entirely:** In-app reviews (duplicate of Google data, moderation burden), Yelp API (24hr cache limit, ToS hostile for swipe apps), downloading Google photos to own CDN (ToS violation), dark mode as v1 requirement.

### Architecture

- **Three-component system:** React Native mobile app (Expo SDK 55, Expo Router, Zustand v5) → Express v5 API proxy on Render (Places calls, field masks, geographic cluster cache) + Supabase direct (auth, user data). Mobile never calls Google Places directly — API key would be extractable from the bundle.
- **Monorepo structure:** `apps/mobile` + `apps/api` + `packages/shared` (@cravyr/shared — Zod schemas, TypeScript types shared by both apps). Turborepo 2.9.4 with pnpm workspaces. `packages/shared` uses `.ts` source as `main` — Metro and tsc handle transpilation; no separate compile step during development.
- **Three Zustand stores, strict separation:** `deckStore` (card queue, swipe history, undo stack), `authStore` (Supabase session, user identity), `preferencesStore` (cuisine/price/distance filters). Cross-store reads via `getState()` in actions — not nested, not circular.
- **Swipe recording flow:** Animation runs on native UI thread via Reanimated worklet (no JS involvement during gesture). JS callback fires after animation via `runOnJS`. Supabase INSERT is fire-and-forget (does not block swipe UX). DB trigger auto-populates `saved_restaurants` on right-swipe/superlike — no extra round-trip from mobile.
- **Geographic cluster batching:** Snap lat/lng to 0.1° grid (~11km cells) before using as cache key. One Places API call per cell, 24h TTL. Users moving within an 11km area always hit cache. Reduces Places API calls from per-user to per-geographic-area.
- **Recommendations activate after 10 swipes:** PostGIS SQL function scores restaurants by distance + cuisine match + rating + price level + novelty penalty (30-day swiped exclusion). 7-day swipe exclusion prevents re-showing recently swiped places.
- **Card rendering budget:** 7 cards max in `visibleCards` (passed to SwipeDeck). Full queue held in store. Prefetch threshold at 10 remaining triggers background refetch. `expo-image` prefetches photos for next 3 cards only.
- **RLS performance:** Always use `(SELECT auth.uid())` in policies — evaluated once per statement instead of once per row. Up to 99% faster on large tables.

### Critical Pitfalls

1. **Google Places field mask omission ($30K/month trap):** No `X-Goog-FieldMask` header defaults to Preferred billing tier. At 1K DAU with no mask = ~$30K/month. Mitigation: mandatory field mask middleware in Express before any Places fetch code; billing alert at $50/day; geographic cluster batching (one call per cell, not per user).
2. **Google Places photo URLs expire:** Full photo URIs expire within hours to days. Storing them in Supabase causes broken images for returning users. Mitigation: store only `photo_reference` string; generate signed URLs server-side on demand with short TTL (1–4 hours in node-cache).
3. **Supabase free tier auto-pause after 7 days:** Project pauses after 7 days of no DB activity. Cold resume takes 30–60 seconds — user-facing 503. Mitigation: keep-alive cron (`SELECT 1 FROM restaurants LIMIT 1` every 3 days); upgrade to Supabase Pro ($25/month) before public launch.
4. **Apple Sign-In full name only on first authorization:** `givenName`/`familyName` return `null` on all subsequent sign-ins. Mitigation: immediately upsert user row with name before any navigation on first sign-in; add editable name prompt in onboarding as fallback.
5. **Duplicate React Native versions in monorepo — instant crash:** `react-native` in multiple `package.json` files causes Metro to find two instances. App crashes with `Invariant Violation: "main" has not been registered`. Mitigation: `react-native` only in `apps/mobile/package.json`; use `peerDependencies` in shared packages; run `pnpm why react-native` after every install.
6. **rn-swiper-list imperative ref null on conditional render:** Mounting Swiper conditionally nullifies the ref. Undo and programmatic swipe calls crash. Mitigation: mount Swiper unconditionally; guard all `ref.current` calls; use loading overlay instead of conditional render.
7. **Render free tier cold starts (25–60 seconds):** Free tier spins down after 15 minutes idle. Mitigation: use Render Starter ($7/month) from day one — no spin-down.
8. **Supabase 500MB free tier DB limit → silent read-only mode:** Writes fail silently when limit exceeded. Mitigation: cache only `place_id` + metadata in Supabase; fetch restaurant data on demand; monitor DB size weekly.
9. **App Store minimum functionality (~40% first-submission rejection):** Skeleton MVP with missing screens is near-guaranteed rejection. Mitigation: all screens functional before submission (onboarding, detail, picks, preferences, settings, delete account).
10. **Reanimated worklet debugging is opaque:** Worklet errors produce native crash logs with no JS stack trace. `console.log` does not work in worklets. Mitigation: `runOnJS` for logging from worklets; keep worklet code minimal (animation math only); move business logic to JS-thread callbacks.

---

## Implications for Roadmap

Based on research, suggested phase structure:

1. **Phase 1: Monorepo Scaffold + Infrastructure** — All fatal setup mistakes happen here; fix them once before writing app code.
   - Addresses: Turborepo + pnpm workspace, `.npmrc` with `node-linker=hoisted`, `pnpm-workspace.yaml`, `turbo.json`, `metro.config.js` with `watchFolders`, `packages/shared` skeleton, Render Starter account provisioning, Supabase project + PostGIS extension + schema migrations + RLS policies + keep-alive cron setup
   - Avoids: Duplicate RN version crash, EAS build failure in monorepo, Turborepo caching staling native builds (`"cache": false` on build task), pnpm phantom dependencies, Supabase auto-pause, Render cold starts
   - Research flag: NO — monorepo setup is well-documented; architecture file provides exact config snippets

2. **Phase 2: Google Places API Proxy + Database Layer** — The highest financial risk component; validate cost behavior before building any UI.
   - Addresses: Express v5 API (`GET /restaurants/nearby`, `GET /restaurants/:id`), field mask enforcement middleware, geographic cluster batching + node-cache (24h TTL), `place_id` permanent upsert to Supabase, `photo_reference` storage pattern, PostGIS `get_recommendations` SQL function, all required indexes (GIST spatial, GIN cuisine array, swipe composite)
   - Avoids: $30K/month Places billing trap, expiring photo URL storage, PostGIS geometry vs geography confusion, legacy Places API field names (use TypeScript interface for Places API New response)
   - Research flag: YES — verify rn-swiper-list 3.0.0 exact `react-native-worklets` peer dep package name before Phase 3; verify Reanimated v4 Babel plugin name change if any

3. **Phase 3: Authentication + Onboarding** — Identity before features; App Store review requires a complete auth flow.
   - Addresses: Supabase auth integration with AsyncStorage adapter (`detectSessionInUrl: false`), email/password + Google + Apple Sign-In, `authStore` (Zustand), Apple first-login name capture and upsert, onboarding flow (location permission with specific `NSLocationWhenInUseUsageDescription`, cuisine preferences, price range, account creation), `AppState` listener for background session refresh, root layout auth guard with `SplashScreen` gating until `getSession()` resolves
   - Avoids: Apple Sign-In name loss on subsequent logins, Supabase session loss on app restart (AsyncStorage adapter), auth state race condition with Expo Router (render before session loaded), backgrounded app 401 errors
   - Research flag: NO — auth patterns are well-documented; pitfalls file provides exact implementation guidance

4. **Phase 4: Swipe Core + Secondary Screens** — The product's value proposition; validate 60fps on real low-end Android hardware before declaring done.
   - Addresses: `deckStore` (Zustand), `SwipeDeck` component with rn-swiper-list v3 (unconditional mount, ref guard), `RestaurantCard` with expo-image (7-card visible limit, photo prefetch for next 3, 400px photo resize via API params), swipe→record→advance loop, fire-and-forget Supabase INSERT, DB trigger for Tonight's Picks auto-population, undo (single depth), superlike, restaurant detail view (lazy-load Preferred-tier fields on tap), Tonight's Picks screen (`saved.tsx`), user preferences screen, settings screen (sign-out, delete account), empty state and location-denied fallback
   - Avoids: Memory crash from 50+ cards with full-res images (7-card budget + expo-image + 400px resize), rn-swiper-list ref null crash (unconditional mount), Android back gesture intercepting horizontal swipes (`gestureEnabled: false` + RNGH root), Reanimated worklet debugging pain (minimal worklet code, `runOnJS` for logging)
   - Research flag: YES — verify rn-swiper-list v3 exact prop names (`stackSize` or equivalent), imperative ref API shape, and `react-native-worklets` peer dep package name against v3.0.0 README before implementation

5. **Phase 5: Push Notifications + App Store Submission** — Highest-ROI retention mechanism plus the compliance gate.
   - Addresses: Expo Push Notifications token registration (upsert on every authenticated app open), daily 6PM cron job (Render Cron or GitHub Actions, user timezone stored at signup), two-step push flow (send → check receipts 15–30 min later → delete `DeviceNotRegistered` tokens), `NSLocationWhenInUseUsageDescription` specific string in `app.json`, EAS build configuration (`eas.json`), TestFlight beta with non-developer users, App Store submission
   - Avoids: Stale push token accumulation (two-step receipt check), App Store rejection for skeleton MVP (all screens complete from Phase 4), generic location permission string rejection, App Store rejection for missing delete-account (already in settings from Phase 4)
   - Research flag: NO — Expo Push Notifications patterns are well-documented and stable

**Phase ordering rationale:**
- Phase 1 before everything: monorepo setup mistakes corrupt all subsequent work. `node-linker=hoisted` must be set before the first `pnpm install`.
- Phase 2 before Phase 3: the Express API layer must exist for the swipe deck to fetch data; validating cost behavior early prevents a billing surprise that would require architecture changes later.
- Phase 3 before Phase 4: user identity is a dependency of swipe event recording, Tonight's Picks persistence, and preferences. The onboarding flow must also be testable end-to-end before the swipe deck has meaning.
- Phase 4 before Phase 5: push notifications reference Tonight's Picks data that must exist; the App Store submission requires all Phase 4 screens to be complete.

**Research flags for phases:**
- Phase 2 (end): Verify exact `react-native-worklets` peer dep package name from rn-swiper-list 3.0.0 README. High risk of name mismatch (`react-native-worklets` vs `react-native-worklets-core`) that would cause a silent install failure.
- Phase 4 (start): Verify Reanimated v4 Babel plugin name, rn-swiper-list v3 prop API (particularly `stackSize`/`prerenderItems` naming), and imperative ref method names against the actual v3.0.0 library source before writing SwipeDeck implementation.
- All others: Standard patterns, unlikely to need additional research beyond what's documented here.

---

## Version Alerts

| Flag | Impact |
|------|--------|
| **Expo SDK 55** (not 52 as assumed in PROJECT.md) | All SDK-versioned package versions are already aligned to SDK 55 in the research. No action on version numbers, but SDK 52 workarounds in external guides are outdated. Prefer `npx expo install` over `pnpm add` for all SDK-managed packages. |
| **Reanimated v4.3.0** (not v3 as stated throughout PROJECT.md and CLAUDE.md) | Major version bump. Core worklet APIs expected forward-compatible but verify import paths and v4 changelog before writing animation code. All references to "Reanimated v3" in project docs should be read as "Reanimated v4." |
| **rn-swiper-list 3.0.0 — new required peer dep: `react-native-worklets`** | Reanimated v4 extracted worklets into a separate package. This peer dep did not exist in rn-swiper-list 2.x. Must be installed explicitly in `apps/mobile/package.json`. Confirm exact package name (`react-native-worklets` vs `react-native-worklets-core`) from v3.0.0 README before installing — do not guess. |
| **Express 5.2.1** (Express 5 is now GA, not beta) | Async route handlers auto-propagate errors — no `try/catch` per handler. Use it. `path-to-regexp` upgrade changes wildcard route syntax — check catch-all routes. No other breaking changes affecting this project. |
| **Zustand 5.0.12** (v5 is out) | `create` must use function form (already the pattern in v4). `immer` and `devtools` middleware have updated type signatures. Migration from v4 examples online is minimal. |

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Version numbers confirmed from live npm registry (2026-04-06). Compatibility details (peer dep resolution, Reanimated v4 API surface, rn-swiper-list v3 prop names) are from training knowledge (cutoff Aug 2025) and must be verified against official docs before implementation. Supabase and Turborepo are HIGH confidence. |
| Features | HIGH | Table stakes, App Store requirements, and feature dependencies are well-established. Apple guidelines, Google Places ToS, and swipe-app UX patterns are from authoritative primary sources with minimal ambiguity. |
| Architecture | HIGH | Core patterns (Google Places proxy, geographic cluster batching, PostGIS `ST_DWithin`, Zustand store separation, Reanimated worklet/JS thread boundary, RLS `(SELECT auth.uid())` optimization) are all well-documented, primary-source-backed architectural decisions. Configuration files (`.npmrc`, `metro.config.js`, `turbo.json`) have HIGH confidence as documented Expo monorepo requirements. |
| Pitfalls | HIGH | Critical pitfalls are grounded in primary source documentation (Google Places billing, Apple guidelines, Supabase free tier behavior, Render cold starts). Failure modes are specific and actionable. The one area requiring live verification: rn-swiper-list v3-specific behavior (ref API, peer dep name). |

---

## Gaps to Address

- **rn-swiper-list v3.0.0 peer dependency exact package name** — must be confirmed from the library README before Phase 4 begins. Do not install without confirming `react-native-worklets` vs `react-native-worklets-core`.
- **Reanimated v4 Babel plugin name** — verify whether the v4 plugin is still `react-native-reanimated/plugin` or has been renamed. This is the last plugin in `babel.config.js` and order matters.
- **rn-swiper-list v3 prop API** — verify exact prop names for `prerenderItems`/`stackSize` equivalent, and confirm imperative ref method names (`swipeLeft`, `swipeRight`, `swipeTop`, `goBack`) against v3.0.0 source before writing `SwipeDeck.tsx`.
- **Google Places API current billing SKUs** — the research notes pricing current as of training cutoff August 2025. Verify current Essentials/Pro/Enterprise tier pricing and field groupings at `developers.google.com/maps/documentation/places/web-service/usage-and-billing` before the Phase 2 cost analysis.
- **Supabase free tier current limits** — the 500MB database limit and 7-day auto-pause policy should be verified at `supabase.com/docs/guides/platform/org-based-billing` as these have changed historically.
- **Render Starter tier current pricing** — verify the $7/month figure and that Starter tier has no spin-down at `render.com/pricing` before committing to this infrastructure choice.
- **Push notification timezone handling** — the daily 6PM cron requires user timezone stored at signup. The research identifies this requirement but does not specify the exact implementation (server-side per-user cron vs a single cron that queries per-timezone groups). This needs a design decision in Phase 5.
