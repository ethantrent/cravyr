# Cravyr Roadmap

## Milestone 1: MVP

**Goal:** Ship a complete, App-Store-ready swipe-based restaurant discovery app.

## Phases

- [ ] **Phase 1: Monorepo Scaffold + Infrastructure** — Turborepo/pnpm workspace, Supabase schema + PostGIS + RLS, Render account provisioning
- [ ] **Phase 2: API + Database Layer** — Express v5 backend, Google Places proxy with field masks + caching, PostGIS recommendation function
- [ ] **Phase 3: Authentication + Onboarding** — Supabase auth (email + Google + Apple), onboarding flow, Expo Router auth guard
- [ ] **Phase 4: Swipe Core + Secondary Screens** — SwipeDeck component, swipe recording, Tonight's Picks, detail view, preferences, settings (gap closure in progress)
- [ ] **Phase 5: Push Notifications + App Store Submission** — Expo Push, daily 6PM cron, EAS build, TestFlight, App Store submission

## Phase Details

### Phase 1: Monorepo Scaffold + Infrastructure
**Goal**: Developers can run the monorepo locally without error, and the Supabase database is live with PostGIS, schema migrations, RLS policies, and a keep-alive cron — so no subsequent phase inherits a broken foundation.
**Depends on**: Nothing
**Requirements**: INFRA-01, API-02
**Success Criteria** (what must be TRUE):
  1. Developer can run `pnpm dev` from the monorepo root and see both `apps/mobile` (Expo) and `apps/api` (Express) start without errors.
  2. `pnpm why react-native` from the repo root shows exactly one instance — no duplicate React Native version in the dependency tree.
  3. The Supabase project has PostGIS enabled, schema migrations applied, and RLS policies active — a `SELECT * FROM restaurants LIMIT 1` query returns without error.
  4. A keep-alive cron is configured and confirmed to fire against the Supabase database (prevents 7-day auto-pause on free tier).
  5. Render Starter service is provisioned and a health-check endpoint (`GET /health`) on the Express API returns 200 with no cold-start spin-down.
**Plans**: TBD
**UI hint**: no

### Phase 2: API + Database Layer
**Goal**: The Express API correctly proxies Google Places with field masks enforced, geographic cluster caching active, and the PostGIS recommendation function returning scored results — so the financial risk of a $30K/month Places billing trap is eliminated before any UI is written.
**Depends on**: Phase 1
**Requirements**: API-01
**Success Criteria** (what must be TRUE):
  1. `GET /restaurants/nearby?lat=XX&lng=YY` returns a JSON array of restaurants drawn from the geographic cluster cache — a second call with the same coordinates does NOT trigger a new Places API request (cache hit confirmed via server logs).
  2. Every outbound Places API request includes the `X-Goog-FieldMask` header — confirmed by inspecting Express middleware logs; no unmasked request reaches Google.
  3. `GET /restaurants/:id` returns restaurant detail including `photo_reference` strings (not expiring photo URLs) — photo references are stored in Supabase `place_id`-keyed rows.
  4. The PostGIS `get_recommendations` SQL function executes without error and returns restaurants scored by distance + cuisine + rating + price, excluding place_ids swiped in the last 7 days.
  5. A billing alert is configured in Google Cloud at $50/day and verified to send a test notification.
**Plans**: TBD
**UI hint**: no

### Phase 3: Authentication + Onboarding
**Goal**: A brand-new user can complete the full onboarding flow — grant location, set cuisine/price preferences, and create an account via email, Google, or Apple Sign-In — and their session persists across app restarts.
**Depends on**: Phase 2
**Requirements**: AUTH-01, UX-01
**Success Criteria** (what must be TRUE):
  1. User can create an account with email/password and their session is still active after closing and reopening the app (Supabase AsyncStorage adapter working).
  2. User can sign in with Google Sign-In — their display name and avatar are persisted in the Supabase `users` table.
  3. User can sign in with Apple Sign-In — their full name is captured and persisted on first sign-in; a second sign-in with the same Apple account does not lose the previously saved name.
  4. New user is routed through onboarding before reaching the swipe deck: location permission prompt fires with a specific (non-generic) description string, and cuisine/price preferences are collected and saved.
  5. If location permission is denied, the app shows a graceful fallback screen (not a crash or blank screen) with instructions to enable location in Settings.
