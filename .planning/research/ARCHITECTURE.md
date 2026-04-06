# Architecture Patterns

**Domain:** Swipe-based restaurant discovery app (Cravyr)
**Researched:** 2026-04-06
**Method:** Training data (cutoff Aug 2025) + live npm versions provided by user
**Versions in use:** Expo SDK 55, react-native-reanimated 4.3.0, rn-swiper-list 3.0.0, express 5.2.1, zustand 5.0.12, turbo 2.9.4

---

## System Overview

Cravyr is a three-component system: a React Native mobile app (Expo SDK 55, Expo Router, Zustand v5) that communicates with a thin Express v5 API proxy (on Render) for all Google Places calls, and directly with Supabase for auth and user data (swipes, saves, preferences). PostGIS runs inside Supabase and powers the recommendation SQL function. The monorepo is managed by Turborepo 2.9.4 with pnpm workspaces. Shared Zod schemas live in `packages/shared` to enforce a single contract between mobile and API.

The critical cost insight: the mobile app **never calls Google Places API directly**. All Places calls go through `apps/api`, which applies field masks, geographic cluster batching, and in-memory `node-cache` to keep costs at ~$150–275/month at 1K DAU instead of ~$30K.

---

## Monorepo Structure

```
cravyr/
├── CLAUDE.md
├── turbo.json
├── pnpm-workspace.yaml
├── .npmrc                          # node-linker=hoisted — required for EAS + Metro
├── package.json                    # root — devDependencies only (turbo, typescript)
├── apps/
│   ├── mobile/                     # Expo SDK 55 React Native app
│   │   ├── app/                    # Expo Router file-based routing
│   │   │   ├── _layout.tsx         # Root layout (auth gate, fonts, providers)
│   │   │   ├── (auth)/
│   │   │   │   ├── _layout.tsx
│   │   │   │   ├── login.tsx
│   │   │   │   └── onboarding.tsx
│   │   │   ├── (tabs)/
│   │   │   │   ├── _layout.tsx     # Tab bar definition
│   │   │   │   ├── discover.tsx    # Swipe deck screen
│   │   │   │   └── saved.tsx       # Tonight's Picks screen
│   │   │   └── restaurant/
│   │   │       └── [id].tsx        # Detail view (dynamic route)
│   │   ├── components/
│   │   │   ├── SwipeDeck.tsx       # rn-swiper-list wrapper
│   │   │   ├── RestaurantCard.tsx  # Single card (expo-image + data)
│   │   │   └── ActionButtons.tsx   # Like / skip / superlike controls
│   │   ├── stores/                 # Zustand v5 stores
│   │   │   ├── deckStore.ts        # Swipe deck state + card queue
│   │   │   ├── authStore.ts        # Supabase session + user profile
│   │   │   └── preferencesStore.ts # Cuisine, price, distance filters
│   │   ├── lib/
│   │   │   ├── supabase.ts         # Supabase client (singleton)
│   │   │   └── api.ts              # Typed fetch wrapper for apps/api
│   │   ├── metro.config.js         # watchFolders pointing to packages/shared
│   │   ├── app.json
│   │   ├── eas.json
│   │   ├── babel.config.js
│   │   └── package.json
│   └── api/                        # Express v5 backend on Render
│       ├── src/
│       │   ├── index.ts            # App entry, middleware, route mounting
│       │   ├── routes/
│       │   │   ├── restaurants.ts  # GET /restaurants/nearby, GET /restaurants/:id
│       │   │   └── recommendations.ts  # POST /recommendations
│       │   ├── services/
│       │   │   ├── placesService.ts    # Google Places API (New) calls
│       │   │   └── recommendationService.ts  # Calls Supabase RPC
│       │   └── cache/
│       │       └── placesCache.ts  # node-cache wrapper (TTL logic)
│       ├── render.yaml
│       └── package.json
└── packages/
    └── shared/                     # @cravyr/shared — published internally via pnpm
        ├── src/
        │   ├── types/
        │   │   ├── restaurant.ts   # Restaurant, Photo, OpeningHours types
        │   │   ├── swipe.ts        # SwipeAction, SwipeRecord types
        │   │   └── user.ts         # UserProfile, Preferences types
        │   └── validation/
        │       ├── restaurantSchema.ts  # Zod schemas for Places API response
        │       └── apiSchemas.ts        # Request/response schemas for apps/api
        ├── tsconfig.json
        └── package.json            # name: "@cravyr/shared"
```

---

## Configuration Files

### `.npmrc` (root — CRITICAL)

```ini
node-linker=hoisted
```

**Why this is required:** pnpm's default symlink strategy (`node-linker=isolated`) creates a virtual store where packages are symlinked rather than physically present in `node_modules`. Metro bundler (Expo's JS bundler) does not follow symlinks correctly — it will fail to resolve packages from `packages/shared` or any hoisted dependency. `node-linker=hoisted` makes pnpm flatten `node_modules` like npm/yarn classic, which Metro can handle. EAS Build also requires this because the EAS build servers run `pnpm install` and Metro's resolution must work in that environment.

