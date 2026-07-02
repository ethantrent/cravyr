# Technology Stack

**Analysis Date:** 2026-07-02

## Languages

**Primary:**
- TypeScript 5.3.3 — all source code across mobile, API, and shared packages

**Secondary:**
- SQL — Supabase migrations in `supabase/migrations/` (PostGIS extensions, RLS policies, stored procedures)

## Runtime

**Environment:**
- Node.js >=18 (API server and build scripts)
- React Native 0.83.4 (mobile, via Expo managed workflow)

**Package Manager:**
- pnpm 9.15.9 (declared in `package.json` `packageManager` field)
- Lockfile: `pnpm-lock.yaml` present and committed

## Monorepo

**Orchestrator:** Turborepo 2.9.4 (`turbo.json`)
- Task pipeline: `build → typecheck → test → lint`
- `dev` task is persistent and non-cached
- Workspace config: `pnpm-workspace.yaml` — `apps/*` and `packages/*`

**Workspace packages:**
- `apps/mobile` — Expo React Native app (`cravyr-mobile`)
- `apps/api` — Express.js API server (`cravyr-api`)
- `packages/shared` — Shared types and Zod schemas (`@cravyr/shared`)

## Frameworks

**Mobile (`apps/mobile`):**
- Expo SDK ~55.0.14 — managed workflow with `newArchEnabled: true`
- Expo Router ~55.0.12 — file-based routing, scheme `cravyr://`
- React 19.2.0 / React Native 0.83.4
- react-native-reanimated 4.2.1 — native-thread animation worklets
- react-native-gesture-handler ~2.30.0 — gesture recognition
- react-native-worklets 0.7.2 — worklet runtime (required peer for rn-swiper-list 3.x)
- rn-swiper-list ^3.0.0 — 60fps card swipe deck
- expo-image ~55.0.8 — cached image rendering with prefetch
- expo-location ~55.1.8 — device GPS
- expo-notifications ~55.0.19 — push token registration and receipt
- expo-apple-authentication ~55.0.13 — Apple Sign-In
- @react-native-google-signin/google-signin 16.1.2 — Google Sign-In
- expo-linear-gradient ~55.0.13 — UI gradients
- Zustand ^5.0.12 — global state management (stores in `apps/mobile/stores/`)
- @react-native-async-storage/async-storage ^2.1.2 — Supabase session persistence

**API (`apps/api`):**
- Express.js ^5.2.1 — async error propagation, no try/catch boilerplate needed
- helmet ^8.1.0 — security headers (CSP disabled in non-production)
- cors ^2.8.6 — configurable via `CORS_ORIGIN` env var
- express-rate-limit ^8.3.2 — 500 req/15min, keyed by hashed auth token or IP
- morgan ^1.10.1 — request logging (`combined` in prod, `dev` in development)
- node-cache ^5.1.2 — in-memory TTL cache for Google Places responses
- ngeohash ^0.6.3 — geohash encoding for geo-cache clustering
- expo-server-sdk ^6.1.0 — Expo push notification delivery
- dotenv ^17.4.1 — env var loading

**Shared (`packages/shared`):**
- Zod ^4.3.6 — runtime validation schemas (also used for API request validation)
- Compiled to `dist/` for Node.js consumers; raw `src/` consumed by React Native via `exports` conditional

**Testing:**
- vitest ^4.1.4 — API unit/integration tests (`apps/api/src/__tests__/`)
- supertest ^7.2.2 — HTTP integration testing against Express app

## Build / Dev Tooling

- Babel with `babel-preset-expo` and `react-native-reanimated/plugin` (`apps/mobile/babel.config.js`)
- TypeScript strict mode across all packages
- `ts-node` ^10.9.2 — API dev server (`pnpm dev`)
- EAS CLI >=16.0.0 — mobile builds and OTA updates
- `patch-package` ^8.0.1 — React Native gradle patch applied via `scripts/patch-rn-gradle.js` on postinstall
- `sharp` ^0.34.5 — icon generation script (`scripts/generate-app-icons.mjs`)
- Supabase CLI ^2.107.0 (dev dependency at workspace root) — local DB and migrations

## Key Dependencies

**Critical:**
- `@cravyr/shared` (workspace:*) — shared Zod schemas and TypeScript types, consumed by both `apps/mobile` and `apps/api`; type drift between frontend and backend is prevented by this single source of truth
- `rn-swiper-list` + `react-native-worklets` — core swipe UX; worklets peer dep must be installed explicitly in pnpm hoisted setup
- `react-native-reanimated` 4.x — required for native-thread animations; Babel plugin `react-native-reanimated/plugin` must be the last plugin in babel config

**Infrastructure:**
- `expo-server-sdk` — Expo push API client; batches to 100 messages per chunk
- `node-cache` — in-memory cache that resets on cold start; TTLs: photo URLs 20h, restaurant lists 1h, details 2h, recommendations 15min

## Configuration

**Environment (API):**
- Loaded via `dotenv/config` at server startup
- Required: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_PLACES_API_KEY`
- Optional: `PORT` (default 3000), `CORS_ORIGIN` (default `*`), `CRON_SEND_HOUR` (default `23`), `CRON_LOCAL_HOUR` (default `18`), `NODE_ENV`
- Server performs fail-fast validation at startup — throws in production if required vars are missing

**Environment (Mobile):**
- All vars prefixed `EXPO_PUBLIC_` (bundled into the app at build time)
- Required: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_API_URL`
- Required for auth: `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME`
- Optional: `EXPO_PUBLIC_PRIVACY_URL`
- `.env` files present at `apps/api/.env` and `apps/mobile/.env` (gitignored); `.env.example` templates available

**Build:**
- `apps/mobile/app.config.ts` — Expo dynamic config; EAS project ID `e6d2a650-fd20-4092-a4a5-0f7a211e1e1a`
- `apps/mobile/eas.json` — build profiles: `development` (dev client, APK), `preview` (internal), `production` (auto-increment, sets `EXPO_PUBLIC_API_URL` to production URL)
- `render.yaml` — Render Blueprint at repo root; deploys `cravyr-api` as free-tier Node web service in `oregon` region
- `supabase/config.toml` — local Supabase project config (`project_id = "foodies"`, API on port 54321)

## Platform Requirements

**Development:**
- Node.js >=18
- pnpm >=9
- EAS CLI >=16 for mobile builds
- Supabase CLI for local DB (`supabase start`)
- iOS Simulator or Android Emulator, or physical device with Expo Go / dev client

**Production:**
- API: Render.com Node web service (free tier; upgrade to Starter $7/mo recommended)
- Mobile: Apple App Store (`com.cravyr.app`) and Google Play (`com.cravyr.app`)
- Database: Supabase hosted PostgreSQL with PostGIS extension
- OTA updates: EAS Update (free up to 1,000 MAU)

---

*Stack analysis: 2026-07-02*