**Plans**: TBD
**UI hint**: yes

### Phase 4: Swipe Core + Secondary Screens
**Goal**: The complete core product loop is functional — a logged-in user can swipe through real restaurant cards at 60fps, save picks, view restaurant detail, manage preferences, and access all settings — passing App Store minimum functionality requirements.
**Depends on**: Phase 3
**Requirements**: CORE-01, CORE-02, CORE-03, CORE-04, UX-02
**Success Criteria** (what must be TRUE):
  1. Swiping right on a restaurant card causes it to appear in the Tonight's Picks list without any additional user action (DB trigger populates the list automatically); the pick persists after app restart.
  2. Swipe animations run at 60fps on a real low-end Android device (not just the simulator) — confirmed by Expo performance monitor showing no dropped frames during continuous swiping.
  3. Swiping up (superlike) is recorded as a distinct `interaction_type` in the `swipe_events` table and surfaces a visual distinction in Tonight's Picks.
  4. Tapping a card opens the restaurant detail view showing: at least one photo (hotlinked from Google), opening hours, price level, rating, and a working "Directions" deep link to Apple Maps / Google Maps.
  5. Tapping "Undo" after a swipe returns the last-swiped card to the front of the deck.
  6. The Settings screen contains a working "Delete Account" option that removes the user's data from Supabase (required by App Store guideline 5.1.1).
  7. When the card deck reaches zero restaurants matching current preferences, an empty state with a filter-reset CTA is shown (no blank screen or crash).
**Plans**: 6 plans

Plans:
- [x] 04-01-PLAN.md — Shared types (@cravyr/shared), Zustand stores, navigation layout (root Stack + tabs)
- [x] 04-02-PLAN.md — SwipeCard, OverlayLabels, CardSkeleton, SwipeDeck component, Discover screen
- [x] 04-03-PLAN.md — RestaurantRow component, Tonight's Picks screen (saved.tsx)
- [x] 04-04-PLAN.md — PhotoGallery component, Restaurant detail view (restaurant/[id].tsx)
- [x] 04-05-PLAN.md — Preferences screen, Settings screen + Express DELETE /api/v1/users/me
- [ ] 04-06-PLAN.md — Gap closure: POST /swipes, GET /restaurants/:id, GET /recommendations, DELETE /saves/:id

**UI hint**: yes

### Phase 5: Push Notifications + App Store Submission
**Goal**: Daily 6PM push notifications are live and delivering, EAS builds pass, TestFlight beta is accessible to non-developer testers, and the app is submitted to the App Store without skeleton-MVP rejection.
**Depends on**: Phase 4
**Requirements**: NOTIF-01
**Success Criteria** (what must be TRUE):
  1. A test user receives a push notification at (or within 5 minutes of) 6PM their local time — confirmed on a physical device, not just the Expo Push notification tool.
  2. Push tokens are upserted on every authenticated app open — a device that uninstalls and reinstalls the app does not accumulate stale token records in Supabase.
  3. The EAS production build (`eas build --platform all --profile production`) completes without error for both iOS and Android.
  4. The TestFlight build is accessible to at least one non-developer external tester who can complete the full core loop (onboard → swipe → save a pick) without guidance.
  5. The App Store submission passes initial review (no rejection for skeleton MVP, missing Apple Sign-In, missing delete-account, or generic location permission string).
**Plans**: TBD
**UI hint**: yes

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Monorepo Scaffold + Infrastructure | 0/TBD | Not started | - |
| 2. API + Database Layer | 0/TBD | Not started | - |
| 3. Authentication + Onboarding | 0/TBD | Not started | - |
| 4. Swipe Core + Secondary Screens | 5/6 | Gap closure | - |
| 5. Push Notifications + App Store Submission | 0/TBD | Not started | - |