**Confidence: HIGH** — This is a documented requirement in the official Expo monorepo guide and is the single most common failure point for new pnpm + Expo monorepos.

### `pnpm-workspace.yaml` (root)

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

### `turbo.json` (root)

```json
{
  "$schema": "https://turbo.build/schema.json",
  "ui": "tui",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".expo/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "type-check": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    }
  }
}
```

**Notes on `turbo.json`:**
- `"dependsOn": ["^build"]` ensures `packages/shared` is built before `apps/mobile` or `apps/api` try to consume it.
- `dev` is marked `persistent: true` because Expo dev server and the API dev server are long-running processes; Turbo 2.x requires this flag to avoid treating them as hung tasks.
- `"ui": "tui"` enables the Turborepo terminal UI introduced in Turbo 2.x (cleaner parallel output).

### `packages/shared/package.json`

```json
{
  "name": "@cravyr/shared",
  "version": "0.1.0",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc --project tsconfig.json",
    "type-check": "tsc --noEmit"
  }
}
```

**Why `main` points to `.ts` source directly:** In a monorepo with Turborepo, consuming apps import `@cravyr/shared` and their own TypeScript compiler + Metro transformer handle transpilation. Shipping `.ts` source avoids a separate compile step during development and removes the `dist/` output from the hot-reload chain. For production EAS builds, the `build` task compiles it first via `^build` dependency ordering.

### `apps/mobile/metro.config.js`

```js
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch the shared package source
config.watchFolders = [workspaceRoot];

// Resolve modules from workspace root first, then project root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = config;
```

**Why `watchFolders` is required:** Metro's default watch scope is the app directory. Without adding `workspaceRoot`, changes to `packages/shared` will not trigger a hot reload in the Expo dev server. Metro also needs `nodeModulesPaths` to resolve hoisted monorepo dependencies correctly.

---

## Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `apps/mobile` | UI, swipe animations (Reanimated v4), user interaction, local state | `apps/api` (restaurant data), Supabase (auth, swipes, saves, preferences) |
| `apps/api` | Google Places API proxy, field mask enforcement, geographic cluster cache, recommendation RPC call | Google Places API (New), Supabase (PostGIS RPC) |
| `packages/shared` | Zod schemas, TypeScript types, shared validation utilities | Imported by both apps at build time — no runtime dependency |
| Supabase | PostgreSQL + PostGIS, auth (JWT), RLS enforcement, DB triggers, push token storage | `apps/mobile` (direct for auth + user data), `apps/api` (for recommendation RPC) |
| Google Places API (New) | Source of truth for restaurant data — names, photos, hours, ratings, coordinates | `apps/api` only — mobile never calls Places directly |

**Rule:** The mobile app has **two** backend connections — Supabase directly (for low-latency auth and user-owned data) and `apps/api` (for everything Google Places). This split avoids storing a Google API key in the mobile bundle (a security violation) while keeping Supabase auth fast.

---

## Data Flow

### Flow 1: Loading the Swipe Deck

```
1. discover.tsx mounts
2. deckStore.loadDeck() called
   → GET apps/api/restaurants/nearby?lat=&lng=&radius=&cuisines=&priceLevel=
3. apps/api placesService checks node-cache
   a. CACHE HIT → return cached cluster data (TTL 24h)
   b. CACHE MISS →
      i.  Snap lat/lng to nearest 0.1° grid cell (geographic cluster key)
      ii. Call Google Places Nearby Search (New) with field mask
      iii. Store result in node-cache keyed by cluster + filters
      iv. Store place_ids permanently in Supabase `restaurants` table (upsert)
4. apps/api returns array of Restaurant objects (typed via @cravyr/shared)
5. deckStore stores full array, exposes top 20 as `visibleCards`
6. SwipeDeck renders first 5 (prerenderItems=5), expo-image prefetches photos for next 3
```

### Flow 2: Recording a Swipe

```
1. User swipes right/left/up on card
2. rn-swiper-list fires onSwipeRight/Left/Up callback (on native thread via worklet)
3. Worklet runs animation to completion (no JS thread involvement)
4. JS callback fires after animation: deckStore.recordSwipe(restaurantId, direction)
5. deckStore:
   a. Removes card from visibleCards, advances queue
   b. If queue < 10 cards remaining → triggers background refetch
   c. Calls Supabase directly: INSERT into swipes (user_id, place_id, action, swiped_at)
6. If action = 'right' or 'superlike':
   → Supabase DB trigger automatically INSERTs into saved_restaurants
   (no extra round-trip from mobile)
7. deckStore exposes updatedDeck to SwipeDeck for next render
```

### Flow 3: Personalized Recommendations

