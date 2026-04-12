# Phase 2: API + Database Layer - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Express API that proxies Google Places API (New) with field masks enforced, geographic cluster caching active, and the PostGIS recommendation function returning scored results — so the financial risk of a $30K/month Places billing trap is eliminated before any UI is written. The recommendation SQL function and swipe/save endpoints already exist from Phase 1/4; this phase adds the Google Places integration layer and cost protection.

</domain>

<decisions>
## Implementation Decisions

### Geographic Cluster Caching
- **D-01:** Geohash grid — divide the map into fixed geohash cells (precision 5, ~5km squares). Cache key = geohash string. A user's coordinates map deterministically to one cell.
- **D-02:** Fetch on demand — first request for an uncached cell triggers a Google Places Nearby Search, stores results in Supabase, then serves from DB. No pre-seeding of areas.
- **D-03:** 24-hour TTL — restaurant data in a geohash cell is considered fresh for 24 hours. After TTL, the next request triggers a background refresh while serving stale data.
- **D-04:** Supabase `geo_cache` table — stores geohash cell metadata (geohash, fetched_at, restaurant_count). Survives cold starts. node-cache provides a hot in-memory layer on top for active cells.

### Photo Reference Lifecycle
- **D-05:** Store Google photo_reference strings in the restaurants table (`photo_urls` column). Resolve references into fresh Google Photo URLs on request — references are long-lived, URLs expire.
- **D-06:** Fetch up to 5 photo references per restaurant (enough for swipe card hero + detail view gallery per Phase 4 D-10).
- **D-07:** Dedicated photo endpoint — `GET /api/v1/restaurants/:id/photos` returns an array of resolved Google Photo URLs. Keeps the restaurants response lightweight and photo resolution decoupled.

### Field Mask & Cost Tiers
- **D-08:** Two-tier field mask split. Nearby Search uses cheap Essentials/Pro fields only: `displayName`, `photos`, `location`, `formattedAddress`, `primaryType`, `priceLevel`. Detail view adds expensive Enterprise fields: `rating`, `reviews`, `regularOpeningHours`, `nationalPhoneNumber`.
- **D-09:** Service-level constants — define `FIELD_MASK_NEARBY` and `FIELD_MASK_DETAIL` as named constants in a Places service module. Each function uses its own constant. No middleware needed — enforcement is structural.
- **D-10:** Lazy detail fetch — expensive Enterprise fields are fetched only on first detail view tap (when user taps a card). Result is cached in Supabase. Only pay for restaurants users actually care about.

### API Cost Guardrails
- **D-11:** Google Cloud billing alert at $50/day — configured in Google Cloud Console with email notification.
- **D-12:** In-app daily request counter — track daily Google API request count in node-cache. When 500 requests/day budget is hit, switch to cache-only mode (serve only cached data, return a `cache_only` flag in responses).
- **D-13:** No per-user rate limit on Google Places requests. The geohash cluster cache means most users hit cached data; the global daily budget cap is sufficient protection.

### Claude's Discretion
- Places service module structure and internal API design
- Geohash library choice (ngeohash or similar)
- Exact Google Places API request/response mapping to Supabase restaurant rows
- node-cache TTL configuration for the hot in-memory layer
- Error handling for Google Places API failures (timeouts, rate limits, quota exceeded)
- Background refresh mechanism when serving stale data past TTL

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Scope & Success Criteria
- `.planning/ROADMAP.md` §Phase 2 — Success criteria (5 items), requirement API-01

### Project Constraints & Architecture
- `.planning/PROJECT.md` — Stack constraints (Express.js, Supabase + PostGIS, Google Places API New), budget constraints (free/starter tier), Google Places ToS (hotlink photos, store place_id permanently, photo references expire)

### Technology Stack & API Reference
- `CLAUDE.md` §Google Places API — Field mask cost lever, SKU tiers, photo handling rules, cost estimates at 1K DAU
- `CLAUDE.md` §Express.js on Render — API route structure, node-cache guidance, render.yaml blueprint
- `CLAUDE.md` §Supabase schema — restaurants table definition, PostGIS setup, recommendation function specification

### Prior Phase Decisions
- `.planning/phases/01-monorepo-scaffold-infrastructure/01-CONTEXT.md` — Remote-only Supabase (D-06), per-app .env files (D-07), security middleware already in place (D-10)
- `.planning/phases/04-swipe-core-secondary-screens/04-CONTEXT.md` — Photo URLs hotlinked (D-10), detail view expects up to 5 photos (D-10), swipe card expects photo hero + name/distance/price/cuisine (D-01)

### Existing Schema
- `supabase/migrations/20260411000000_remote_schema.sql` — restaurants table, PostGIS indexes, recommendation function, RLS policies, swipe-save trigger

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/api/src/server.ts` — Express 5 server with helmet, cors, rate-limit middleware; all route mounts in place
- `apps/api/src/routes/restaurants.ts` — GET /:id with 2-hour Map-based cache (needs node-cache migration + Google Places integration)
- `apps/api/src/routes/recommendations.ts` — GET / calls PostGIS `get_restaurant_recommendations` RPC (working)
- `apps/api/src/middleware/auth.ts` — JWT verification via Supabase `auth.getUser()` (working)
- `packages/shared/src/types/restaurant.ts` — Restaurant type with `photo_urls: string[]`, `photo_blurhash`, `hours`, `phone_number`

### Established Patterns
- Express 5 async error propagation — no try/catch needed in route handlers
- Supabase client initialized per-file with env vars (anon key for public routes, service role key for admin operations)
- In-memory Map cache with TTL check pattern (restaurants.ts) — to be replaced with node-cache

### Integration Points
- `GET /api/v1/restaurants/nearby` — new endpoint, fetches from Google Places via geohash cluster cache
- `GET /api/v1/restaurants/:id` — existing endpoint, needs to serve enriched detail (lazy Enterprise field fetch)
- `GET /api/v1/restaurants/:id/photos` — new endpoint, resolves photo references to fresh URLs
- `supabase/migrations/` — new migration for `geo_cache` table
- `apps/api/src/services/` — new Places service module with field mask constants

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for implementation details.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-api-database-layer*
*Context gathered: 2026-04-11*
