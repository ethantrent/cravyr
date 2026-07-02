# Codebase Structure

**Analysis Date:** 2026-07-02

## Directory Layout

```
cravyr/                               # Monorepo root
├── apps/
│   ├── mobile/                       # Expo React Native app
│   │   ├── app/                      # Expo Router file-based routes
│   │   │   ├── _layout.tsx           # Root layout — auth guard, session, fonts
│   │   │   ├── index.tsx             # Splash/redirect shim
│   │   │   ├── auth-callback.tsx     # Supabase email link deep link handler
│   │   │   ├── (tabs)/               # Bottom tab group
│   │   │   │   ├── _layout.tsx       # Tab bar configuration
│   │   │   │   ├── discover.tsx      # Swipe deck screen (primary feature)
│   │   │   │   └── saved.tsx         # Tonight's Picks list
│   │   │   ├── onboarding/           # Onboarding flow (unauthenticated entry)
│   │   │   │   ├── _layout.tsx
│   │   │   │   ├── index.tsx         # Welcome / auth screen
│   │   │   │   ├── cuisines.tsx
│   │   │   │   ├── distance.tsx
│   │   │   │   ├── location.tsx
│   │   │   │   ├── location-denied.tsx
│   │   │   │   └── price.tsx
│   │   │   ├── restaurant/
│   │   │   │   └── [id].tsx          # Restaurant detail view
│   │   │   ├── connections.tsx       # Friends / connections screen
│   │   │   ├── location-search.tsx   # Manual travel location picker
│   │   │   ├── preferences.tsx       # User preference editing
│   │   │   └── settings.tsx          # App settings
│   │   ├── components/               # Reusable UI components
│   │   │   ├── SwipeDeck/
│   │   │   │   └── SwipeDeck.tsx     # rn-swiper-list wrapper + action buttons
│   │   │   ├── SwipeCard/
│   │   │   │   ├── SwipeCard.tsx     # Individual restaurant card
│   │   │   │   ├── CardSkeleton.tsx  # Loading skeleton
│   │   │   │   └── OverlayLabels.tsx # Save/Skip/Superlike drag overlays
│   │   │   ├── PhotoGallery/
│   │   │   │   └── PhotoGallery.tsx  # Photo carousel for detail view
│   │   │   ├── RestaurantRow/
│   │   │   │   └── RestaurantRow.tsx # Row item for saved list
│   │   │   ├── onboarding/
│   │   │   │   └── StepProgress.tsx  # Step indicator
│   │   │   ├── ErrorBoundary.tsx     # React error boundary (root-level)
│   │   │   └── MatchModal.tsx        # Friend match modal overlay
│   │   ├── stores/                   # Zustand global state
│   │   │   ├── swipeDeckStore.ts     # Deck array, undo stack, loading/error
│   │   │   ├── picksStore.ts         # Tonight's Picks (saved restaurants)
│   │   │   ├── preferencesStore.ts   # Cuisines, price, distance, travelLocation
│   │   │   ├── connectionsStore.ts   # Friends list and selection state
│   │   │   └── matchesStore.ts       # Shared-save match data
│   │   ├── lib/                      # Infrastructure utilities
│   │   │   ├── api.ts                # API_URL, getAuthHeader(), photoProxyUrl()
│   │   │   ├── supabase.ts           # Supabase client singleton
│   │   │   └── theme.ts              # Design tokens (colors, typography, spacing)
│   │   ├── app.config.ts             # Expo config (bundle ID, plugins, env)
│   │   └── expo-env.d.ts             # Expo global type declarations
│   │
│   └── api/                          # Express.js backend
│       └── src/
│           ├── server.ts             # App entry — middleware, route mount, cron start
│           ├── routes/               # One file per resource
│           │   ├── restaurants.ts    # GET /nearby — geo-cache + Google Places upsert
│           │   ├── recommendations.ts # GET / — PostGIS RPC scoring
│           │   ├── swipes.ts         # POST / — log swipe direction
│           │   ├── saves.ts          # GET + DELETE — Tonight's Picks list
│           │   ├── users.ts          # GET /me, PUT preferences
│           │   ├── notifications.ts  # POST /register — push token upsert
│           │   ├── connections.ts    # GET + POST — friends/connections
│           │   ├── matches.ts        # GET — shared saves intersection
│           │   └── places.ts         # GET — pass-through place detail proxy
│           ├── middleware/
│           │   ├── auth.ts           # requireAuth — JWT verification via Supabase
│           │   └── validate.ts       # validate(Schema, target) — Zod middleware
│           ├── services/
│           │   ├── places.ts         # Google Places API (New) HTTP client + cache
│           │   ├── places-constants.ts # Field masks, price level maps, type maps
│           │   ├── geo-cache.ts      # Geographic cluster cache for nearby searches
│           │   ├── cron.ts           # Hourly cron — daily reminder push notifications
│           │   └── push.ts           # Expo push notification sender + receipt checker
│           ├── utils/
│           │   └── restaurant-mapper.ts # Google Places row → @cravyr/shared Restaurant
│           ├── public/
│           │   ├── auth-redirect.html   # Deep link bounce page for email confirm
│           │   └── privacy.html         # Privacy policy (required by App Store)
│           └── __tests__/
│               ├── setup.ts
│               ├── health.test.ts
│               ├── auth-guard.test.ts
│               └── validation.test.ts
│
├── packages/
│   └── shared/                       # @cravyr/shared — contract package
│       └── src/
│           ├── index.ts              # Re-exports all public types and schemas
│           ├── types/
│           │   ├── restaurant.ts     # Restaurant, RestaurantCard, InteractionType
│           │   ├── saves.ts          # SavedRestaurant
│           │   ├── preferences.ts    # UserPreferences, CuisineOption, CUISINE_OPTIONS
│           │   └── push-token.ts     # PushToken
│           └── validation/
│               └── schemas.ts        # Zod schemas: SwipeBody, LatLngQuery, etc.
│
├── .planning/                        # GSD planning artifacts
├── .claude/                          # Claude Code configuration
├── .agents/                          # Agent skills
├── turbo.json                        # Turborepo task pipeline
├── pnpm-workspace.yaml               # pnpm workspace config
├── package.json                      # Root dev dependencies (turbo, TypeScript)
└── CLAUDE.md                         # Project overview and tech blueprint
```