```
1. After user accumulates ≥ 10 swipes, POST apps/api/recommendations
2. apps/api calls Supabase RPC: SELECT * FROM get_recommendations(user_id, lat, lng, radius)
3. PostGIS function scores all restaurants within radius:
   - Distance weight (closer = higher score)
   - Cuisine preference match weight
   - Rating weight
   - Price level match weight
4. Returns ranked place_ids
5. apps/api fetches any missing restaurant detail from cache/Places API
6. Returns ranked Restaurant[] to mobile
7. deckStore replaces next-up cards with recommendation-ordered results
```

---

## Zustand Store Design

**Version note:** Zustand v5 changed the import style — `create` is now directly imported from `zustand` (no more `zustand/vanilla` split for most use cases), and the `immer` middleware is unchanged. The `useShallow` hook from `zustand/react/shallow` is the recommended selector equality check.

### Principle: Three stores, strict separation

| Store | Owns | Does NOT own |
|-------|------|--------------|
| `deckStore` | Card queue, visible cards, swipe history (session), loading/error state, undo stack | User identity, filter preferences |
| `authStore` | Supabase session, user ID, display name, Apple/Google provider info | Restaurant data, UI state |
| `preferencesStore` | Cuisine filters, price range, max distance radius | Per-session state, swipe counts |

**Rule:** Stores communicate via subscribing to each other's state (Zustand's `getState()` in actions), not by nesting. `deckStore.loadDeck()` reads from `preferencesStore.getState()` to get current filters — it does not store filters internally.

### `stores/deckStore.ts`

```typescript
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { Restaurant } from '@cravyr/shared';

const VISIBLE_CARD_COUNT = 7;   // Render at most 7 cards in DOM
const PREFETCH_THRESHOLD = 10;  // Trigger background load when queue < 10

interface DeckState {
  // Card data
  queue: Restaurant[];           // Full fetched list not yet shown
  visibleCards: Restaurant[];    // Slice of queue rendered by SwipeDeck
  isLoading: boolean;
  error: string | null;

  // Undo support
  lastSwipedCard: Restaurant | null;
  lastSwipeAction: 'left' | 'right' | 'up' | null;

  // Actions
  loadDeck: (lat: number, lng: number) => Promise<void>;
  recordSwipe: (restaurantId: string, action: 'left' | 'right' | 'up') => void;
  undo: () => void;
  _advanceQueue: () => void;
}

export const useDeckStore = create<DeckState>()(
  subscribeWithSelector((set, get) => ({
    queue: [],
    visibleCards: [],
    isLoading: false,
    error: null,
    lastSwipedCard: null,
    lastSwipeAction: null,

    loadDeck: async (lat, lng) => {
      set({ isLoading: true, error: null });
      try {
        const { cuisines, priceRange, radius } =
          usePreferencesStore.getState(); // cross-store read
        const data = await apiFetch('/restaurants/nearby', {
          lat, lng, cuisines, priceRange, radius,
        });
        set({
          queue: data,
          visibleCards: data.slice(0, VISIBLE_CARD_COUNT),
          isLoading: false,
        });
      } catch (e) {
        set({ isLoading: false, error: (e as Error).message });
      }
    },

    recordSwipe: (restaurantId, action) => {
      const { visibleCards, queue } = get();
      const card = visibleCards.find(c => c.place_id === restaurantId)!;

      // Persist to Supabase (fire-and-forget — don't block the swipe)
      supabase.from('swipes').insert({
        place_id: restaurantId,
        action,
        swiped_at: new Date().toISOString(),
      });

      set({
        lastSwipedCard: card,
        lastSwipeAction: action,
      });

      get()._advanceQueue();
    },

    undo: () => {
      const { lastSwipedCard, visibleCards, queue } = get();
      if (!lastSwipedCard) return;

      // Delete the swipe record from Supabase
      supabase.from('swipes')
        .delete()
        .eq('place_id', lastSwipedCard.place_id)
        .order('swiped_at', { ascending: false })
        .limit(1);

      // Put the card back at the front
      set({
        visibleCards: [lastSwipedCard, ...visibleCards.slice(0, VISIBLE_CARD_COUNT - 1)],
        lastSwipedCard: null,
        lastSwipeAction: null,
      });
    },

    _advanceQueue: () => {
      const { queue, visibleCards } = get();
      const nextQueue = queue.slice(visibleCards.length);
      const newVisible = [...visibleCards.slice(1), ...nextQueue.slice(0, 1)];

      set({ visibleCards: newVisible });

      // Background refetch when running low
      if (nextQueue.length < PREFETCH_THRESHOLD) {
        // trigger background load — implementation omitted for brevity
      }
    },
  }))
);
```

### Component state vs store state

