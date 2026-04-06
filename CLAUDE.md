Building Cravyr: the complete technical blueprint
Use rn-swiper-list for 60fps card swiping, Supabase with PostGIS for spatial recommendations, Google Places API (New) as your sole restaurant data source, Express.js on Render for the backend, and Expo Push Notifications for engagement — all organized in a Turborepo + pnpm monorepo optimized for Claude Code. This guide provides the exact schemas, configurations, and architecture decisions a solo developer needs to ship an MVP. The total infrastructure cost for the first 1,000 users runs roughly $7–$325/month depending on API usage, plus $99/year for Apple Developer and a one-time $25 for Google Play.

The swipe engine: rn-swiper-list on Reanimated v3
The core UX of Cravyr lives or dies on buttery-smooth card swiping. The React Native ecosystem has fragmented across several swipe libraries, most of which are now outdated. The legacy leader, react-native-deck-swiper, still logs ~8,000 npm weekly downloads npm TrendsSnyk but runs animations on the JavaScript thread using the old Animated API and PanResponder — guaranteed frame drops on complex cards with images. It's classified as "Inactive" by Snyk Snyk and has compatibility issues with Expo SDK 50+.
The clear winner is rn-swiper-list (GitHub: Skipperlla/rn-swiper-list, 295 stars). Built on Reanimated v3 + Gesture Handler, all animations execute on the native UI thread via worklets, GitHub delivering consistent 60fps even on low-end Android devices. GitHub It supports 4-direction swiping (right = save, left = skip, up = superlike, down = dismiss), swipe-back for undo, overlay labels that appear during drag ("SAVE 🔖" / "SKIP ❌"), and a programmatic imperative API for accessibility-compliant button-based swiping. GitHub It ships with TypeScript support and works seamlessly with Expo SDK 50+.
Install the core animation stack:
bashpnpm add rn-swiper-list react-native-reanimated react-native-gesture-handler
The fallback path is react-native-swipeable-card-stack (fully controlled/declarative API, 44 stars) github or a custom ~150-line implementation using Reanimated v3's Gesture.Pan() directly Swmansion — but only pursue custom if you need physics-based throws or 3D card flips that no library supports. For all image rendering on restaurant cards, use expo-image instead of React Native's built-in <Image> or the now-unmaintained react-native-fast-image. Expo-image provides native-grade disk + memory caching, placeholder transitions, WebP support, and a prefetching API critical for preloading the next 2–3 cards in the deck.

Supabase schema with PostGIS spatial queries
The database design centers on five tables with PostGIS geography columns for distance-based ranking. Enable PostGIS first:
sqlCREATE EXTENSION postgis WITH SCHEMA "extensions";
The restaurants table caches data from Google Places, storing location as a geography(POINT) column with a GIST spatial index for sub-millisecond nearest-neighbor queries:
sqlCREATE TABLE public.restaurants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text UNIQUE NOT NULL,          -- Google Place ID (stored forever per ToS)
  source text NOT NULL CHECK (source IN ('google_places', 'yelp')),
  name text NOT NULL,
  location extensions.geography(POINT) NOT NULL,
  address text, city text, state text,
  photo_urls text[] DEFAULT '{}',
  cuisines text[] DEFAULT '{}',
  price_level int CHECK (price_level >= 1 AND price_level <= 4),
  rating float CHECK (rating >= 0 AND rating <= 5),
  review_count int DEFAULT 0,
  hours jsonb,
  is_active boolean DEFAULT true,
  cached_at timestamptz DEFAULT now()
);

