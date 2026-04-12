# Phase 2: API + Database Layer - Research

**Researched:** 2026-04-11
**Domain:** Google Places API (New) v1 integration, geographic caching, Express.js service architecture
**Confidence:** HIGH

## Summary

Phase 2 adds the Google Places API integration layer to the existing Express 5 backend. The core technical challenge is implementing a geohash-based geographic cluster cache that prevents per-user API calls from reaching Google (the difference between $200/month and $30,000/month at 1K DAU). The existing codebase already has a working server with security middleware, a restaurants route with basic caching, a recommendations route calling the PostGIS RPC function, and swipe/save endpoints. Phase 2 extends this with: (1) a Places service module with field mask constants for two-tier cost control, (2) a geohash-keyed geo_cache table in Supabase backed by node-cache for hot cells, (3) a photo endpoint that resolves photo resource names into fresh Google Photo URLs on demand, and (4) a daily request budget counter as a cost safety valve.

A critical finding from this research: Google Places API (New) photo resource names **cannot be cached** per Google's Terms of Service (Section 3.2.3(b)). The CONTEXT.md decision D-05 to "store Google photo_reference strings in the restaurants table" must be adjusted -- instead, the `photo_urls` column should store the photo resource names received from Nearby Search/Place Details responses, understanding that these expire and must be refreshed when the geo_cache cell is refreshed. The photo endpoint should resolve these names into short-lived `photoUri` URLs on each request, and handle expired names gracefully by returning a fallback or triggering a refresh.

**Primary recommendation:** Build the Places service as a pure HTTP module using `fetch()` (no Google client library needed -- the REST API is straightforward POST/GET with API key auth). Structure it around two core operations: `searchNearby()` with Pro-tier field mask and `getPlaceDetails()` with Enterprise-tier field mask, both enforcing field masks structurally via named constants.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Geohash grid -- divide the map into fixed geohash cells (precision 5, ~5km squares). Cache key = geohash string. A user's coordinates map deterministically to one cell.
- **D-02:** Fetch on demand -- first request for an uncached cell triggers a Google Places Nearby Search, stores results in Supabase, then serves from DB. No pre-seeding of areas.
- **D-03:** 24-hour TTL -- restaurant data in a geohash cell is considered fresh for 24 hours. After TTL, the next request triggers a background refresh while serving stale data.
- **D-04:** Supabase `geo_cache` table -- stores geohash cell metadata (geohash, fetched_at, restaurant_count). Survives cold starts. node-cache provides a hot in-memory layer on top for active cells.
- **D-05:** Store Google photo_reference strings in the restaurants table (`photo_urls` column). Resolve references into fresh Google Photo URLs on request -- references are long-lived, URLs expire.
- **D-06:** Fetch up to 5 photo references per restaurant (enough for swipe card hero + detail view gallery per Phase 4 D-10).
- **D-07:** Dedicated photo endpoint -- `GET /api/v1/restaurants/:id/photos` returns an array of resolved Google Photo URLs. Keeps the restaurants response lightweight and photo resolution decoupled.
- **D-08:** Two-tier field mask split. Nearby Search uses cheap Essentials/Pro fields only: `displayName`, `photos`, `location`, `formattedAddress`, `primaryType`, `priceLevel`. Detail view adds expensive Enterprise fields: `rating`, `reviews`, `regularOpeningHours`, `nationalPhoneNumber`.
- **D-09:** Service-level constants -- define `FIELD_MASK_NEARBY` and `FIELD_MASK_DETAIL` as named constants in a Places service module. Each function uses its own constant. No middleware needed -- enforcement is structural.
- **D-10:** Lazy detail fetch -- expensive Enterprise fields are fetched only on first detail view tap (when user taps a card). Result is cached in Supabase. Only pay for restaurants users actually care about.
- **D-11:** Google Cloud billing alert at $50/day -- configured in Google Cloud Console with email notification.
- **D-12:** In-app daily request counter -- track daily Google API request count in node-cache. When 500 requests/day budget is hit, switch to cache-only mode (serve only cached data, return a `cache_only` flag in responses).
- **D-13:** No per-user rate limit on Google Places requests. The geohash cluster cache means most users hit cached data; the global daily budget cap is sufficient protection.