| Lives in Component State | Lives in Zustand Store |
|--------------------------|------------------------|
| Animation progress values (Reanimated shared values) | Card queue and visible card list |
| Local input field values | Auth session and user ID |
| Modal open/close | Filter preferences |
| Swipe gesture pan position | Last swiped card (for undo) |
| Button press highlight state | Loading and error states |

**Key rule for Reanimated v4:** Shared values (`useSharedValue`) and derived values (`useDerivedValue`) that drive swipe animations must stay in component scope — they cannot live in Zustand because Zustand state is on the JS thread and Reanimated v4 worklets execute on the UI thread. Passing a Zustand setter as a worklet callback is allowed only via `runOnJS`.

---

## PostGIS Recommendation Function

**Confidence: MEDIUM** — Pattern is well-established PostGIS practice; exact weight values are tunable and not from a specific source.

```sql
-- Migration: create recommendation function
CREATE OR REPLACE FUNCTION get_recommendations(
  p_user_id   UUID,
  p_lat       DOUBLE PRECISION,
  p_lng       DOUBLE PRECISION,
  p_radius_m  INTEGER DEFAULT 5000,
  p_limit     INTEGER DEFAULT 50
)
RETURNS TABLE (
  place_id        TEXT,
  score           DOUBLE PRECISION,
  distance_m      DOUBLE PRECISION
)
LANGUAGE plpgsql
STABLE  -- same inputs = same output within a transaction; allows query planning optimization
AS $$
DECLARE
  v_user_location  GEOMETRY;
  v_cuisines       TEXT[];
  v_price_range    INT[];
BEGIN
  -- Build user location point (SRID 4326 = WGS84 lat/lng)
  v_user_location := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326);

  -- Fetch user preferences (single lookup, not per-row)
  SELECT preferred_cuisines, price_range
  INTO v_cuisines, v_price_range
  FROM user_preferences
  WHERE user_id = p_user_id;

  RETURN QUERY
  SELECT
    r.place_id,
    (
      -- Distance score: 1.0 at 0m, 0.0 at p_radius_m (linear decay)
      (1.0 - (ST_Distance(
        r.location::geography,
        v_user_location::geography
      ) / p_radius_m)) * 0.35

      -- Cuisine match score: 1.0 if ANY cuisine overlaps preferences
      + CASE
          WHEN v_cuisines IS NOT NULL
            AND r.cuisine_types && v_cuisines
          THEN 1.0
          ELSE 0.0
        END * 0.30

      -- Rating score: normalized 0–1 from 1–5 scale
      + ((COALESCE(r.rating, 3.0) - 1.0) / 4.0) * 0.20

      -- Price level match: 1.0 if in range, 0.5 if adjacent, 0.0 if far
      + CASE
          WHEN v_price_range IS NOT NULL
            AND r.price_level = ANY(v_price_range)
          THEN 1.0
          WHEN v_price_range IS NOT NULL
            AND (r.price_level = ANY(v_price_range) + 1
              OR r.price_level = ANY(v_price_range) - 1)
          THEN 0.5
          ELSE 0.2
        END * 0.15

      -- Novelty bonus: penalize recently swiped places
      - COALESCE((
          SELECT 0.3
          FROM swipes s
          WHERE s.user_id = p_user_id
            AND s.place_id = r.place_id
            AND s.swiped_at > NOW() - INTERVAL '30 days'
          LIMIT 1
        ), 0.0)
    ) AS score,

    ST_Distance(
      r.location::geography,
      v_user_location::geography
    ) AS distance_m

  FROM restaurants r

  -- ST_DWithin uses the spatial index (GIST) for efficient radius filtering
  -- Must cast to geography for meter-based distance
  WHERE ST_DWithin(
    r.location::geography,
    v_user_location::geography,
    p_radius_m
  )

  -- Exclude places already swiped in last 7 days
  AND NOT EXISTS (
    SELECT 1 FROM swipes s
    WHERE s.user_id = p_user_id
      AND s.place_id = r.place_id
      AND s.swiped_at > NOW() - INTERVAL '7 days'
  )

  ORDER BY score DESC
  LIMIT p_limit;
END;
$$;
```

### Required indexes for this function

```sql
-- Spatial index on restaurant locations (required for ST_DWithin performance)
CREATE INDEX idx_restaurants_location_gist
  ON restaurants USING GIST (location);

-- Index for the swipe exclusion subquery
CREATE INDEX idx_swipes_user_place_date
  ON swipes (user_id, place_id, swiped_at DESC);

-- Index for cuisine array overlap operator (&&)
CREATE INDEX idx_restaurants_cuisine_gin
  ON restaurants USING GIN (cuisine_types);
```

**Weight rationale (tunable):** Distance 35% (most important for discovery), cuisine 30% (personalization), rating 20% (quality signal), price 15% (preference match). Adjust after collecting real swipe data.

---

## Google Places API Caching Strategy

**Confidence: HIGH** — Field mask billing tiers and place_id permanence are core Google Places API (New) documented behaviors.

### Billing tier summary (Places API New)

