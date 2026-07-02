<!-- refreshed: 2026-07-02 -->
# Architecture

**Analysis Date:** 2026-07-02

## System Overview

```text
┌─────────────────────────────────────────────────────────────────────┐
│                    Expo Router (File-based Navigation)               │
│   app/_layout.tsx  ·  app/(tabs)/  ·  app/onboarding/              │
└────────────┬──────────────────────┬────────────────────────────────┘
             │                      │
             ▼                      ▼
┌─────────────────────┐  ┌──────────────────────────────────────────┐
│  Zustand Stores     │  │  React Components (screens + presentational) │
│  apps/mobile/stores │  │  apps/mobile/app/  +  apps/mobile/components/ │
└────────┬────────────┘  └──────────────────────┬───────────────────┘
         │                                        │
         └──────────────┬─────────────────────────┘
                        │  fetch() via lib/api.ts
                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  Express.js API  (apps/api)                          │
│  server.ts  ·  routes/  ·  middleware/auth.ts  ·  services/         │
└────────────┬────────────────────────────────────────────────────────┘
             │ @supabase/supabase-js
             ▼
┌──────────────────────────────────┐   ┌─────────────────────────────┐
│  Supabase (Auth + PostGIS DB)    │   │  Google Places API (New) v1  │
│  RLS · RPC get_restaurant_recs   │   │  api.places.googleapis.com  │
└──────────────────────────────────┘   └─────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Root Layout | Auth guard, session management, push token registration | `apps/mobile/app/_layout.tsx` |
| Discover Screen | Deck fetch orchestration, swipe event handlers, optimistic picks | `apps/mobile/app/(tabs)/discover.tsx` |
| SwipeDeck | rn-swiper-list wrapper, image prefetch, action buttons | `apps/mobile/components/SwipeDeck/SwipeDeck.tsx` |
| SwipeCard | Individual restaurant card rendering | `apps/mobile/components/SwipeCard/SwipeCard.tsx` |
| Zustand Stores | Client-side state (deck, picks, preferences, connections, matches) | `apps/mobile/stores/` |
| API Server | REST API, auth middleware, photo proxy, cron jobs | `apps/api/src/server.ts` |
| Places Service | Google Places API client, field-masked calls, node-cache TTL | `apps/api/src/services/places.ts` |
| Cron Service | Hourly daily-reminder ticker, push_sends dedupe, receipt checks | `apps/api/src/services/cron.ts` |
| Geo-Cache Service | Geographic cluster cache for nearby searches | `apps/api/src/services/geo-cache.ts` |
| Restaurant Mapper | Maps Google Places API response rows to shared `Restaurant` type | `apps/api/src/utils/restaurant-mapper.ts` |
| Shared Package | Shared TypeScript types + Zod validation schemas | `packages/shared/src/` |

## Pattern Overview

**Overall:** Layered monorepo — mobile client (Expo) + REST API (Express) + shared contract package

**Key Characteristics:**
- Shared types in `@cravyr/shared` ensure `Restaurant`, `SavedRestaurant`, and Zod schemas are identical between mobile and API
- Mobile client is Zustand-managed; all server state flows through Zustand stores that screens subscribe to
- API is stateless per-request; restaurant and photo URL caching is in-memory via `node-cache` (not Redis)
- PostGIS RPC function `get_restaurant_recommendations` scores the deck entirely in SQL — no server-side ranking logic
- Google Places photo references are never stored as resolved URLs; `apps/mobile/lib/api.ts:photoProxyUrl` routes through `/api/v1/photos/resolve` which 301-redirects to a fresh Google CDN URL

## Layers

**Routing / Navigation (mobile):**
- Purpose: File-based route definition and auth guard
- Location: `apps/mobile/app/`
- Contains: Screen entry points, layout files, auth redirect handler
- Depends on: Zustand stores, components, `lib/supabase.ts`
- Used by: Users navigating the app

**Component Layer (mobile):**
- Purpose: Presentational and compound UI components
- Location: `apps/mobile/components/`
- Contains: `SwipeDeck/`, `SwipeCard/`, `RestaurantRow/`, `PhotoGallery/`, `MatchModal`, `ErrorBoundary`
- Depends on: Zustand stores (read-only), `lib/theme.ts`, `lib/api.ts` (for photo proxy URLs)
- Used by: Screen files in `apps/mobile/app/`

**State Layer (mobile):**
- Purpose: Global client state management
- Location: `apps/mobile/stores/`
- Contains: `swipeDeckStore.ts`, `picksStore.ts`, `preferencesStore.ts`, `connectionsStore.ts`, `matchesStore.ts`
- Depends on: `@cravyr/shared` types
- Used by: Screen components and `SwipeDeck`

**Library / Infra (mobile):**
- Purpose: Supabase client, API base URL, photo proxy helper, design tokens
- Location: `apps/mobile/lib/`
- Contains: `supabase.ts`, `api.ts`, `theme.ts`
- Depends on: `@supabase/supabase-js`, env vars
- Used by: Screens, stores, root layout

**Route Handlers (API):**
- Purpose: HTTP request handling per resource
- Location: `apps/api/src/routes/`
- Contains: `restaurants.ts`, `recommendations.ts`, `swipes.ts`, `saves.ts`, `users.ts`, `notifications.ts`, `connections.ts`, `matches.ts`, `places.ts`
- Depends on: `middleware/auth.ts`, `middleware/validate.ts`, `@cravyr/shared` schemas, Supabase client
- Used by: `server.ts` mounting

**Services (API):**
- Purpose: Business logic and external API clients
- Location: `apps/api/src/services/`
- Contains: `places.ts` (Google Places HTTP client), `cron.ts` (hourly jobs), `push.ts` (Expo push), `geo-cache.ts` (geographic clustering cache)
- Depends on: `node-cache`, `@supabase/supabase-js`, env vars
- Used by: Route handlers, `server.ts`

**Middleware (API):**
- Purpose: Cross-cutting request concerns
- Location: `apps/api/src/middleware/`
- Contains: `auth.ts` (JWT verification via Supabase), `validate.ts` (Zod body/query validation)
- Depends on: `@supabase/supabase-js`, `@cravyr/shared` schemas
- Used by: All authenticated route routers

**Shared Contract:**
- Purpose: Single source of truth for types and validation between mobile and API
- Location: `packages/shared/src/`
- Contains: `types/restaurant.ts`, `types/saves.ts`, `types/preferences.ts`, `types/push-token.ts`, `validation/schemas.ts`
- Depends on: `zod`
- Used by: Both `apps/mobile` and `apps/api`

## Data Flow

### Primary Request Path — Swipe Card Discovery

1. `app/_layout.tsx` checks Supabase session; redirects to `/onboarding` if unauthenticated
2. `app/(tabs)/discover.tsx:fetchDeck` requests device location via `expo-location`
3. `discover.tsx` calls `GET /api/v1/restaurants/nearby` to warm geo-cache (upserts restaurants into Supabase)
4. `discover.tsx` calls `GET /api/v1/recommendations?lat=&lng=` with Bearer token
5. `apps/api/src/routes/recommendations.ts` — `requireAuth` middleware verifies JWT via `supabase.auth.getUser()`
6. Route calls `supabase.rpc('get_restaurant_recommendations', { p_user_id, p_lat, p_lng })` — PostGIS scores and ranks
7. Results mapped through `utils/restaurant-mapper.ts` to `Restaurant` type from `@cravyr/shared`
8. Mobile receives array, calls `swipeDeckStore.setDeck(restaurants)` — Zustand notifies `SwipeDeck`
9. `SwipeDeck` passes deck to `rn-swiper-list <Swiper>`; animations run on native UI thread via Reanimated worklets

### Swipe Action Flow

1. User swipes right on a card (`SwipeDeck.handleSwipeRight`)
2. `discover.tsx:handleSave` is called with the `Restaurant` object
3. Optimistic `SavedRestaurant` is injected into `picksStore` immediately (instant UI update)
4. `POST /api/v1/swipes` with `{ restaurant_id, direction: 'right' }` is sent in background
5. Supabase DB trigger auto-inserts into `saves` table on right-swipe
6. When the Saved tab gains focus, `picksStore` refetches from `/api/v1/saves` to replace optimistic entry

### Photo Resolution Flow

1. `SwipeCard` renders `photoProxyUrl(restaurant.photo_urls[0])` from `apps/mobile/lib/api.ts`
2. If `photo_urls[0]` is a Google Places photo name (not `http*`), URL is `/api/v1/photos/resolve?name=...`
3. `server.ts` handles `GET /api/v1/photos/resolve` — validates query with `PhotoResolveQuerySchema`
4. `services/places.ts:resolvePhotoUrl` hits Google Places API; caches resolved CDN URL in `node-cache` for 20 hours
5. API responds with HTTP 301 redirect to the Google CDN URL
6. `SwipeDeck.handleIndexChange` prefetches the next 2–3 photo URLs via `expo-image.prefetch()`

### Push Notification Flow

1. `app/_layout.tsx:registerPushToken` fires on login and app foreground
2. Token + platform + timezone POSTed to `/api/v1/notifications/register` → stored in `push_tokens` table
3. `services/cron.ts:tickDailyReminder` runs every hour via `setInterval`
4. Cron evaluates each token's local timezone against `LOCAL_HOUR`; dedupes via `push_sends` table upsert
5. `services/push.ts:sendPushNotifications` batches tokens to Expo Push API; schedules receipt check 15 min later

**State Management:**
- No Redux; Zustand stores are the only global state layer on mobile
- Server state is not persisted locally between sessions (re-fetched on mount/focus)
- `preferencesStore.ts` holds `travelLocation` (manual location override) and `preferencesVersion` (invalidation counter)

## Key Abstractions

**`Restaurant` type (`@cravyr/shared`):**
- Purpose: Canonical restaurant shape shared between API and mobile
- Examples: `packages/shared/src/types/restaurant.ts`, consumed in `apps/mobile/stores/swipeDeckStore.ts`, `apps/api/src/utils/restaurant-mapper.ts`
- Pattern: All route handlers and stores import from `@cravyr/shared`, never from local type files

**`Zod Schemas` (`@cravyr/shared`):**
- Purpose: Request validation with static type inference
- Examples: `packages/shared/src/validation/schemas.ts`
- Pattern: `validate(Schema, 'body'|'query')` middleware in route files; `res.locals.validated` holds parsed result

**`requireAuth` middleware:**
- Purpose: JWT verification + `req.user` population
- Location: `apps/api/src/middleware/auth.ts`
- Pattern: Applied at router level (`router.use(requireAuth)`) so all routes in a router inherit it; `userId` always sourced from `req.user.id`, never from URL params or body

**`photoProxyUrl` helper:**
- Purpose: Normalize Google photo references to proxied URLs transparently
- Location: `apps/mobile/lib/api.ts`
- Pattern: Called at render time; passes through already-resolved `http*` URLs unchanged; routes raw photo names through `/api/v1/photos/resolve`

## Entry Points

**Mobile App:**
- Location: `apps/mobile/app/_layout.tsx`
- Triggers: Expo Router mount
- Responsibilities: Session hydration, push token registration, auth guard redirect, font loading, `GestureHandlerRootView` wrapper

**API Server:**
- Location: `apps/api/src/server.ts`
- Triggers: `node dist/server.js` (production) or `ts-node src/server.ts` (dev)
- Responsibilities: Middleware stack setup, route mounting, health check, cron job start

**Onboarding Entry:**
- Location: `apps/mobile/app/onboarding/index.tsx`
- Triggers: Auth guard redirect when no session
- Responsibilities: Social/email auth initiation

## Architectural Constraints

- **Threading (mobile):** Swipe animations execute on the native UI thread via Reanimated worklets inside `rn-swiper-list`. JS thread is never on the critical path for animation frames.
- **Caching (API):** `node-cache` is module-level singleton in `apps/api/src/services/places.ts`. Cache state is lost on cold starts; this is acceptable because restaurant data is slow-changing.
- **Photo URL ToS:** Google Places photo URLs must never be downloaded to own storage. Always redirect (301) from the proxy; never store the resolved CDN URL beyond the `node-cache` TTL.
- **Supabase RLS:** `auth.uid()` is always wrapped as `(SELECT auth.uid())` in RLS policies for per-statement caching (see migrations).
- **User ID sourcing:** `userId` in API handlers is always taken from the verified JWT (`req.user.id`), never from request parameters (T-04-05-01 security constraint).
- **Connections hack:** `apps/api/src/routes/connections.ts` currently calls `supabaseAdmin.auth.admin.listUsers()` to fetch user names because there is no `public.profiles` table — see CONCERNS.md.

## Anti-Patterns

### Fetching user names via admin.listUsers()

**What happens:** `apps/api/src/routes/connections.ts` calls `supabaseAdmin.auth.admin.listUsers()` (fetching all users) to get display names for a user's connections list.
**Why it's wrong:** It loads every user in the system for every connections fetch, is not scalable, and exposes data outside intended access patterns.
**Do this instead:** Create a `public.profiles` table seeded on first sign-in, apply RLS, and join against it in the connections query.

### Duplicate Supabase client instantiation in routes

**What happens:** Each route file in `apps/api/src/routes/` creates its own `createClient()` call at module level.
**Why it's wrong:** Produces multiple client instances with different roles (anon vs service role), can cause confusion and unnecessary connections.
**Do this instead:** Extract shared singleton clients (one anon, one service-role) to `apps/api/src/lib/supabase.ts` and import them.

## Error Handling

**Strategy:** Express 5 async error propagation — no manual `try/catch` required in route handlers; thrown errors and rejected promises reach the centralized `errorHandler` in `apps/api/src/server.ts` automatically.

**Patterns:**
- API: Central `errorHandler` at bottom of `server.ts` responds `{ error: 'Internal server error' }` with HTTP 500
- Validation errors: `middleware/validate.ts` responds 400 with structured Zod issue list before handler runs
- Auth errors: `middleware/auth.ts` responds 401 before handler runs
- Mobile: `ErrorBoundary` (`apps/mobile/components/ErrorBoundary.tsx`) wraps the root layout; swipe deck errors set `hasError` in `swipeDeckStore` to show a retry UI

## Cross-Cutting Concerns

**Logging:** `morgan` (dev: `'dev'` format, production: `'combined'`) on every API request; `console.error('[error]', err)` in the central error handler; `console.log('[cron] ...')` in cron jobs
**Validation:** Zod schemas from `@cravyr/shared`; applied via `validate()` middleware on API routes; also used inline in `server.ts` for the photo resolve endpoint
**Authentication:** Supabase JWT verified server-side on every authenticated route via `requireAuth`; mobile reads session from `supabase.auth.getSession()` in `_layout.tsx`

---

*Architecture analysis: 2026-07-02*