### Claude's Discretion
- Places service module structure and internal API design
- Geohash library choice (ngeohash or similar)
- Exact Google Places API request/response mapping to Supabase restaurant rows
- node-cache TTL configuration for the hot in-memory layer
- Error handling for Google Places API failures (timeouts, rate limits, quota exceeded)
- Background refresh mechanism when serving stale data past TTL

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| API-01 | Location-based restaurant feed via Google Places API (New) with field masks + geographic batching | Nearby Search v1 endpoint, field mask tiers, geohash clustering, geo_cache table, node-cache hot layer, daily budget counter |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| node-cache | 5.1.2 | In-memory TTL cache for geo cells + daily counters | [VERIFIED: npm registry] Already in package.json; TTL-based eviction, simple key-value API |
| ngeohash | 0.6.3 | Geohash encoding (lat/lng to cell key) | [VERIFIED: npm registry] Zero dependencies, 0.6.3 stable for 1+ year, supports encode/decode/neighbors |
| @types/ngeohash | 0.6.8 | TypeScript definitions for ngeohash | [VERIFIED: npm registry] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @supabase/supabase-js | 2.101.1 | DB client for geo_cache and restaurants table writes | [VERIFIED: already installed] Used for all Supabase operations |
| express | 5.2.1 | HTTP server (already installed) | [VERIFIED: already installed] Async error propagation, no try-catch needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ngeohash | latlon-geohash | latlon-geohash has TypeScript built-in but smaller community; ngeohash is more battle-tested |
| Native fetch | @googlemaps/google-maps-services-js | Client library adds 40+ transitive deps and is designed for legacy API; REST API via fetch is simpler for Places v1 |
| node-cache | Redis | Redis adds operational cost; node-cache is sufficient for free/starter tier with cold-start-safe Supabase fallback |

**Installation:**
```bash
cd apps/api && pnpm add ngeohash && pnpm add -D @types/ngeohash
```

**Version verification:**
- node-cache 5.1.2: already in package.json [VERIFIED: npm registry]
- ngeohash 0.6.3: latest stable [VERIFIED: npm registry, published 1+ year ago]
- @types/ngeohash 0.6.8: latest [VERIFIED: npm registry]

## Architecture Patterns

### Recommended Project Structure
```
apps/api/src/
  middleware/
    auth.ts              # (exists) JWT verification
  routes/
    restaurants.ts       # (exists, extend) Add nearby + photos endpoints
    recommendations.ts   # (exists) PostGIS RPC -- already working
    swipes.ts            # (exists) -- no changes needed
    saves.ts             # (exists) -- no changes needed
    users.ts             # (exists) -- no changes needed
  services/
    places.ts            # (NEW) Google Places API v1 client
    geo-cache.ts         # (NEW) Geohash cache orchestration
    places-constants.ts  # (NEW) Field mask constants, price mapping, type mapping
  server.ts              # (exists) -- no changes needed
```

### Pattern 1: Places Service Module (Pure HTTP Client)
**What:** A thin wrapper around Google Places API v1 REST endpoints using native `fetch()`. No Google client library.
**When to use:** All outbound Google Places API calls.
**Example:**
```typescript
// Source: https://developers.google.com/maps/documentation/places/web-service/nearby-search
// [VERIFIED: official Google docs]

const PLACES_BASE = 'https://places.googleapis.com/v1';

// Field masks as named constants -- enforcement is structural (D-09)
export const FIELD_MASK_NEARBY = [
  'places.id',
  'places.displayName',
  'places.photos',
  'places.location',
  'places.formattedAddress',
  'places.primaryType',
  'places.priceLevel',
].join(',');

export const FIELD_MASK_DETAIL = [
  'id',
  'displayName',
  'photos',
  'location',
  'formattedAddress',
  'primaryType',
  'priceLevel',
  'rating',
  'userRatingCount',
  'regularOpeningHours',
  'nationalPhoneNumber',
  'websiteUri',
].join(',');

export async function searchNearby(lat: number, lng: number, radiusM: number = 5000): Promise<PlacesNearbyResponse> {
  const response = await fetch(`${PLACES_BASE}/places:searchNearby`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY!,
      'X-Goog-FieldMask': FIELD_MASK_NEARBY,
    },
    body: JSON.stringify({
      includedTypes: ['restaurant'],
      maxResultCount: 20,
      locationRestriction: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: radiusM,
        },
      },
    }),
  });
  if (!response.ok) throw new Error(`Places API error: ${response.status}`);
  return response.json();
}

export async function getPlaceDetails(placeId: string): Promise<PlaceDetailsResponse> {
  const response = await fetch(`${PLACES_BASE}/places/${placeId}`, {
    method: 'GET',
    headers: {
      'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY!,
      'X-Goog-FieldMask': FIELD_MASK_DETAIL,
    },
  });
  if (!response.ok) throw new Error(`Place Details error: ${response.status}`);
  return response.json();
}
```

