# Feature Landscape

**Domain:** Swipe-based restaurant discovery app
**Researched:** 2026-04-06

---

## Table Stakes

Features users expect as a baseline. Missing = product feels broken, incomplete, or gets rejected by App Store review.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Swipe gestures (right/left/up) | Core product premise — without fluid swipe mechanics at 60fps the app has no reason to exist | High | Must run on native UI thread via Reanimated v3 worklets; JS-thread animation is disqualifying |
| Undo last swipe | Users misswipe constantly; absence feels punitive and is the #1 complaint in swipe-app reviews | Low | Single undo depth is sufficient for v1; unlimited undo adds session-state complexity |
| Location-based restaurant deck | Users expect cards to reflect where they actually are; static or city-level results feel broken | High | Requires location permission + Google Places API (New); field masks and geographic batching are mandatory to control cost |
| Restaurant detail view | Every card tap needs a destination with photos, hours, rating, price level, and directions | Med | Photos must be hotlinked from Google (no local storage per ToS); hours and rating come from Places API response |
| "Tonight's Picks" saved list | Right-swipe without persistence is meaningless — users need to retrieve what they liked | Med | DB trigger on swipe_events table is the correct implementation; list must survive app restart |
| User account (email + Apple Sign-In) | Picks and preferences must persist across installs; App Store requires Apple Sign-In when any social login is offered | Med | Apple Sign-In is mandatory when Google Sign-In is offered; full name must be captured on first login only (Apple sends it once) |
| Onboarding flow | App Store reviewers check that a first-run user can reach the core feature without a support ticket; skeleton launches are rejected | Med | Must cover: location permission, cuisine preferences, price range, account creation — all before the deck loads |
| User preferences screen | Cuisine, price range, and distance filters are the personalization layer that justifies the recommendation engine | Low | Accessible post-onboarding; changes should re-seed the deck immediately |
| Settings screen | App Store guidelines expect a discoverable way to manage account, notifications, and data deletion | Low | Minimum: account info, notification toggles, sign-out, delete account |
| Location permission prompt | App Store requires a specific, non-generic NSLocationWhenInUseUsageDescription string; vague strings are a common rejection reason | Low | "Always" location permission requires explicit justification; "When In Use" is sufficient for this use case |
| Empty state handling | A deck with zero cards and no explanation drives 1-star reviews and support volume | Low | Show a friendly empty state with filter-reset CTA when no restaurants match current preferences |

---

## Differentiators

Features that set Cravyr apart from generic lists. Not baseline-expected, but meaningfully increase engagement and retention.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Superlike (swipe up) | Creates a priority tier within saved picks — users know their top choice tonight | Low | Already part of the core gesture set; store as a separate `interaction_type` in swipe_events; surface a "Tonight's Best" banner in the picks list |
| Push notifications — daily 6PM reminder | "What's for dinner?" is a daily problem; a well-timed nudge is the highest-ROI retention mechanism for this category | Med | Expo Push Notifications; 6PM local time requires server-side cron with user timezone stored at signup; avoid over-notifying |
| Push notifications — closing-soon alerts | Creates urgency for Picks that are about to close; drives same-session conversion | Med | Requires storing closing hours and a per-user cron scan; complex relative to value — consider deferring to v1.1 |
| Cuisine/price/distance filter UI | Makes the deck feel curated rather than random; power users tune this obsessively | Low | Can be a bottom sheet above the deck; changes must invalidate and reload the card cache |
| PostGIS-powered personalization | Scores restaurants by proximity + preference match rather than simple radius query; deck feels smarter over time | High | Already planned (SQL scoring function); the UX differentiation is invisible but reduces churn from irrelevant cards |
| "Directions" deep link from detail view | Reduces friction from decision to action — one tap to Apple Maps/Google Maps | Low | Use `maps://` (iOS) and `geo:` (Android) URI schemes; no API cost |
| Price level indicator on card | Users filter mentally by price before cuisine; surfacing it on the card face reduces frustration swipes | Low | Google Places returns `priceLevel` as an integer 0–4; render as $ / $$ / $$$ / $$$$ on card |

---

## Anti-Features