| Tier | Fields | Approx cost per call |
|------|--------|----------------------|
| Basic | `id`, `displayName`, `formattedAddress`, `location`, `types` | Cheapest |
| Advanced | `regularOpeningHours`, `priceLevel`, `rating`, `userRatingCount`, `websiteUri`, `editorialSummary` | ~2–3x Basic |
| Preferred/Enterprise | `photos`, `reviews`, `currentOpeningHours`, `servesBeer`, boolean attributes | ~5–10x Basic |

**Rule:** Never use `*` as a field mask. Explicitly enumerate only the fields needed for each use case.

### Field masks by use case

```
# Nearby Search (deck loading) — Basic + selected Advanced
X-Goog-FieldMask: places.id,places.displayName,places.location,places.types,
                  places.priceLevel,places.rating,places.userRatingCount,
                  places.regularOpeningHours.openNow,places.primaryTypeDisplayName

# Place Details (detail view — loaded lazily on tap)
X-Goog-FieldMask: id,displayName,formattedAddress,location,types,priceLevel,
                  rating,userRatingCount,regularOpeningHours,websiteUri,
                  editorialSummary,photos,nationalPhoneNumber,

# Photo fetch (Preferred tier — only when card is visible)
# Use the Places Photos endpoint separately, not as a field on Place Details
```

### Geographic cluster batching

```typescript
// placesService.ts
const CLUSTER_PRECISION = 1; // decimal places = ~11km grid cells

function getClusterKey(lat: number, lng: number, filters: SearchFilters): string {
  const clusterLat = Math.round(lat * 10 ** CLUSTER_PRECISION) / 10 ** CLUSTER_PRECISION;
  const clusterLng = Math.round(lng * 10 ** CLUSTER_PRECISION) / 10 ** CLUSTER_PRECISION;
  return `${clusterLat},${clusterLng}:${filters.cuisines.join(',')}:${filters.priceRange}`;
}

async function getNearbyRestaurants(
  lat: number,
  lng: number,
  filters: SearchFilters
): Promise<Restaurant[]> {
  const key = getClusterKey(lat, lng, filters);
  const cached = cache.get<Restaurant[]>(key);
  if (cached) return cached;

  const results = await callPlacesNearbySearch(lat, lng, filters);

  // Upsert place_ids to Supabase (permanent storage — ToS compliant)
  await supabase.from('restaurants').upsert(
    results.map(r => ({
      place_id: r.id,
      display_name: r.displayName.text,
      location: `POINT(${r.location.longitude} ${r.location.latitude})`,
      cuisine_types: r.types,
      price_level: r.priceLevel,
      rating: r.rating,
      rating_count: r.userRatingCount,
      last_synced_at: new Date().toISOString(),
    })),
    { onConflict: 'place_id', ignoreDuplicates: false }
  );

  cache.set(key, results, 86400); // 24-hour TTL
  return results;
}
```

**Cluster precision = 1 decimal place:** At the equator, 0.1° ≈ 11km. A user moving within an ~11km grid cell hits the cache. A 1km move near a cell boundary triggers a new fetch, but this is rare and acceptable. Tighter grids (0.01°) waste cache; looser grids (1.0°) return restaurants too far away.

### Photo URL handling (ToS compliance)

```typescript
// CORRECT: Store only the photo reference name, regenerate URL server-side
// photo.name format: "places/{place_id}/photos/{photo_reference}"
// Photo URLs expire — never store the full URL in DB

// In Supabase, store:
// restaurant_photos.photo_reference = "places/ChIJ.../photos/AXCi..."

// In apps/api, generate fresh URL on each request:
function getPhotoUrl(photoReference: string, maxWidth = 800): string {
  return `https://places.googleapis.com/v1/${photoReference}/media`
    + `?maxWidthPx=${maxWidth}&key=${process.env.GOOGLE_PLACES_API_KEY}`;
}
```

---

## Swipe Deck Memory Management

**Confidence: HIGH** — These are React Native memory management patterns well-documented in the React Native and Expo communities.

### Card rendering budget

```typescript
// SwipeDeck.tsx
import { SwiperCard } from 'rn-swiper-list'; // v3.0.0

// rn-swiper-list v3 requires react-native-worklets as peer dep
// (Reanimated v4 split worklets into a separate package)

<Swiper
  ref={swiperRef}
  data={visibleCards}        // Pass only 7 cards max — deckStore enforces this
  renderCard={(card) => <RestaurantCard restaurant={card} />}
  onSwipeRight={(index) => deckStore.recordSwipe(visibleCards[index].place_id, 'right')}
  onSwipeLeft={(index) => deckStore.recordSwipe(visibleCards[index].place_id, 'left')}
  onSwipeTop={(index) => deckStore.recordSwipe(visibleCards[index].place_id, 'up')}
  // Render only top N cards in the stack
  // (rn-swiper-list v3 calls this stackSize or similar — verify in its docs)