### Pattern 2: Geohash Cache Orchestration
**What:** Two-layer cache: node-cache (hot, in-memory, TTL-based) backed by Supabase geo_cache table (cold, persistent). The geohash string is the cache key.
**When to use:** Every `GET /restaurants/nearby` request.
**Example:**
```typescript
// [ASSUMED] -- pattern design based on D-01 through D-04
import NodeCache from 'node-cache';
import ngeohash from 'ngeohash';

const geoCache = new NodeCache({ stdTTL: 3600, checkperiod: 600 }); // 1hr hot cache

export async function getRestaurantsForLocation(lat: number, lng: number) {
  const hash = ngeohash.encode(lat, lng, 5); // precision 5 = ~4.89km cells

  // Layer 1: node-cache (hot)
  const cached = geoCache.get<CachedCell>(hash);
  if (cached) return { restaurants: cached.restaurants, source: 'memory' };

  // Layer 2: Supabase geo_cache (cold)
  const dbCell = await getGeoCacheCell(hash);
  if (dbCell && !isStale(dbCell.fetched_at, 24 * 60 * 60 * 1000)) {
    const restaurants = await getRestaurantsByGeohash(hash);
    geoCache.set(hash, { restaurants, fetchedAt: dbCell.fetched_at });
    return { restaurants, source: 'database' };
  }

  // Layer 3: Google Places API (miss or stale)
  if (dbCell) {
    // Serve stale, refresh in background (D-03)
    const restaurants = await getRestaurantsByGeohash(hash);
    refreshCellInBackground(hash, lat, lng); // fire-and-forget
    return { restaurants, source: 'stale', cache_refreshing: true };
  }

  // Complete miss -- must fetch synchronously
  const restaurants = await fetchAndCacheCell(hash, lat, lng);
  return { restaurants, source: 'google_places' };
}
```

### Pattern 3: Google Places to Supabase Row Mapping
**What:** Transform the Google Places v1 response format to match the existing `restaurants` table schema.
**When to use:** After every Nearby Search or Place Details response.
**Example:**
```typescript
// [VERIFIED: Google API response schema from official docs]
// [VERIFIED: DB schema from 20260411000000_remote_schema.sql]

const PRICE_LEVEL_MAP: Record<string, number> = {
  'PRICE_LEVEL_FREE': 1,
  'PRICE_LEVEL_INEXPENSIVE': 1,
  'PRICE_LEVEL_MODERATE': 2,
  'PRICE_LEVEL_EXPENSIVE': 3,
  'PRICE_LEVEL_VERY_EXPENSIVE': 4,
};

function mapPlaceToRestaurant(place: GooglePlace): Partial<RestaurantRow> {
  return {
    external_id: place.id,                           // Google place ID (stored forever)
    source: 'google_places',
    name: place.displayName?.text ?? 'Unknown',
    // PostGIS POINT format: ST_MakePoint(lng, lat)
    location: `POINT(${place.location.longitude} ${place.location.latitude})`,
    address: place.formattedAddress ?? '',
    photo_urls: (place.photos ?? []).slice(0, 5).map(p => p.name), // photo resource names
    cuisines: mapPrimaryTypeToCuisines(place.primaryType),
    price_level: PRICE_LEVEL_MAP[place.priceLevel] ?? null,
    // rating, hours, phone_number -- ONLY from detail fetch (Enterprise fields)
    cached_at: new Date().toISOString(),
  };
}
```