CREATE INDEX restaurants_geo_idx ON public.restaurants USING GIST (location);
CREATE INDEX restaurants_cuisines_idx ON public.restaurants USING GIN (cuisines);
The swipes table enforces a unique constraint per user-restaurant pair and triggers automatic population of the saves table on right-swipes:
sqlCREATE TABLE public.swipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('left', 'right', 'superlike')),
  swiped_at timestamptz DEFAULT now(),
  UNIQUE(user_id, restaurant_id)
);
A trigger function auto-inserts into saves ("Tonight's Picks") whenever a user swipes right or superlikes, eliminating a second API call from the client. Row Level Security policies follow a simple pattern: users read all restaurants but only their own swipes, saves, and preferences. The critical RLS performance optimization is wrapping auth.uid() in (SELECT auth.uid()) — this caches the value per-statement instead of evaluating per-row, yielding up to 99% faster RLS evaluation per the Supabase docs.
Auth configuration supports email + Google + Apple sign-in. For Google, use @react-native-google-signin/google-signin with supabase.auth.signInWithIdToken(). MediumMedium For Apple (mandatory if you offer any social login), use expo-apple-authentication — and critically, capture the user's full name during the first sign-in because Apple never returns it again. GitHub The Supabase client must be initialized with detectSessionInUrl: false for React Native, and you must call supabase.auth.startAutoRefresh() when the app foregrounds and stopAutoRefresh() when it backgrounds. Supabase
Free tier constraints that matter most: the database is 500 MB UI BakeryMetaCTO (sufficient for ~10K cached restaurants with full data), projects auto-pause after 7 days of inactivity Medium (prevent this with a GitHub Actions cron job that pings your database DEV Community every 3 days), and auth supports 50,000 MAUs. MetaCTO Real-time subscriptions are unnecessary for the MVP — Cravyr is a single-player swiping experience, not a multiplayer one.

Google Places API wins on every dimension that matters
The March 2025 pricing overhaul replaced Google's $200/month universal credit with per-SKU free usage caps. Nicola Lazzari The restaurant data Cravyr needs (rating, price level, hours, phone) triggers Enterprise-tier billing at ~$20/1,000 requests, with 1,000 free monthly requests at that tier. Nicola Lazzari Photos are billed separately. Yelp Fusion eliminated its free tier entirely in 2024 App Developer Magazine and restricts caching to just 24 hours YelpYelp Developers with prohibitions on blending ratings with other sources Yelp — operationally hostile for a swipe app that needs to cache restaurant cards.
Use Google Places API (New) as your sole data source. Here's why it dominates for Cravyr:

10 photos per place versus Yelp's 3 (Plus plan) or 12 (Premium, $14.99/1K calls)
Global coverage of 200M+ places versus Yelp's US-centric ~32 countries
place_id stored indefinitely per ToS, enabling permanent restaurant catalog GoogleGoogle
Rich boolean attributes perfect for filtering: dineIn, delivery, servesVegetarianFood, outdoorSeating, goodForGroups
AI-generated review summaries and place summaries (new in 2025) Google

Field masks are your single most important cost lever. Requesting rating (Enterprise SKU) alongside displayName (Pro SKU) bills the entire request at Enterprise rates. googleGoogle For swipe cards, request only Essentials/Pro fields (displayName, photos, primaryType, location, formattedAddress). Defer expensive fields (rating, reviews, openingHours) to the restaurant detail view when a user taps a card.
Cost at 1,000 DAU with smart caching: Batch Nearby Search by geographic clusters (~50 areas, not per-user), cache place_ids permanently in Supabase, fetch details once per restaurant per month, and lazy-load photos. Estimated monthly API cost: $150–$275. Without optimization (naïve 1:1 API call per card view), the same traffic would cost $30,000/month — a catastrophic difference driven entirely by architecture choices.

Express.js on Render: lean enough for 512 MB
Express.js is the right framework for a solo developer on Render's free tier, not because it's the fastest (Fastify handles ~2x the raw RPS) but because Claude Code has the deepest training data on Express patterns, the 0.1 vCPU allocation makes framework-level performance differences irrelevant, and the 512 MB RAM ceiling eliminates NestJS (which consumes 80–150 MB just booting). Express's middleware ecosystem — helmet, cors, express-rate-limit, compression — drops in without configuration fights.
The API structure separates restaurant fetching (with server-side caching via node-cache), swipe logging, user preferences CRUD, a recommendation endpoint wrapping the PostGIS function, and push notification registration:
/api/v1/restaurants     GET /         → Nearby restaurants (cached)
                        GET /:id      → Restaurant details
