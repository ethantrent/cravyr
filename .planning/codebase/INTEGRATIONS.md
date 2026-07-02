# External Integrations

**Analysis Date:** 2026-07-02

## APIs & External Services

**Restaurant Data:**
- Google Places API (New) v1 — sole source for restaurant data (nearby search, place details, photos)
  - SDK/Client: native `fetch()` — no Google client library; implemented in `apps/api/src/services/places.ts`
  - Auth: `GOOGLE_PLACES_API_KEY` (API server env var)
  - Endpoints used: `https://places.googleapis.com/v1/places:searchNearby` (POST), `https://places.googleapis.com/v1/places/{id}` (GET), `https://places.googleapis.com/v1/{photoName}/media` (GET for photo resolution)
  - Field masks: `FIELD_MASK_NEARBY` (Pro-tier, swipe cards) and `FIELD_MASK_DETAIL` (Enterprise-tier, detail view) defined in `apps/api/src/services/places-constants.ts`
  - Photo URLs expire ~24h; cached for 20h via `node-cache` in `resolvePhotoUrl()`; photo references stored server-side and resolved on demand via `GET /api/v1/photos/resolve`
  - `place_id` stored permanently in `restaurants.external_id` per Google ToS
  - Cost lever: geographic geo-cache clustering via geohash (`ngeohash`) in `apps/api/src/services/geo-cache.ts`

**Push Notifications:**
- Expo Push Notification Service — free, rate-limited to 600/second
  - SDK: `expo-server-sdk` ^6.1.0 in `apps/api/src/services/push.ts`
  - Sends via Expo's managed push API (no direct APNs/FCM credentials needed)
  - Push tokens stored in Supabase `push_tokens` table with IANA timezone for local-hour delivery
  - Receipt checking and dead-token cleanup in `checkReceiptsAndCleanup()` (`apps/api/src/services/push.ts`)
  - Chunked to 100 messages per batch per Expo rate limit

## Data Storage

**Databases:**
- Supabase PostgreSQL with PostGIS extension
  - Connection (mobile): `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY` via `@supabase/supabase-js` in `apps/mobile/lib/supabase.ts`
  - Connection (API — anon): `SUPABASE_URL` + `SUPABASE_ANON_KEY` — used in `apps/api/src/middleware/auth.ts` for JWT verification and `apps/api/src/routes/restaurants.ts`
  - Connection (API — admin): `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` — service-role client used in routes that require bypassing RLS: swipes, saves, notifications, connections, matches, cron
  - ORM/Client: `@supabase/supabase-js` ^2.101.1 (no additional ORM)
  - Migrations: 9 migration files in `supabase/migrations/` covering schema, geo cache, lat/lng columns, push tokens, push sends, push token timezone, multiplayer matches, and connections
  - Local dev: Supabase CLI, port 54321 (API), 54322 (DB), project slug `foodies`

**File Storage:**
- None — Google Places photo URLs are hotlinked, not downloaded or stored

**Caching:**
- In-memory only via `node-cache` in the API process
  - Photo URL cache: 20h TTL (`apps/api/src/services/places.ts`)
  - Restaurant/nearby response cache: configurable TTL (`apps/api/src/services/geo-cache.ts`)
  - Cache resets on Render cold start — acceptable given slow restaurant data churn

## Authentication & Identity

**Auth Provider:**
- Supabase Auth — email + Google + Apple sign-in
  - Implementation: `@supabase/supabase-js` auth on mobile (`apps/mobile/lib/supabase.ts`)
  - Session config: `detectSessionInUrl: false`, `persistSession: true`, `storage: AsyncStorage`
  - Auto-refresh: `supabase.auth.startAutoRefresh()` on app foreground, `stopAutoRefresh()` on background (AppState listener in `apps/mobile/lib/supabase.ts`)