Features to explicitly NOT build in v1 — they add engineering cost and surface area without proportional user value at launch scale.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Social / friend activity feed | Requires social graph, privacy controls, moderation, and a critical mass of friends using the app simultaneously — none of which exist at launch | Build solo-first; add social hooks (share a Pick via link) only after validating core retention |
| In-app reviews / user ratings | Duplicate of Google/Yelp data users already trust; creates moderation burden and legal exposure; App Store may flag thin review ecosystems | Deep-link to Google Maps reviews from the detail view instead |
| Restaurant booking / reservations | Requires OpenTable or Resy API partnerships, terms negotiation, and a payment/confirmation flow; out of scope and out of budget | Add a "Reserve" CTA that deep-links to the restaurant's website or OpenTable URL — zero integration cost |
| Group decision mode ("vote together") | Requires real-time sync, presence detection, session management, and conflict resolution UX; the PROJECT.md explicitly rules out real-time/multiplayer | Post-launch differentiator; the sharing mechanism (share a Pick) is the v1 proxy for group use |
| Search (restaurant name / cuisine text search) | Competes with the swipe paradigm; users who want to search already have Google Maps; adds a full text-search index and query path | Filters (cuisine, price, distance) are the correct v1 discovery affordance; search can be v2 |
| Unlimited undo history | Session-state complexity grows fast; users rarely need more than one undo; unlimited undo can break recommendation scoring | Single undo (last card only); re-show the card at the front of the deck |
| Collaborative filtering / ML recommendations | SQL scoring function handles 50K users without an external ML service; the data volume to train a useful CF model doesn't exist at launch | Ship the PostGIS SQL scoring function; add CF only after accumulating sufficient swipe-event history |
| Weekly digest push notification | Low open rate relative to daily reminder; adds cron complexity and notification fatigue risk | Start with one well-timed daily notification; add digest in v1.1 based on engagement data |
| Yelp API integration | 24-hour cache limit and ToS restrictions make it hostile for swipe apps; PROJECT.md explicitly rules this out | Google Places API (New) is the sole data source |
| Photo download / own CDN for images | Google Places ToS requires hotlinking photo URLs; downloading to own storage violates terms and creates storage cost | Hotlink directly from the Places photo API with server-side reference regeneration |
| Dark mode (as a v1 requirement) | Doubles UI QA surface; iOS handles dark/light mode at OS level if you use semantic colors, but custom dark themes are scope creep | Use iOS semantic colors from day one (systemBackground, label, etc.); true custom dark mode is post-launch polish |

---

## Feature Dependencies

```
Location permission → Location-based deck
Location permission → PostGIS recommendation function (needs lat/lng)

User account → Tonight's Picks (picks must be tied to a user)
User account → Push notifications (need a push token tied to a user)
User account → User preferences (preferences must persist per user)

Onboarding flow → User account (account creation is part of onboarding)
Onboarding flow → User preferences (initial cuisine/price/distance set during onboarding)
Onboarding flow → Location permission (prompt fires during onboarding)

Location-based deck → Restaurant detail view (detail view displays a card's data)
Location-based deck → Tonight's Picks (right-swipe populates the list)
Location-based deck → Swipe gestures (gestures operate on the deck)

Swipe gestures → Undo last swipe (undo reverts the most recent gesture)
Swipe gestures → Superlike (swipe-up is a gesture variant)

Tonight's Picks → Push notifications — daily reminder (reminder drives users back to their list)
Tonight's Picks → Push notifications — closing-soon alerts (alerts reference saved picks)

User preferences → Location-based deck (preferences parameterize the recommendation query)
Settings screen → User preferences (settings links to preferences)

Supabase keep-alive cron → User account (DB must be active to auth users)
```

---

## App Store Minimum Functionality

Based on Apple App Store Review Guidelines (§4.2 Minimum Functionality) and common rejection patterns for location-based and discovery apps:

- The app must have a clear, functional core loop accessible to a brand-new user without contacting support — for Cravyr this means: onboard → grant location → see a swipe deck with real restaurants → save a pick.
- A non-trivial onboarding flow must exist. A screen that just says "loading restaurants…" with no preference capture is a common rejection trigger for discovery apps.
- Location permission must use a specific `NSLocationWhenInUseUsageDescription` string explaining the benefit to the user (e.g., "Cravyr uses your location to show restaurants near you"). Generic strings like "This app uses location" are a rejection reason.
- Apple Sign-In is required whenever any third-party social login (Google, Facebook, etc.) is offered. Failing to include it while offering Google Sign-In is an automatic rejection.
- Apple Sign-In requires capturing full name on first sign-in only — Apple sends name data once; apps must cache it locally at that moment.
- Account deletion must be supported and discoverable in-app (Apple guideline 5.1.1, enforced since 2022). A "Delete Account" option in Settings is mandatory.
- The app must not be a thin web wrapper. Cravyr's native swipe mechanic and local data handling satisfy this requirement.
- The app must handle the case where location permission is denied — crashing or showing a blank screen on permission denial is a rejection reason. A graceful fallback (prompt to enable in Settings) is required.
- Push notification permission must be requested at an appropriate moment (not on cold launch before the user understands the value). The standard pattern is to request after the user has experienced the core feature at least once.
- Screenshots submitted to the App Store must reflect the actual app UI. Placeholder UI or lorem ipsum in screenshots is a review flag.

---

## MVP Recommendation

### Prioritize (v1 — required for App Store submission):

1. Swipe card deck at 60fps (right/left/up + undo) — the entire product premise lives or dies here
2. Location-based deck via Google Places API (New) with field masks + caching — the content that fills the deck
3. User account with email + Google + Apple Sign-In — persistence and App Store compliance
4. Onboarding flow (location permission, cuisine/price prefs, account creation) — App Store rejection gate
5. Restaurant detail view (photos, hours, directions, rating, price level) — required for any card to be actionable
6. "Tonight's Picks" saved list populated by DB trigger — right-swipe without persistence is meaningless
7. User preferences screen (cuisines, price range, distance) — parameterizes the recommendation engine
8. Settings screen with account info, notification toggles, sign-out, delete account — App Store compliance
9. Empty state and location-denied fallback handling — rejection risk if absent
10. Daily 6PM push notification — highest-ROI retention mechanism; straightforward with Expo Push

### Defer (v1.1 or later):

- **Closing-soon alerts**: High value but requires per-pick cron scanning; complexity doesn't justify v1 inclusion
- **Search**: Conflicts with swipe paradigm at this stage; filters are sufficient
- **Social / sharing**: Validate solo retention first; share-a-pick is a lightweight proxy
- **In-app reviews**: Deep-link to Google Maps instead; no moderation overhead
- **Booking/reservations**: Deep-link to restaurant website; zero integration cost, zero risk
- **Group decision mode**: Requires real-time infra that's explicitly out of scope
- **Weekly digest notification**: Add after measuring daily reminder engagement

---

## Sources

> Note: WebSearch was unavailable in this environment. The analysis below is derived from Claude's trained knowledge (cutoff August 2025), the detailed constraints documented in `.planning/PROJECT.md`, and established App Store review guideline patterns documented publicly by Apple and widely analyzed by the iOS developer community.

| Source | Type | Confidence | Notes |
|--------|------|------------|-------|
| Apple App Store Review Guidelines §4.2 (Minimum Functionality) | Primary | High | Enforced standard; §4.2 rejection is one of the top-5 most common rejection reasons |
| Apple App Store Review Guidelines §5.1.1 (Data Collection and Storage) | Primary | High | Account deletion requirement enforced since June 2022 |
| Apple Sign-In requirements (Sign in with Apple guideline) | Primary | High | Mandatory when any third-party social login is offered; confirmed in review guidelines |
| Google Places API (New) Terms of Service — photo and place_id storage rules | Primary | High | Documented in PROJECT.md with validated constraints |
| Expo Push Notifications documentation | Primary | High | Free tier, 600/sec rate limit, no external SDK needed |
| Swipe-app UX patterns (Tinder, Bumble, Hinge) | Secondary — trained knowledge | High | Undo, empty state, and gesture expectations are well-established in this interaction paradigm |
| Restaurant discovery app competitive landscape (Yelp, Google Maps, Zomato, OpenTable) | Secondary — trained knowledge | Med | Feature expectations synthesized from known app feature sets as of training cutoff |
| iOS Human Interface Guidelines — location permission best practices | Primary | High | "When In Use" vs "Always" distinction; specific usage description string requirement |
| App Store skeleton/minimum functionality rejection patterns | Secondary — trained knowledge | Med | ~40% first-submission rejection rate for skeleton MVPs is cited in PROJECT.md; consistent with community reporting |