/>
```

### expo-image prefetching

```typescript
// RestaurantCard.tsx
import { Image } from 'expo-image';

// expo-image has a built-in prefetch API
// Prefetch the next 3 cards' photos when a card becomes the top card

function prefetchUpcomingPhotos(cards: Restaurant[], currentIndex: number) {
  const nextThree = cards.slice(currentIndex + 1, currentIndex + 4);
  nextThree.forEach(card => {
    if (card.photoUrl) {
      Image.prefetch(card.photoUrl);
    }
  });
}

// In the card component, use blurhash while photo loads
<Image
  source={{ uri: restaurant.photoUrl }}
  placeholder={{ blurhash: restaurant.blurhash }}
  contentFit="cover"
  transition={150}
  style={styles.cardImage}
/>
```

**Memory rules:**
- Keep `visibleCards` array at maximum 7 items (5 rendered + 2 preloaded offscreen)
- Prefetch photos for next 3 cards only — not the whole queue
- When a card leaves the stack, its Image component unmounts and expo-image releases memory from its cache for that URL
- Do not keep full-resolution photo objects in the Zustand store — store only URLs/references

---

## Supabase RLS Patterns

**Confidence: HIGH** — The `(SELECT auth.uid())` optimization is explicitly documented in Supabase's performance docs as a critical RLS pattern.

### The core performance difference

```sql
-- SLOW: auth.uid() is evaluated once per row
CREATE POLICY "users_own_swipes_slow"
ON swipes FOR ALL
USING (user_id = auth.uid());

-- FAST: (SELECT auth.uid()) is evaluated once per statement, result cached
-- For a query returning 1000 rows, this is called 1 time instead of 1000 times
CREATE POLICY "users_own_swipes_fast"
ON swipes FOR ALL
USING (user_id = (SELECT auth.uid()));
```

The subquery form forces the PostgreSQL planner to treat `auth.uid()` as a stable subquery result and cache it for the duration of the statement. This is especially impactful on tables with many rows per user (swipes, saves).

### RLS policies for all Cravyr tables

```sql
-- Enable RLS on all user-data tables
ALTER TABLE swipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- restaurants table: public read, API-only write (service role bypasses RLS)
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "restaurants_public_read"
ON restaurants FOR SELECT
USING (true);
-- No INSERT/UPDATE policy — apps/api uses service role key, which bypasses RLS

-- swipes: users see and write only their own
CREATE POLICY "swipes_owner"
ON swipes FOR ALL
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

-- saved_restaurants: users see and delete only their own
-- Inserts are done by DB trigger (runs as SECURITY DEFINER, bypasses RLS)
CREATE POLICY "saved_restaurants_owner"
ON saved_restaurants FOR SELECT
USING (user_id = (SELECT auth.uid()));

CREATE POLICY "saved_restaurants_owner_delete"
ON saved_restaurants FOR DELETE
USING (user_id = (SELECT auth.uid()));

-- user_preferences: users own their row
CREATE POLICY "preferences_owner"
ON user_preferences FOR ALL
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

-- user_profiles: users own their row; public can SELECT (for social features later)
CREATE POLICY "profiles_owner_write"
ON user_profiles FOR INSERT
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "profiles_owner_update"
ON user_profiles FOR UPDATE
USING (user_id = (SELECT auth.uid()));