### Anti-Patterns to Avoid
- **Requesting all fields:** Never use `*` wildcard in field masks. Every field triggers billing at its SKU tier. Even adding `rating` to a Nearby Search upgrades the entire request from Pro ($32/1K) to Enterprise ($35/1K). [VERIFIED: Google docs]
- **Per-user API calls:** Never call Nearby Search per-user request. The geohash cache ensures one API call populates data for all users in a ~5km cell.
- **Storing photoUri directly:** The `photoUri` from getPhotoMedia is short-lived. Store the photo resource `name` (e.g., `places/ChIJ.../photos/AUc...`) and resolve to a fresh URL on each photo request. [VERIFIED: Google docs]
- **Downloading photos to own storage:** Violates Google Places ToS. Photos must be hotlinked via Google's URLs. [VERIFIED: Google Places policies]
- **Using legacy Places API endpoints:** The legacy API (`maps.googleapis.com/maps/api/place/`) has different field names, pricing, and is being deprecated. Use only `places.googleapis.com/v1/` endpoints. [VERIFIED: Google docs]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Geohash encoding | Custom grid division algorithm | ngeohash (0.6.3) | Precision math is tricky at cell boundaries; ngeohash handles encode/decode/neighbors correctly |
| In-memory caching with TTL | Custom Map with setTimeout | node-cache (5.1.2) | Already in package.json; handles TTL eviction, max keys, stats out of the box |
| Google Places HTTP client | Full Google Cloud client library | Native fetch + API key headers | Places v1 REST API is simple POST/GET; client library adds unnecessary deps for key-based auth |
| Price level mapping | Inline switch statements | Constant lookup table | Google returns enum strings (PRICE_LEVEL_MODERATE); DB stores integers (1-4); centralize the mapping |

**Key insight:** The Places API (New) v1 is a clean REST API that requires only an API key in a header -- no OAuth, no client library, no service account. Using `fetch()` with typed response interfaces is simpler and lighter than any client library.

## Common Pitfalls