/api/v1/swipes          POST /        → Log swipe
/api/v1/recommendations GET /         → Personalized ranked deck
/api/v1/preferences     PUT /         → Update user preferences
/api/v1/notifications   POST /register → Register Expo push token
In-memory caching with node-cache is the right choice over Redis on free tier. Restaurant lists cache for 1 hour, individual details for 2 hours, recommendations for 15 minutes. The cache resets on every cold start, which is acceptable because restaurant data changes slowly and the Google Places API calls repopulate it quickly.
Render free tier realities: services spin down after 15 minutes of no inbound traffic, Renderrender with cold starts taking 25–60 seconds — devastating for the first user who opens the app after an idle period. The 750 monthly instance hours never become the bottleneck (spin-down ensures that). render Mitigate cold starts with UptimeRobot (free, 5-minute ping intervals to your /health endpoint) Medium during development, but upgrade to Render Starter at $7/month before any real user testing. The cold start alone justifies it.
The render.yaml blueprint for monorepo deployment:
yamlservices:
  - type: web
    name: cravyr-api
    runtime: node
    plan: free
    rootDir: apps/api
    buildCommand: npm install && npm run build
    startCommand: node dist/server.js
    healthCheckPath: /health
    envVars:
      - key: GOOGLE_PLACES_API_KEY
        sync: false
      - key: SUPABASE_URL
        sync: false
      - key: SUPABASE_SERVICE_ROLE_KEY
        sync: false

The recommendation engine in one SQL function
The MVP ranking algorithm uses a weighted scoring formula executed entirely within PostGIS, avoiding any external recommendation service. The function get_restaurant_recommendations takes the user's ID and current coordinates, then:

Loads user preferences (cuisines, price range, max distance) via a CTE
Identifies already-swiped restaurants to exclude
Uses ST_DWithin (which leverages the GIST spatial index) to filter restaurants within the user's max distance
Scores each remaining restaurant on four weighted factors: distance (40%), cuisine match (25%), rating (20%), and price match (15%)

The distance score uses exponential decay — a restaurant 100 meters away scores near 1.0 while one at the edge of the search radius scores near 0. Cuisine match calculates the percentage overlap between the restaurant's cuisine tags and the user's favorites. The function returns scored results ordered by rank, called from the client via supabase.rpc('get_restaurant_recommendations', { p_user_id, p_lat, p_lng }). Supabase
This SQL-only approach scales to ~100K restaurants and ~50K users before you'd need caching layers. The first upgrade step is a materialized view tracking per-restaurant swipe-right ratios (refreshed hourly via pg_cron), adding a "popularity" signal to the ranking. True ML-based collaborative filtering ("users who liked X also liked Y") only becomes necessary well past product-market fit.

Monorepo structure optimized for Claude Code
A monorepo using Turborepo + pnpm workspaces is the strongest setup for Claude Code because it can see the schema, API definitions, and frontend implementation in one context window. Rosmurclaudearchitect The shared @cravyr/shared package containing Zod validation schemas and TypeScript types ensures the swipe card's Restaurant type is identical between the mobile app and API server — Claude never generates mismatched interfaces.
cravyr/
├── CLAUDE.md                     # Project overview, conventions, commands
├── turbo.json                    # Task orchestration
├── pnpm-workspace.yaml           # packages: ["apps/*", "packages/*"]
├── apps/
│   ├── mobile/                   # Expo React Native app
│   │   ├── app/                  # Expo Router file-based routing
│   │   │   ├── (tabs)/discover.tsx   # Swipe card screen
│   │   │   ├── (tabs)/saved.tsx      # Tonight's Picks
│   │   │   └── restaurant/[id].tsx   # Detail view
│   │   ├── components/SwipeCard/
│   │   ├── stores/               # Zustand state
│   │   └── eas.json
│   └── api/                      # Express.js backend
│       ├── src/routes/
│       ├── src/services/
│       └── render.yaml
├── packages/
│   └── shared/                   # @cravyr/shared
│       ├── src/types/restaurant.ts
│       ├── src/validation/        # Zod schemas
│       └── src/constants/
The CLAUDE.md at root should document the tech stack, key conventions (named exports only, Zustand for state, Expo Router for navigation, Zod for validation), and critical rules ("shared types MUST come from @cravyr/shared — never duplicate"). Keep it under 200 lines — bloated context files waste tokens. Claudeclaudearchitect Place package-specific CLAUDE.md files in each app directory with scope-limited instructions. GitHub
pnpm wins over yarn/npm for this setup: strict dependency isolation prevents phantom dependencies (critical when React Native and Node.js share a monorepo), Expo Documentation and the workspace:* protocol ensures internal packages resolve within the repo. Expo Documentation One essential .npmrc setting for EAS Build compatibility: node-linker=hoisted.