CREATE POLICY "profiles_public_read"
ON user_profiles FOR SELECT
USING (true);
```

### DB trigger for saved_restaurants (Tonight's Picks)

```sql
-- Automatically populate saved_restaurants on right-swipe or superlike
-- Runs as SECURITY DEFINER to bypass RLS (trigger inserts on behalf of user)
CREATE OR REPLACE FUNCTION handle_swipe_save()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.action IN ('right', 'superlike') THEN
    INSERT INTO saved_restaurants (user_id, place_id, saved_at, source_action)
    VALUES (NEW.user_id, NEW.place_id, NEW.swiped_at, NEW.action)
    ON CONFLICT (user_id, place_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_swipe_save
  AFTER INSERT ON swipes
  FOR EACH ROW
  EXECUTE FUNCTION handle_swipe_save();
```

---

## Key Patterns to Follow

### Pattern: Field Mask Optimization

Never request fields you don't need. Fields belong to billing SKUs — requesting any Preferred-tier field on a Nearby Search that returns 20 places charges the Preferred rate for all 20.

```
# BAD — triggers Preferred billing for all results
X-Goog-FieldMask: *

# BAD — photos is Preferred tier, inflates cost for deck loading
X-Goog-FieldMask: places.id,places.displayName,places.photos

# GOOD — Basic + targeted Advanced fields for deck loading
X-Goog-FieldMask: places.id,places.displayName,places.location,places.types,
                  places.priceLevel,places.rating,places.regularOpeningHours.openNow

# GOOD — fetch Preferred fields only when user taps into detail view
X-Goog-FieldMask: id,photos,editorialSummary,reviews
```

### Pattern: Geographic Cluster Batching

Round user coordinates to a grid before using them as a cache key. A user walking two blocks should hit the same cache entry. The grid size (0.1° ≈ 11km) is chosen so that nearly all restaurants within the search radius are captured in a single cluster fetch.

```typescript
// Snap to grid: 0.1° precision
const clusterLat = Math.round(lat * 10) / 10;
const clusterLng = Math.round(lng * 10) / 10;
const cacheKey = `cluster:${clusterLat}:${clusterLng}:${filtersHash}`;
```

### Pattern: Swipe Deck Preloading

Pass only `VISIBLE_CARD_COUNT` (7) cards to the SwipeDeck component. Maintain the full queue in the store. Trigger a background refetch at the `PREFETCH_THRESHOLD` (10 remaining). Prefetch images for the next 3 cards using `expo-image`'s prefetch API.

```typescript
// In deckStore._advanceQueue:
const remainingInQueue = queue.length - visibleCards.length;
if (remainingInQueue < PREFETCH_THRESHOLD) {
  // Fire background fetch — do not await, do not block the swipe
  loadMoreCards().catch(console.error);
}
```

### Pattern: Permanent place_id Storage

Google ToS permits storing `place_id` permanently. This is the key to avoiding repeat API calls for known restaurants.

```sql
-- restaurants table schema captures place_id as primary key
CREATE TABLE restaurants (
  place_id          TEXT PRIMARY KEY,   -- Permanent, never expires
  display_name      TEXT NOT NULL,
  location          GEOGRAPHY(POINT, 4326) NOT NULL,
  cuisine_types     TEXT[] NOT NULL DEFAULT '{}',
  price_level       INTEGER,            -- 1–4
  rating            NUMERIC(3,1),
  rating_count      INTEGER,
  last_synced_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## Anti-Patterns to Avoid

| Anti-Pattern | Why Bad | Instead |
|--------------|---------|---------|
| Per-user Google Places API call | At 1K DAU, every user triggering a Nearby Search = ~$30K/month | Geographic cluster batching + 24h TTL cache in apps/api |
| Requesting `*` field mask | Any Preferred-tier field in response = Preferred billing for entire call | Enumerate only needed fields per endpoint |
| Loading `photos` field in Nearby Search | Photos is Preferred tier — inflates cost for deck loading where photos aren't shown yet | Fetch photos separately on Place Details call when user taps |
| Storing Google photo URLs in DB | Photo URLs expire (hours to days) | Store `photo_reference` name only; regenerate URL server-side on request |
| Calling Google Places from mobile app | Exposes API key in mobile bundle; key is trivially extractable | All Places calls go through apps/api exclusively |
| Loading 50+ cards in Zustand store's `visibleCards` | React re-renders on every state change; 50 cards with images = OOM on low-end Android | `visibleCards` max 7; full queue stays in store but only top 7 passed to SwipeDeck |
| `auth.uid()` in RLS policies (bare function call) | Evaluated per-row — 1000 rows = 1000 function calls | `(SELECT auth.uid())` — evaluated once per statement |
| Reanimated shared values in Zustand store | Shared values live on UI thread; Zustand is JS thread — crossing threads incorrectly causes crashes | Keep shared values in component scope; call Zustand actions via `runOnJS` |
| Nesting stores (preferencesStore inside deckStore) | Creates circular dependencies and makes stores hard to reset independently | Cross-store reads via `usePreferencesStore.getState()` in actions |
| Skipping `node-linker=hoisted` in `.npmrc` | Metro fails to resolve monorepo packages; EAS builds silently break | Always include `node-linker=hoisted` in root `.npmrc` before running `pnpm install` |

---

## Build Order

1. **`packages/shared` — types and schemas first**
   Both `apps/mobile` and `apps/api` import from `@cravyr/shared`. It must exist and type-check before either app can be developed. Turbo's `"dependsOn": ["^build"]` enforces this automatically, but establishing it as step 1 clarifies the dependency graph.

2. **Supabase schema — DB before API**
   Run migrations (`restaurants`, `swipes`, `saved_restaurants`, `user_preferences`, `user_profiles` tables, PostGIS extension, spatial indexes, RLS policies, the `handle_swipe_save` trigger, the `get_recommendations` function). The API cannot be tested without a valid DB schema.

3. **`apps/api` — data layer before UI**
   Build the Express v5 API with `GET /restaurants/nearby` and its Places caching layer. Verify field masks and cluster batching with curl before building any UI. This is the highest-risk financial component — validate cost behavior early.

4. **`apps/mobile` auth flow — identity before features**
   Implement the Supabase auth integration (email/password + Google + Apple Sign-In), `authStore`, and the onboarding flow. App Store review requires a complete auth flow. Apple Sign-In must be implemented before any Google Sign-In.

5. **`apps/mobile` swipe deck — core feature**
   Implement `deckStore`, `SwipeDeck` component with rn-swiper-list v3, `RestaurantCard`, and the full swipe→record→advance loop. This is the product's core value — validate 60fps on a physical low-end Android device, not just simulator.

6. **`apps/mobile` detail view and saved list**
   Implement `restaurant/[id].tsx` (lazy-load Preferred-tier fields) and `saved.tsx` (Tonight's Picks). Required for App Store review.

7. **Push notifications, preferences, settings**
   Implement after core loop is validated. Expo Push Notifications setup (token registration, cron job for daily 6PM reminder) and the settings/preferences screens.

8. **EAS build + App Store submission**
   Configure `eas.json` for production builds, test on TestFlight and Google Play Internal Testing, then submit.

---

## Known Gotchas

### Turborepo + Expo specific

- **`node-linker=hoisted` must be set before the first `pnpm install`**. If you've already run `pnpm install` without it, delete `node_modules` at all levels and reinstall.
- **`metro.config.js` must declare `watchFolders`** pointing to the workspace root. Without this, Fast Refresh will not pick up changes in `packages/shared`.
- **EAS Build uses the `build` turbo task**. Ensure `turbo.json` has `"outputs": [".expo/**"]` so Turbo caches the Expo prebuild output correctly.
- **Turbo 2.x requires `persistent: true`** for long-running dev tasks. Without it, `turbo dev` will exit after the task appears to "complete."
- **`packages/shared` with `.ts` source as `main`**: Metro handles TypeScript transpilation. Node (for `apps/api`) also needs TypeScript — use `ts-node` or `tsx` for the API dev server, or compile to `dist/` for production.

### rn-swiper-list v3 specific

- v3.0.0 lists `react-native-worklets` as a peer dependency. This is the package that Reanimated v4 split off from its core. Install `react-native-worklets` explicitly in `apps/mobile/package.json` — it is not automatically included.
- Reanimated v4 babel plugin config changed — verify `babel.config.js` uses the v4 plugin name if it differs from v3.

### Supabase free tier

- Auto-pauses after 7 days of zero DB activity. Implement a keep-alive cron job in `apps/api` (e.g., using `node-cron` to run a trivial `SELECT 1` against Supabase every 4 days). This is especially important during development gaps.

### Express v5 specific

- Express v5 made `async` route handler errors auto-forwarded to error middleware (no more `try/catch` + `next(err)` required in every route). Embrace this — it significantly cleans up route code.
- `express.Router()` in v5 also supports `async` without wrapping.

---

## Sources

All content is from training data (cutoff August 2025), updated with user-provided live npm version data. No live fetches were possible in this environment session.

| Topic | Source URL (unverified — valid as of Aug 2025) | Confidence |
|-------|------------------------------------------------|------------|
| Expo monorepo + pnpm setup, `node-linker=hoisted`, `metro.config.js` `watchFolders` | https://docs.expo.dev/guides/monorepos/ | HIGH |
| Turborepo + Expo guide, `turbo.json` pipeline, `persistent: true` for dev | https://turbo.build/repo/docs/guides/tools/expo | MEDIUM |
| Turborepo task configuration, `dependsOn`, `outputs`, Turbo 2.x TUI | https://turbo.build/repo/docs/reference/configuration | MEDIUM |
| Zustand v5 API changes, `create` import, `subscribeWithSelector` middleware | https://zustand.docs.pmnd.rs/migrations/migrating-to-v5 | MEDIUM |
| Zustand store splitting, cross-store reads via `getState()` | https://zustand.docs.pmnd.rs/guides/slices-pattern | MEDIUM |
| Google Places API (New) field masks and billing SKUs | https://developers.google.com/maps/documentation/places/web-service/choose-fields | HIGH |
| Google Places API photo reference vs URL storage (ToS) | https://developers.google.com/maps/documentation/places/web-service/place-photos | HIGH |
| Supabase RLS `(SELECT auth.uid())` performance optimization | https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select | HIGH |
| PostGIS `ST_DWithin` with geography cast for meter-based distance | https://postgis.net/docs/ST_DWithin.html | HIGH |
| expo-image prefetch API | https://docs.expo.dev/versions/latest/sdk/image/#imageprefetchoptions | HIGH |
| rn-swiper-list v3 peer deps (react-native-worklets) | https://github.com/Skipperlla/rn-swiper-list | MEDIUM — verify against v3.0.0 release notes |
| Reanimated v4 + worklets package split | https://docs.swmansion.com/react-native-reanimated/ | MEDIUM — verify v4 migration guide |
| Express v5 async error handling | https://expressjs.com/en/guide/error-handling.html | HIGH |
| Supabase free tier auto-pause behavior | https://supabase.com/docs/guides/platform/going-into-prod#availability | HIGH |