## Directory Purposes

**`apps/mobile/app/`:**
- Purpose: All Expo Router routes — file name = URL path
- Contains: Screen components (not reusable), layout files, dynamic route `[id]`
- Key files: `_layout.tsx` (auth gate), `(tabs)/discover.tsx` (core feature), `onboarding/index.tsx` (auth entry)

**`apps/mobile/components/`:**
- Purpose: Reusable and compound UI components consumed by screen files
- Contains: Grouped by feature (`SwipeDeck/`, `SwipeCard/`, `RestaurantRow/`, `PhotoGallery/`, `onboarding/`) and standalone cross-cutting components
- Key files: `SwipeDeck/SwipeDeck.tsx`, `SwipeCard/SwipeCard.tsx`

**`apps/mobile/stores/`:**
- Purpose: All Zustand global state — one file per domain
- Contains: State interfaces + `create()` store with actions
- Key files: `swipeDeckStore.ts` (deck + undo), `picksStore.ts` (saved), `preferencesStore.ts` (user prefs + travel location)

**`apps/mobile/lib/`:**
- Purpose: Singleton infrastructure clients and pure utility functions
- Contains: Supabase client, API URL/header helpers, photo proxy, design tokens
- Key files: `api.ts` (photo proxy URL builder), `supabase.ts`, `theme.ts`

**`apps/api/src/routes/`:**
- Purpose: Express Router instances — one file per REST resource
- Contains: Route handlers; each file calls `router.use(requireAuth)` at the top for protected resources
- Key files: `recommendations.ts` (PostGIS RPC), `restaurants.ts` (Google Places upsert), `connections.ts`

**`apps/api/src/services/`:**
- Purpose: External API clients and background jobs — no HTTP concerns
- Contains: Google Places HTTP client, Expo push sender, cron scheduler, geo-cluster cache
- Key files: `places.ts`, `cron.ts`, `push.ts`, `geo-cache.ts`

**`packages/shared/src/`:**
- Purpose: Single source of truth for types and Zod schemas used by both mobile and API
- Contains: TypeScript interfaces, Zod schemas, shared constants
- Key files: `types/restaurant.ts`, `validation/schemas.ts`, `index.ts`

## Key File Locations

**Entry Points:**
- `apps/mobile/app/_layout.tsx`: Mobile app root — auth guard and session management
- `apps/api/src/server.ts`: API server bootstrap and middleware stack

