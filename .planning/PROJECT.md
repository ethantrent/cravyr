# Cravyr

## What This Is

Cravyr is a mobile app that brings Tinder-style swipe mechanics to restaurant discovery. Users swipe right to save restaurants to "Tonight's Picks," left to skip, and up to superlike — with a PostGIS-powered recommendation engine that personalizes the deck based on location, cuisine preferences, and price range. It is built for solo developers who want to ship a polished MVP to the App Store and Google Play.

## Core Value

The swipe feels right — 60fps, responsive, and frictionless — because a janky swipe kills the entire product premise before the user ever finds a restaurant they love.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Swipe card deck with 60fps animation (right = save, left = skip, up = superlike, undo)
- [ ] Location-based restaurant feed via Google Places API (New) with field masks + geographic batching
- [ ] Supabase backend with PostGIS spatial index and recommendation SQL function
- [ ] Authentication: email/password + Google + Apple Sign-In
- [ ] "Tonight's Picks" saved list (auto-populated on right-swipe via DB trigger)
- [ ] Restaurant detail view (photos, hours, directions, rating, price level)
- [ ] User preferences (cuisines, price range, max distance)
- [ ] Onboarding flow (complete enough to pass App Store review)
- [ ] Push notifications (daily 6PM reminder, weekly digest, closing-soon alerts, re-engagement)
- [ ] Settings screen
- [ ] Monorepo scaffold (Turborepo + pnpm, apps/mobile + apps/api + packages/shared)

### Out of Scope

- Real-time/multiplayer features — MVP is single-player; Supabase subscriptions unnecessary
- ML-based collaborative filtering — SQL scoring function sufficient through 50K users
- Yelp API integration — 24hr cache limit and ToS restrictions make it hostile for swipe apps
- Redis caching — in-memory node-cache appropriate for Render free/starter tier
- Vercel serverless functions as backend — can't handle cron jobs or persistent connections

## Context

- Stack is research-validated: rn-swiper-list (Reanimated v3, native thread), Supabase + PostGIS, Google Places API (New), Express.js on Render, Expo Push Notifications, Vercel for landing page only
- The single biggest financial risk is Google Places API cost: naïve implementation = ~$30K/month at 1K DAU; optimized (field masks + geographic cluster batching + place_id permanent caching) = ~$150–275/month
- App Store requires a complete app (onboarding, detail view, preferences, settings) — ~40% first-submission rejection rate for skeleton MVPs
- Apple Sign-In is mandatory when any social login is offered; full name must be captured on first login only
- Supabase free tier auto-pauses after 7 days of no DB activity — requires a keep-alive cron job

## Constraints

- **Tech Stack**: Turborepo + pnpm monorepo, Expo SDK 50+, Reanimated v3, Supabase + PostGIS, Express.js, Google Places API (New), Expo Router, Zustand
- **Budget**: Free/starter tier infrastructure; ~$7–325/month operational cost; $99/year Apple Developer + $25 Google Play one-time
- **Performance**: Swipe animations must run on native UI thread via Reanimated worklets — JS thread animation is not acceptable
- **Google Places ToS**: `place_id` may be stored permanently; photo URLs must be hotlinked (no downloading to own storage); photo references expire and must be regenerated server-side
- **App Store Compliance**: Location permission string must be specific; no "Always" location without justification; minimum functionality bar must be met before submission

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| rn-swiper-list over react-native-deck-swiper | Reanimated v3 native thread = 60fps; deck-swiper uses JS thread, classified Inactive, breaks on Expo 50+ | — Pending |
| Google Places API (New) as sole data source | 10 photos/place, 200M+ global coverage, place_id stored forever, richer boolean attributes | — Pending |
| Express.js over Fastify/NestJS | Deepest Claude training data; NestJS exceeds 512MB Render RAM on boot | — Pending |
| PostGIS SQL function for recommendations | Handles 100K restaurants / 50K users without external service; upgrade path is materialized view | — Pending |
| In-memory node-cache over Redis | Restaurant data changes slowly; cache repopulates fast after cold start; free tier appropriate | — Pending |
| Supabase RLS with `(SELECT auth.uid())` | Caches uid per-statement vs per-row — up to 99% faster RLS evaluation | — Pending |
| Expo Push Notifications | Free, no rate limits (600/sec), zero extra SDK since already on Expo | — Pending |
| Vercel for landing page only | Serverless can't handle cron jobs, WebSocket, or background processing needed by the API | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-06 after initialization*