- Google Sign-In:
  - SDK: `@react-native-google-signin/google-signin` 16.1.2
  - Flow: Google ID token → `supabase.auth.signInWithIdToken()`
  - Configured in `apps/mobile/app/onboarding/index.tsx`
  - Required env: `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
  - iOS URL scheme: `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME` (configured in `app.config.ts`)

- Apple Sign-In:
  - SDK: `expo-apple-authentication` ~55.0.13
  - Enabled in `app.config.ts` (`usesAppleSignIn: true`)
  - Critical: `credential.fullName` only returned on first sign-in — must capture and persist immediately

**API Auth Middleware:**
- `apps/api/src/middleware/auth.ts` — validates Supabase JWT on incoming requests using anon-key Supabase client
- Routes requiring auth pass through this middleware before hitting route handlers

## Monitoring & Observability

**Error Tracking:**
- None — no Sentry, Datadog, or equivalent configured

**Logs:**
- Morgan HTTP request logging in API (`combined` format in production, `dev` in development)
- `console.error('[error]', err)` in Express centralized error handler
- No structured logging library (plain `console.*`)

**Health Check:**
- `GET /health` returns `{ status: 'ok', timestamp }` — used by UptimeRobot (external, not configured in repo) to prevent Render cold starts

## CI/CD & Deployment

**Hosting:**
- API: Render.com Node web service — `render.yaml` at repo root
  - Free tier, `oregon` region, 1 instance
  - Build: `pnpm install --frozen-lockfile && pnpm --filter @cravyr/shared build && pnpm --filter cravyr-api build`
  - Start: `node apps/api/dist/server.js`
  - Health check path: `/health`
  - Spins down after 15min idle (free tier); UptimeRobot pings recommended
- Mobile: EAS Build + App Store / Google Play
  - EAS project ID: `e6d2a650-fd20-4092-a4a5-0f7a211e1e1a`
  - iOS: App Store (`com.cravyr.app`), ASC App ID placeholder in `eas.json`
  - Android: Google Play internal track, service account key at `./google-sa.json` (not committed)
  - OTA updates: EAS Update (free up to 1,000 MAU)

**CI Pipeline:**
- No CI config file detected in repo (no `.github/workflows/` found) — deployments appear to be manual via Render auto-deploy on push + EAS CLI commands

## Webhooks & Callbacks

**Incoming:**
- `GET /auth/callback` — Supabase email confirmation redirect; serves `apps/api/src/public/auth-redirect.html` which deep-links back into the app via `cravyr://` scheme

**Outgoing:**
- Expo Push API — API server POSTs push messages to Expo's managed push service
- Google Places API — API server makes HTTP requests to `places.googleapis.com`

## Cron Jobs

**Internal (in-process):**
- `apps/api/src/services/cron.ts` — `startCronJobs()` called at server startup
- Runs timezone-aware daily push reminder for "Tonight's Picks" at `CRON_LOCAL_HOUR` (default 6 PM local) per user timezone, with UTC fallback at `CRON_SEND_HOUR` (default 23)
- Push receipt checking runs 15 minutes after nightly send
- Uses `setInterval` polling (no external scheduler); state is lost on cold start

## Environment Configuration

**Required API env vars:**
- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_ANON_KEY` — Supabase anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (admin access, bypasses RLS)
- `GOOGLE_PLACES_API_KEY` — Google Places API (New) key

**Optional API env vars:**
- `PORT` — default `3000`
- `CORS_ORIGIN` — default `*`
- `NODE_ENV` — `production` enables strict CSP and `combined` logs
- `CRON_LOCAL_HOUR` — default `18` (6 PM local push hour)
- `CRON_SEND_HOUR` — default `23` (UTC fallback push hour)

**Required mobile env vars (`EXPO_PUBLIC_` prefix):**
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_API_URL` — set to `https://cravyr-api.onrender.com` in production build via `eas.json`
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME`

**Optional mobile env vars:**
- `EXPO_PUBLIC_PRIVACY_URL` — falls back to `{API_URL}/privacy`

**Secrets location:**
- API: `apps/api/.env` (gitignored); `.env.example` template available
- Mobile: `apps/mobile/.env` (gitignored); `.env.example` template available
- Render env vars: set via Render dashboard (all `sync: false` in `render.yaml`)
- Google Play service account key: `apps/mobile/google-sa.json` (gitignored, referenced in `eas.json`)

---

*Integration audit: 2026-07-02*