Push notifications via Expo, Vercel only for a landing page
Expo Push Notifications is the correct choice for the MVP. It's completely free with no monthly limits (rate-limited to 600/second), requires zero additional SDK integration since you're already on Expo, and your Render backend sends notifications with a simple POST to Expo's API using expo-server-sdk-node. Set up four notification types: a 6 PM daily reminder for unseen Tonight's Picks, weekly "new restaurants nearby" digests, time-sensitive "your saved restaurant closes in 1 hour" alerts triggered by a cron job comparing saved restaurant hours against current time, and re-engagement pings for users inactive 3+ days. Don't request push permission on first launch — use a soft prompt explaining the value first, then trigger the native dialog.
Vercel serves exactly one purpose: a Next.js marketing/landing page with App Store links, SEO, deep link handling (serving apple-app-site-association), and social share OG images. The Hobby plan is free but prohibits commercial use TrueFoundry — upgrade to Pro ($20/month) once you monetize. Do not use Vercel serverless functions as your backend; Render's persistent Node.js server handles cron jobs, WebSocket connections, and background processing that serverless can't.

Deployment pipeline from code to TestFlight
Budget $99/year for Apple Developer and $25 one-time for Google Play — both are non-negotiable for app store distribution. EAS Build's free tier provides 30 builds/month (15 iOS + 15 Android) with low-priority queue expo waits of 30–120 minutes — sufficient for solo development.
The deployment workflow: push to main → GitHub Actions runs lint + typecheck + tests → Render auto-deploys the API (filtered to apps/api/** changes) Render → EAS builds and submits the mobile app (filtered to apps/mobile/** changes). For JavaScript-only changes (no native code modifications), use eas update for instant OTA updates without a full rebuild — the free tier supports 1,000 MAUs for updates. expoExpo Documentation
Core eas.json configuration:
json{
  "build": {
    "development": { "developmentClient": true, "distribution": "internal" },
    "preview": { "distribution": "internal" },
    "production": { "autoIncrement": true }
  },
  "submit": {
    "production": {
      "ios": { "ascAppId": "YOUR_APP_STORE_CONNECT_ID" },
      "android": { "track": "internal", "serviceAccountKeyPath": "./google-sa.json" }
    }
  }
}
Build and submit in one command: eas build --platform ios --profile production --auto-submit. The build appears in TestFlight after ~15 minutes of Apple processing. Expo Documentation

Ten gotchas that will cost you days if you don't know them
Supabase auto-pause is the most dangerous free-tier trap. Projects pause after 7 days of no database activity MetaCTOMedium — not no API calls, no database queries specifically. A GitHub Actions cron running SELECT 1 every 3 days prevents this. DEV Community When you have real users, upgrade to Pro ($25/month) immediately; the pause behavior alone makes the free tier unsuitable for production. Medium
Google Places field masks are a $30,000/month mistake if forgotten. Requesting * (all fields) bills every API call at the highest Enterprise + Atmosphere SKU. googleGoogle Always specify exact fields. For swipe cards: places.displayName,places.photos,places.location,places.primaryType,places.formattedAddress. For detail views: add places.rating,places.priceLevel,places.regularOpeningHours.
Render cold starts kill first impressions. The 25–60 second spin-up after idle means the first user's API call either times out or shows a loading spinner for a full minute. UptimeRobot's free tier (5-minute pings) keeps the server warm during development. Medium For production: spend the $7/month on Render Starter. Secret
Apple Sign-In gotcha: full name vanishes after first login. Apple only returns credential.fullName on the very first sign-in attempt. GitHub If you don't capture and persist it via supabase.auth.updateUser() during that first call, you'll never get it again without the user revoking and re-granting access. Supabase
App Store "minimum functionality" rejections affect ~40% of first submissions. A swipe-only MVP with no depth will be flagged. Ship with: complete onboarding flow, restaurant detail view with photos/hours/directions, saved list management, user preferences, settings screen, and a clear value proposition. Don't submit a half-built prototype.
Google Places photos cannot be stored or downloaded — you must hotlink via Google's URLs, and photo name references expire. Cache the reference server-side and regenerate URLs as needed, but never download images to your own storage. Google
Memory management on swipe decks matters. Loading 50+ restaurant cards with high-resolution images simultaneously will crash low-end Android devices. Render only 5–7 cards at a time using rn-swiper-list's prerenderItems prop. GitHub Use expo-image's prefetching API to warm the next 2–3 cards.
Supabase's 500 MB database limit triggers read-only mode silently. Your app will break without clear errors. Medium Monitor DB size in the dashboard, keep cached restaurant data minimal (store only what you display), and archive swipe data older than 30 days for inactive users.
Location permission wording causes Apple rejections. Use NSLocationWhenInUseUsageDescription with specific text: "Cravyr uses your location to find restaurants near you and show distance information." Generic phrasing or requesting "Always" permission without justification triggers rejection.
Duplicate React Native versions in a monorepo crash the app instantly. Expo Documentation Run pnpm why --recursive react-native regularly. Expo DocumentationMedium The Metro bundler's --reset-cache flag is your friend when encountering mysterious build failures after dependency changes.

Conclusion
The architecture bottleneck for Cravyr isn't any single technology choice — it's the Google Places API cost structure that will determine whether the app is financially viable at scale. The difference between naïve implementation ($30K/month at 1K DAU) and optimized architecture ($200–300/month) is entirely a function of field masks, geographic batching, and aggressive caching via place_ids. Every other infrastructure component (Supabase free tier, MetaCTO Render Starter at $7, Expo's free push service) is effectively free or near-free through early growth. Start building by scaffolding the monorepo with pnpm create turbo, enabling PostGIS, and wiring up a single swipe card with a hardcoded restaurant — then layer in the Google Places integration, recommendation function, and auth in that order. The swipe feels right or it doesn't; everything else is plumbing.

<!-- GSD:project-start source:PROJECT.md -->
## Project

**Cravyr**

Cravyr is a mobile app that brings Tinder-style swipe mechanics to restaurant discovery. Users swipe right to save restaurants to "Tonight's Picks," left to skip, and up to superlike — with a PostGIS-powered recommendation engine that personalizes the deck based on location, cuisine preferences, and price range. It is built for solo developers who want to ship a polished MVP to the App Store and Google Play.

**Core Value:** The swipe feels right — 60fps, responsive, and frictionless — because a janky swipe kills the entire product premise before the user ever finds a restaurant they love.

### Constraints

- **Tech Stack**: Turborepo + pnpm monorepo, Expo SDK 50+, Reanimated v3, Supabase + PostGIS, Express.js, Google Places API (New), Expo Router, Zustand
- **Budget**: Free/starter tier infrastructure; ~$7–325/month operational cost; $99/year Apple Developer + $25 Google Play one-time
- **Performance**: Swipe animations must run on native UI thread via Reanimated worklets — JS thread animation is not acceptable
- **Google Places ToS**: `place_id` may be stored permanently; photo URLs must be hotlinked (no downloading to own storage); photo references expire and must be regenerated server-side
- **App Store Compliance**: Location permission string must be specific; no "Always" location without justification; minimum functionality bar must be met before submission
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Recommended Stack
### Mobile App (apps/mobile)
| Technology | Version | Purpose | Confidence |
|---|---|---|---|
| Expo | 55.0.11 (SDK 55) | RN framework and managed build pipeline | MEDIUM |
| rn-swiper-list | 3.0.0 | Swipe card deck (native thread, 60fps) | MEDIUM |
| react-native-reanimated | 4.3.0 | Animation engine for swipe worklets | MEDIUM |
| react-native-gesture-handler | 2.31.0 | Gesture recognition layer | MEDIUM |
| react-native-worklets | (peer of rn-swiper-list 3.x) | JS worklet runtime — NEW required peer dep | LOW |
| expo-image | 55.0.8 | Performant image rendering with prefetch | MEDIUM |
| Expo Router | 55.0.10 | File-based navigation (ships with Expo SDK 55) | MEDIUM |
| Zustand | 5.0.12 | Lightweight global state management | MEDIUM |
### Backend (apps/api)
| Technology | Version | Purpose | Confidence |
|---|---|---|---|
| Express.js | 5.2.1 | API server (async error handling, no try/catch boilerplate) | MEDIUM |
| node-cache | 5.1.2 | In-memory TTL cache for Google Places responses | HIGH |
### Database / Auth
| Technology | Version | Purpose | Confidence |
|---|---|---|---|
| @supabase/supabase-js | 2.101.1 | DB client, Auth, RLS, PostGIS queries | HIGH |
| PostGIS | 3.x (bundled with Supabase) | Spatial indexing and `ST_DWithin` proximity queries | MEDIUM |
### External APIs
| API | Pricing | Key Constraint | Confidence |
|---|---|---|---|
| Google Places API (New) | Essentials (free): 0–$0 up to monthly credit; Pro: ~$0.032/request Nearby Search; Enterprise: custom | Field masks are mandatory — unbilled fields still count toward SKU if omitted incorrectly; billing is per-field-set SKU, not per field | MEDIUM |
### Monorepo
| Technology | Version | Purpose | Confidence |
|---|---|---|---|
| Turborepo (turbo) | 2.9.4 | Task orchestration, remote caching, pipeline definition | HIGH |
| pnpm | 9.x (latest stable) | Package manager; workspace protocol for monorepo linking | HIGH |
## Version Flags and Compatibility Concerns
### FLAG 1 — Expo SDK 55, not 52
### FLAG 2 — react-native-reanimated is now v4 (not v3)
- The import paths and some API surface may have changed between v3 and v4.
- The `useAnimatedStyle`, `useSharedValue`, `withSpring`, `withTiming`, and `runOnUI` worklet APIs are expected to be forward-compatible, but verify against the v4 changelog before writing animation code.
- All references to "Reanimated v3" in PROJECT.md and CLAUDE.md should be mentally read as "Reanimated v4."
### FLAG 3 — rn-swiper-list 3.0.0 adds react-native-worklets as a required peer dependency
- Confirm the exact package name (`react-native-worklets` vs `react-native-worklets-core`) from the rn-swiper-list 3.0.0 README before installing.
- Add it explicitly to `apps/mobile/package.json` — it will not be auto-installed as a transitive dep in a pnpm hoisting setup.
- Check if Expo SDK 55 bundles this package or if a manual `expo install` step is needed.
### FLAG 4 — Express 5 is the latest stable
- Async route handlers now propagate errors automatically — no need to wrap every handler in `try/catch` or call `next(err)` manually. This is a significant DX improvement.
- `res.json()` and `res.send()` behavior is unchanged.
- `path-to-regexp` upgrade inside Express 5 changes wildcard route syntax (`:param*` patterns differ). Check any catch-all routes.
- No breaking changes to middleware API that affect Express 4 patterns used here.
- **Use Express 5.** The improvement to async error propagation is directly relevant to the Places API proxy routes.
### FLAG 5 — Zustand v5 is out
- `create` no longer accepts a plain object — must use a function: `create(() => ({ ... }))`. This was the pattern in v4 too, so most code is unaffected.
- The `immer` middleware and `devtools` middleware have updated type signatures.
- React 18 concurrent mode support is improved.
- No major API surface changes for basic `get`/`set`/`subscribe` usage. Use v5 — the migration from any v4 examples online is minimal.
## Alternatives Considered
| Category | Recommended | Alternative | Why Not |
|---|---|---|---|
| Swipe library | rn-swiper-list 3.0.0 | react-native-deck-swiper | deck-swiper uses the JS thread (not native), is classified Inactive on GitHub, and breaks on Expo 50+. rn-swiper-list is actively maintained and built on Reanimated worklets. |
| Animation engine | react-native-reanimated 4.x | Animated API (built-in) | Built-in Animated runs on the JS thread and cannot guarantee 60fps under JS load. Reanimated worklets run on the UI thread. |
| State management | Zustand 5 | Redux Toolkit / Jotai | Redux is overbuilt for a single-developer mobile app; boilerplate cost is not justified. Jotai is fine but Zustand has better devtools integration and simpler store composition for this data shape. |
| Navigation | Expo Router 55 | React Navigation (standalone) | Expo Router is file-based and ships with SDK 55 — zero extra configuration. React Navigation requires manual stack/tab setup and does not benefit from Expo's deep link handling. |
| Backend hosting | Render.com (free/starter) | Vercel serverless | Vercel serverless functions cannot run cron jobs or maintain persistent connections. Render's always-on web service supports node-cache state persistence across requests and cron job scheduling. |
| Caching | node-cache (in-memory) | Redis | Redis adds infrastructure cost and operational overhead. Restaurant data changes slowly; node-cache repopulates quickly after a cold start. Appropriate through Render free/starter tier. |
| Database | Supabase + PostGIS | PlanetScale / Neon | Supabase bundles auth, RLS, PostGIS, and storage in one service. PostGIS `ST_DWithin` + GIST index handles proximity queries without an external geo service. |
## Critical Setup Notes
### pnpm Workspace (.npmrc)
### react-native-worklets peer dependency (rn-swiper-list 3.0.0)
### react-native-reanimated v4 — babel plugin
### Supabase React Native client setup
### PostGIS setup on Supabase
### Supabase free tier keep-alive
### Supabase RLS performance
### Google Places API (New) — field masks
### Express 5 async error handling
### Turborepo pnpm workspace setup
## Installation
# From apps/mobile — use expo install for SDK-versioned packages
# Swipe library + worklets (confirm worklets package name from rn-swiper-list 3.0.0 README first)
# Supabase (requires AsyncStorage peer)
# State management
# From apps/api
# Dev/monorepo root
## Sources
- npm: `rn-swiper-list@3.0.0` — https://www.npmjs.com/package/rn-swiper-list (MEDIUM — version confirmed, compatibility details unverified)
- npm: `expo@55.0.11` — https://www.npmjs.com/package/expo (MEDIUM — version confirmed)
- npm: `react-native-reanimated@4.3.0` — https://www.npmjs.com/package/react-native-reanimated (MEDIUM — version confirmed, v4 API surface from training data)
- npm: `react-native-gesture-handler@2.31.0` — https://www.npmjs.com/package/react-native-gesture-handler (MEDIUM — version confirmed)
- npm: `expo-image@55.0.8` — https://www.npmjs.com/package/expo-image (MEDIUM — version confirmed)
- npm: `@supabase/supabase-js@2.101.1` — https://www.npmjs.com/package/@supabase/supabase-js (HIGH — version confirmed, v2 React Native setup well-documented)
- npm: `turbo@2.9.4` — https://www.npmjs.com/package/turbo (HIGH — version confirmed)
- npm: `express@5.2.1` — https://www.npmjs.com/package/express (MEDIUM — version confirmed, Express 5 GA behavior from training data)
- npm: `zustand@5.0.12` — https://www.npmjs.com/package/zustand (MEDIUM — version confirmed, v5 migration notes from training data)
- npm: `node-cache@5.1.2` — https://www.npmjs.com/package/node-cache (HIGH — stable, no major version changes)
- npm: `expo-router@55.0.10` — https://www.npmjs.com/package/expo-router (MEDIUM — version confirmed)
- Supabase docs: PostGIS setup — https://supabase.com/docs/guides/database/extensions/postgis (MEDIUM)
- Google Places API (New) pricing — https://developers.google.com/maps/documentation/places/web-service/usage-and-billing (MEDIUM — pricing tiers current as of training cutoff Aug 2025; verify before launch)
- Expo managed workflow + pnpm: https://docs.expo.dev/guides/monorepos/ (MEDIUM)
- Render.com free tier specs: https://render.com/pricing (MEDIUM — verify current free/starter RAM limits)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