**Configuration:**
- `apps/mobile/app.config.ts`: Expo app config (bundle ID, EAS project ID, plugins)
- `turbo.json`: Turborepo task pipeline (build, test, typecheck)
- `pnpm-workspace.yaml`: Workspace package paths
- `apps/api/render.yaml`: Render.com deployment blueprint

**Core Logic:**
- `apps/mobile/app/(tabs)/discover.tsx`: Swipe deck data fetching and event orchestration
- `apps/mobile/components/SwipeDeck/SwipeDeck.tsx`: rn-swiper-list integration
- `apps/api/src/services/places.ts`: Google Places API client (field masks, caching)
- `apps/api/src/services/cron.ts`: Push notification scheduling

**Shared Contract:**
- `packages/shared/src/index.ts`: All public exports from the shared package
- `packages/shared/src/types/restaurant.ts`: `Restaurant` type — the most-used shared type
- `packages/shared/src/validation/schemas.ts`: All Zod request schemas

**Testing:**
- `apps/api/src/__tests__/`: API unit tests (Jest)

## Naming Conventions

**Files:**
- React components: PascalCase — `SwipeDeck.tsx`, `SwipeCard.tsx`, `MatchModal.tsx`
- Expo Router screens: camelCase or kebab-case matching URL — `discover.tsx`, `location-search.tsx`, `[id].tsx`
- Zustand stores: camelCase with `Store` suffix — `swipeDeckStore.ts`, `picksStore.ts`
- API routes: camelCase noun plural — `restaurants.ts`, `recommendations.ts`
- API services/utils: camelCase noun — `places.ts`, `geo-cache.ts`, `restaurant-mapper.ts`

**Directories:**
- Component subdirectories: PascalCase matching the primary component — `SwipeDeck/`, `SwipeCard/`
- Route groups in Expo Router: parentheses notation — `(tabs)/`

**Exports:**
- Named exports used throughout (no default exports on components, stores, or utilities)
- Exception: Expo Router screen files use `export default function` per Expo Router requirement

## Where to Add New Code

**New Screen:**
- File: `apps/mobile/app/<route-name>.tsx` (or `app/(tabs)/<route-name>.tsx` for tab screens)
- Register in: `apps/mobile/app/_layout.tsx` `<Stack.Screen>` block if custom header options needed
- Tests: `apps/api/src/__tests__/` if there's a new API endpoint; no mobile screen test pattern yet

**New Reusable Component:**
- Implementation: `apps/mobile/components/<ComponentName>/<ComponentName>.tsx`
- If it needs sub-files (skeleton, overlays): place in same directory `components/<ComponentName>/`

**New Zustand Store:**
- Implementation: `apps/mobile/stores/<domain>Store.ts`
- Pattern: Follow `swipeDeckStore.ts` — define interface, use `create<State>()((set, get) => ({...}))`

**New API Route:**
- Implementation: `apps/api/src/routes/<resource>.ts`
- Mount in: `apps/api/src/server.ts` with `app.use('/api/v1/<resource>', <resource>Router)`
- Add auth: `router.use(requireAuth)` at top of router file

**New Shared Type:**
- Type: `packages/shared/src/types/<name>.ts`
- Schema: `packages/shared/src/validation/schemas.ts` (add Zod schema + export inferred type)
- Export: Add re-export to `packages/shared/src/index.ts`

**New Service (API):**
- Implementation: `apps/api/src/services/<name>.ts`
- Pattern: Export named functions; use `NodeCache` instance at module level for caching if needed

**New Utility (API):**
- Implementation: `apps/api/src/utils/<name>.ts`
- Pattern: Pure functions, no side effects; follow `restaurant-mapper.ts`

## Special Directories

**`packages/shared/dist/`:**
- Purpose: Compiled output of the shared package (tsc build)
- Generated: Yes — built by `turbo run build`
- Committed: Yes (enables the package to work without a build step in consuming apps)

**`apps/mobile/.expo/`:**
- Purpose: Expo CLI generated types and cache
- Generated: Yes
- Committed: Partial — `types/router.d.ts` is committed for TypeScript path types

**`.planning/`:**
- Purpose: GSD workflow planning artifacts (phases, codebase maps)
- Generated: By GSD commands
- Committed: Yes

**`.agents/skills/`:**
- Purpose: External skill repos (awesome-design-md)
- Generated: No (cloned)
- Committed: References only (submodule-style, not tracked per `.gitignore`)

---

*Structure analysis: 2026-07-02*