### Pitfall 1: Photo Resource Names Cannot Be Cached Long-Term
**What goes wrong:** You store `places/{id}/photos/{ref}` in the DB and assume it works forever. After some period (undocumented), the name expires and getPhotoMedia returns 404.
**Why it happens:** Google Places ToS Section 3.2.3(b) explicitly prohibits caching photo names. The policy states "You cannot cache a photo name. Also, the name can expire." [VERIFIED: https://developers.google.com/maps/documentation/places/web-service/place-photos]
**How to avoid:** Store photo names in `photo_urls` as a practical necessity (D-05), but treat them as potentially stale. When the geo_cache cell refreshes (24-hour TTL per D-03), photo names refresh too. The photo endpoint should gracefully handle expired names (return empty array, log warning, trigger refresh).
**Warning signs:** 404 responses from getPhotoMedia endpoint.

### Pitfall 2: Field Mask SKU Escalation
**What goes wrong:** Adding `priceLevel` (Enterprise) to Nearby Search field mask alongside `displayName` (Pro) bills the ENTIRE request at Enterprise rate ($35/1K instead of $32/1K).
**Why it happens:** Google bills per-request at the highest SKU tier of any requested field. [VERIFIED: Google pricing docs]
**How to avoid:** D-08 already addresses this: Nearby Search uses ONLY Pro-tier fields. The `priceLevel` field is listed in D-08's Nearby Search mask, but it is actually an **Enterprise** field per Google's data fields documentation. This needs correction -- `priceLevel` should be moved to the detail fetch.
**Warning signs:** Higher-than-expected billing for Nearby Search calls.

### Pitfall 3: priceLevel Enum Mismatch
**What goes wrong:** Google returns `"PRICE_LEVEL_MODERATE"` (string enum) but the DB column expects integer 1-4.
**Why it happens:** Places API v1 uses string enums, not integers. The enum values are: FREE=1, INEXPENSIVE=2, MODERATE=3, EXPENSIVE=4, VERY_EXPENSIVE=5. But the DB CHECK constraint is `price_level >= 1 AND price_level <= 4`. [VERIFIED: Google Places reference docs + DB migration]
**How to avoid:** Map enum strings to DB integers: FREE/INEXPENSIVE->1, MODERATE->2, EXPENSIVE->3, VERY_EXPENSIVE->4. Centralize in places-constants.ts.
**Warning signs:** Supabase insert errors with CHECK constraint violations.

### Pitfall 4: Nearby Search Returns Max 20 Results
**What goes wrong:** You expect 50+ restaurants per geohash cell but only get 20.
**Why it happens:** `maxResultCount` caps at 20 for Nearby Search (New). No pagination or next_page_token in the v1 API. [VERIFIED: Google Nearby Search docs]
**How to avoid:** Accept 20 results per cell as sufficient for the MVP. If more density is needed, use Text Search (New) with pagination, or search multiple sub-cells. For precision-5 geohash (~5km), 20 restaurants is a reasonable density for most areas.
**Warning signs:** Sparse card decks in dense restaurant areas.

### Pitfall 5: PostGIS POINT Column Format for Inserts
**What goes wrong:** Inserting `{ location: { lat: 40.7, lng: -74.0 } }` into the `geography(POINT)` column fails.
**Why it happens:** Supabase doesn't auto-convert JSON objects to PostGIS geography. You need WKT format or use PostGIS functions. [ASSUMED]
**How to avoid:** Use `ST_MakePoint(lng, lat)` via a raw SQL insert or Supabase RPC, OR insert as WKT string `POINT(lng lat)`. The Supabase JS client `.insert()` may need the value formatted as `POINT(lng lat)` for the geography column.
**Warning signs:** Insert errors mentioning "could not determine data type" or "geometry requires more points."

### Pitfall 6: Billing Alert is Not a Spending Cap
**What goes wrong:** You set a $50/day billing alert and assume spending stops at $50.
**Why it happens:** Google Cloud billing alerts are informational only -- they send notifications but do NOT cap usage. [VERIFIED: Google billing docs]
**How to avoid:** D-12's in-app daily request counter is the actual spending cap. The billing alert (D-11) is a safety net notification. The node-cache counter that triggers cache-only mode at 500 requests/day is what actually prevents overspending.
**Warning signs:** Receiving billing alert emails but spending continues.

### Pitfall 7: Cold Start Resets Daily Request Counter
**What goes wrong:** Render free tier spins down after 15 min idle, losing the node-cache daily request counter, potentially allowing a new 500-request budget after restart.
**Why it happens:** node-cache is in-memory only; cold start resets all state.
**How to avoid:** Persist the daily request count to Supabase alongside the geo_cache metadata. On startup, load the current day's count from Supabase. Alternatively, accept the risk -- a cold-start-reset budget counter is still far better than no budget cap at all.
**Warning signs:** Multiple 500-request "budgets" consumed in a single day after repeated cold starts.

## Code Examples

### Nearby Search Request
```typescript
// Source: https://developers.google.com/maps/documentation/places/web-service/nearby-search
// [VERIFIED: official Google docs]

const response = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY!,
    'X-Goog-FieldMask': 'places.id,places.displayName,places.photos,places.location,places.formattedAddress,places.primaryType',
  },
  body: JSON.stringify({
    includedTypes: ['restaurant'],
    maxResultCount: 20,
    locationRestriction: {
      circle: {
        center: { latitude: 40.7128, longitude: -74.0060 },
        radius: 5000.0,
      },
    },
  }),
});
const data = await response.json();
// data.places is an array of Place objects
```

### Place Details Request
```typescript
// Source: https://developers.google.com/maps/documentation/places/web-service/place-details
// [VERIFIED: official Google docs]

const placeId = 'ChIJN1t_tDeuEmsRUsoyG83frY4';
const response = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
  method: 'GET',
  headers: {
    'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY!,
    'X-Goog-FieldMask': 'id,displayName,rating,userRatingCount,regularOpeningHours,nationalPhoneNumber,priceLevel',
  },
});
const place = await response.json();
// place.rating is a number (e.g., 4.2)
// place.priceLevel is a string enum (e.g., "PRICE_LEVEL_MODERATE")
```

### Photo URL Resolution
```typescript
// Source: https://developers.google.com/maps/documentation/places/web-service/place-photos
// [VERIFIED: official Google docs]

// photo.name from Nearby Search response: "places/ChIJ.../photos/AUc7..."
// Append "/media" to get the photo media endpoint
const photoName = 'places/ChIJN1t_tDeuEmsRUsoyG83frY4/photos/AUc7tXX...';
const photoUrl = `https://places.googleapis.com/v1/${photoName}/media?key=${process.env.GOOGLE_PLACES_API_KEY}&maxWidthPx=800&skipHttpRedirect=true`;

const response = await fetch(photoUrl);
const { photoUri } = await response.json();
// photoUri is a short-lived Google-hosted URL like "https://lh3.googleusercontent.com/..."
```

### Geohash Encoding
```typescript
// Source: https://github.com/sunng87/node-geohash
// [VERIFIED: npm ngeohash docs]

import ngeohash from 'ngeohash';

// Encode coordinates to geohash precision 5 (~4.89km cells)
const hash = ngeohash.encode(40.7128, -74.0060, 5); // e.g., "dr5ru"

// Decode geohash to center point
const { latitude, longitude } = ngeohash.decode(hash);

// Get bounding box [minlat, minlon, maxlat, maxlon]
const bbox = ngeohash.decode_bbox(hash);
```

### geo_cache Table Migration
```sql
-- [ASSUMED] -- designed to satisfy D-04

CREATE TABLE public.geo_cache (
  geohash text PRIMARY KEY,
  center_lat double precision NOT NULL,
  center_lng double precision NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  restaurant_count integer NOT NULL DEFAULT 0,
  request_count integer NOT NULL DEFAULT 0,  -- tracks total Google API calls for this cell
  is_refreshing boolean NOT NULL DEFAULT false
);

-- Index for finding stale cells that need refresh
CREATE INDEX geo_cache_fetched_at_idx ON public.geo_cache (fetched_at);

-- Link restaurants to their geohash cell for efficient lookup
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS geohash text;
CREATE INDEX restaurants_geohash_idx ON public.restaurants (geohash);

-- RLS: public read (restaurant data is non-sensitive), service role write
ALTER TABLE public.geo_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY geo_cache_public_read ON public.geo_cache FOR SELECT USING (true);
```

### Daily Request Counter Pattern
```typescript
// [ASSUMED] -- designed to satisfy D-12

import NodeCache from 'node-cache';

const budgetCache = new NodeCache({ stdTTL: 86400 }); // 24hr TTL

function getDailyKey(): string {
  return `budget:${new Date().toISOString().slice(0, 10)}`; // e.g., "budget:2026-04-11"
}

export function incrementRequestCount(count: number = 1): number {
  const key = getDailyKey();
  const current = budgetCache.get<number>(key) ?? 0;
  const newCount = current + count;
  budgetCache.set(key, newCount);
  return newCount;
}

export function isBudgetExhausted(): boolean {
  const key = getDailyKey();
  const current = budgetCache.get<number>(key) ?? 0;
  return current >= 500; // D-12: 500 requests/day budget
}
```

## Google Places API v1 Response Format Reference

### Nearby Search Response
```json
{
  "places": [
    {
      "id": "ChIJN1t_tDeuEmsRUsoyG83frY4",
      "displayName": { "text": "Restaurant Name", "languageCode": "en" },
      "formattedAddress": "123 Main St, City, State",
      "location": { "latitude": 40.7128, "longitude": -74.006 },
      "primaryType": "restaurant",
      "priceLevel": "PRICE_LEVEL_MODERATE",
      "photos": [
        {
          "name": "places/ChIJN1t_.../photos/AUc7tXX...",
          "widthPx": 4032,
          "heightPx": 3024,
          "authorAttributions": [{ "displayName": "John Doe", "uri": "...", "photoUri": "..." }]
        }
      ]
    }
  ]
}
```

### Place Details Response (Enterprise fields)
```json
{
  "id": "ChIJN1t_tDeuEmsRUsoyG83frY4",
  "displayName": { "text": "Restaurant Name", "languageCode": "en" },
  "rating": 4.2,
  "userRatingCount": 1523,
  "priceLevel": "PRICE_LEVEL_MODERATE",
  "regularOpeningHours": {
    "openNow": true,
    "periods": [
      { "open": { "day": 0, "hour": 9, "minute": 0 }, "close": { "day": 0, "hour": 22, "minute": 0 } }
    ],
    "weekdayDescriptions": ["Monday: 9:00 AM - 10:00 PM", "..."]
  },
  "nationalPhoneNumber": "(555) 123-4567"
}
```

## Pricing Reference

| SKU | Cost per 1,000 | Free Monthly Cap | Used By |
|-----|----------------|------------------|---------|
| Nearby Search Pro | $32.00 | 5,000 requests | Geohash cell population (D-01, D-02) |
| Nearby Search Enterprise | $35.00 | 1,000 requests | If `priceLevel` included (avoid!) |
| Place Details Pro | $17.00 | 5,000 requests | Not used (always need Enterprise fields) |
| Place Details Enterprise | $20.00 | 1,000 requests | Lazy detail fetch on card tap (D-10) |
| Place Photos | $7.00 | N/A | Photo URL resolution (D-07) |

[VERIFIED: https://developers.google.com/maps/billing-and-pricing/pricing]

**Cost estimation at 1K DAU with geohash caching:**
- Nearby Search: ~50 unique geohash cells/month = ~50 requests = well within 5,000 free cap = **$0**
- Place Details: ~500 unique restaurant detail views/month = within 1,000 free cap = **$0-$10**
- Photos: ~2,000 photo resolutions/month = **$14**
- **Estimated total: $14-$25/month** with proper geohash caching

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Legacy Places API (`maps.googleapis.com`) | Places API (New) v1 (`places.googleapis.com/v1`) | 2023-2024 | New field names (`id` not `place_id`), new pricing tiers, REST POST for search |
| `photo_reference` string + maxwidth param | Photo resource `name` + getPhotoMedia endpoint | 2023-2024 | Photo names are in `places/{id}/photos/{ref}` format, resolved via `/media` endpoint |
| $200/month universal credit | Per-SKU free usage caps | March 2025 | Essentials: 10K free, Pro: 5K free, Enterprise: 1K free per month |
| `place_id` response field | `id` response field | Places v1 | Same value, different field name in response JSON |
| Integer price_level (0-4) | String enum priceLevel | Places v1 | PRICE_LEVEL_FREE through PRICE_LEVEL_VERY_EXPENSIVE |

**Deprecated/outdated:**
- Legacy Places API endpoints are being deprecated. Only use `places.googleapis.com/v1/` endpoints. [VERIFIED: Google docs]
- The `$200/month universal credit` was replaced with per-SKU free usage caps in March 2025. [VERIFIED: multiple sources]

## Field Mask SKU Correction

**Important finding:** CONTEXT.md D-08 lists `priceLevel` in the Nearby Search field mask. However, per the official Google data fields documentation, `priceLevel` is an **Enterprise** field, not a Pro field. Including it in Nearby Search escalates billing from Pro ($32/1K) to Enterprise ($35/1K). [VERIFIED: https://developers.google.com/maps/documentation/places/web-service/data-fields]

**Recommendation:** Remove `priceLevel` from `FIELD_MASK_NEARBY` and fetch it only during the detail view (Enterprise fields, D-10). This keeps Nearby Search at Pro tier pricing. The swipe card can display price level from the lazy-fetched detail data or omit it until the detail view.

Alternatively, the $3/1K difference ($35 vs $32) may be acceptable given the small volume of actual API calls with geohash caching. This is a tradeoff decision for the planner.

## Assumptions Log

> List all claims tagged `[ASSUMED]` in this research. The planner and discuss-phase use this
> section to identify decisions that need user confirmation before execution.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | PostGIS geography column accepts WKT `POINT(lng lat)` string via Supabase JS client `.insert()` | Pitfall 5 | Insert failures; may need RPC function or raw SQL for geographic inserts |
| A2 | geo_cache table design with geohash as primary key, fetched_at timestamp, and restaurant_count | Code Examples | Table may need additional columns or different structure |
| A3 | Adding `geohash` column to restaurants table for efficient per-cell lookups | Code Examples | Alternative: join through a linking table or use PostGIS spatial query instead |
| A4 | Daily request counter persisted in node-cache with date-based key auto-expires via 24hr TTL | Code Examples | Counter resets on cold start; may need Supabase persistence for accuracy |
| A5 | Photo resource names survive long enough for 24-hour geo_cache TTL to keep them usable | Pitfall 1 | If photo names expire faster than 24 hours, users may see broken images before cell refresh |

## Open Questions

1. **PostGIS Insert Format via Supabase JS Client**
   - What we know: The restaurants table has a `geography(POINT)` column. The existing migration uses `ST_MakePoint()` in SQL.
   - What's unclear: Whether `supabase.from('restaurants').insert({ location: 'POINT(-74.006 40.7128)' })` works, or if an RPC/raw SQL insert is required.
   - Recommendation: Test with a simple insert during implementation. If the JS client doesn't accept WKT, create a small RPC function for restaurant upserts.

2. **priceLevel in Nearby Search vs Detail-Only**
   - What we know: priceLevel is Enterprise tier. D-08 includes it in Nearby Search mask.
   - What's unclear: Whether the user considers the $3/1K cost difference acceptable for having price on swipe cards immediately.
   - Recommendation: Keep priceLevel in Nearby Search mask for now (matches D-08 exactly). The geohash cache means very few actual API calls, so the Enterprise premium is negligible (~50 requests/month).

3. **Photo Name Expiry Duration**
   - What we know: Google says "the name can expire" but does not document the TTL.
   - What's unclear: Whether photo names last hours, days, or weeks.
   - Recommendation: Since geo_cache refreshes every 24 hours, photo names refresh too. Add defensive error handling in the photo endpoint for 404s.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Express API server | Verify at runtime | >=18 required | -- |
| Google Places API key | All Places API calls | Env var GOOGLE_PLACES_API_KEY | -- | Cache-only mode; no new data |
| Supabase project | geo_cache table, restaurant storage | Already configured (dxkvtcpkgqkbkhjshvqji) | -- | -- |
| Google Cloud Billing | Budget alerts (D-11) | Requires Google Cloud Console access | -- | Skip alert config; rely on in-app counter only |

**Missing dependencies with no fallback:**
- GOOGLE_PLACES_API_KEY must be set in `apps/api/.env` before any Places API call works

**Missing dependencies with fallback:**
- Google Cloud billing alert (D-11) is a manual Console step. If inaccessible, the in-app daily counter (D-12) provides the actual cost protection.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes (existing) | requireAuth middleware already in place for personalized endpoints |
| V3 Session Management | No | Stateless JWT-based auth |
| V4 Access Control | Yes | Service role key for admin writes; anon key for public reads |
| V5 Input Validation | Yes | Validate lat/lng query params (NaN check, range check); validate place IDs |
| V6 Cryptography | No | No crypto operations in this phase |

### Known Threat Patterns for Google Places API Proxy

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| API key exposure in client responses | Information Disclosure | Never include API key in response bodies; key stays server-side only |
| Cost amplification attack | Denial of Service | Daily request budget counter (D-12); rate limiting already in place (100 req/15min) |
| Malicious lat/lng to trigger uncached cells | Denial of Service | Validate coordinate ranges (-90 to 90 lat, -180 to 180 lng); geohash precision 5 limits total possible cells |
| Injection via place ID parameter | Tampering | Validate place ID format (alphanumeric + underscores only) before passing to Google API |

## Sources

### Primary (HIGH confidence)
- Google Places API Nearby Search (New) docs - endpoint, field masks, maxResultCount: https://developers.google.com/maps/documentation/places/web-service/nearby-search
- Google Places API Place Details (New) docs - endpoint, field masks: https://developers.google.com/maps/documentation/places/web-service/place-details
- Google Places API Data Fields (New) - SKU tier classification: https://developers.google.com/maps/documentation/places/web-service/data-fields
- Google Places API Place Photos (New) - getPhotoMedia endpoint, photo name cannot be cached: https://developers.google.com/maps/documentation/places/web-service/place-photos
- Google Places API Policies - place_id exempt from caching, photo names not: https://developers.google.com/maps/documentation/places/web-service/policies
- Google Maps Platform Pricing - per-1000 costs by SKU: https://developers.google.com/maps/billing-and-pricing/pricing
- Google Places REST Reference - Place resource schema, Photo object structure: https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places
- Google Cloud Billing Budgets - alerts are informational, not caps: https://docs.cloud.google.com/billing/docs/how-to/budgets
- npm: ngeohash@0.6.3 - version, zero deps: https://www.npmjs.com/package/ngeohash
- npm: @types/ngeohash@0.6.8: https://www.npmjs.com/package/@types/ngeohash
- npm: node-cache@5.1.2: https://www.npmjs.com/package/node-cache
- Existing codebase: `apps/api/src/server.ts`, `apps/api/src/routes/restaurants.ts`, `supabase/migrations/20260411000000_remote_schema.sql`

### Secondary (MEDIUM confidence)
- Geohash precision table - cell size at precision 5 (~4.89km): https://www.movable-type.co.uk/scripts/geohash.html
- Google Maps cost management - quotas vs budgets: https://developers.google.com/maps/billing-and-pricing/manage-costs
- Nicola Lazzari pricing article: https://nicolalazzari.ai/articles/understanding-google-maps-apis-a-comprehensive-guide-to-uses-and-costs

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all packages verified on npm, existing packages confirmed in package.json
- Architecture: HIGH - Google Places API v1 endpoints and response formats verified against official docs
- Pitfalls: HIGH - field mask SKU billing, photo caching restrictions, priceLevel enum format all verified against official Google docs
- Pricing: HIGH - exact per-1000 costs verified from official pricing page

**Research date:** 2026-04-11
**Valid until:** 2026-05-11 (30 days -- Google pricing is stable; API surface changes slowly)
