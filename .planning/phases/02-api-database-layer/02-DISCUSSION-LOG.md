# Phase 2: API + Database Layer - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-11
**Phase:** 02-api-database-layer
**Areas discussed:** Geographic cluster caching, Photo reference lifecycle, Field mask & cost tiers, API cost guardrails

---

## Geographic Cluster Caching

| Option | Description | Selected |
|--------|-------------|----------|
| Geohash grid | Divide world into fixed geohash cells (~5km squares). Cache key = geohash string. Deterministic, zero DB overhead. | ✓ |
| Radius-based zones | Cache by center-point + radius. Overlapping zones create cache ambiguity. | |
| You decide | Claude picks. | |

**User's choice:** Geohash grid
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Fetch on demand | First request for a cell triggers Google Nearby Search, stores in Supabase. No pre-seeding. | ✓ |
| Pre-seed popular areas | Batch-fetch top ~50 metro areas on deploy/cron. Costs upfront. | |
| You decide | Claude picks. | |

**User's choice:** Fetch on demand
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| 24 hours | Balances freshness with API cost. Background refresh after TTL while serving stale. | ✓ |
| 7 days | Cheaper but risks stale data for a week. | |
| 1 hour | Very fresh but burns quota. | |
| You decide | Claude picks. | |

**User's choice:** 24 hours
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Supabase table | `geo_cache` table with geohash, fetched_at, restaurant_count. Survives cold starts. node-cache hot layer on top. | ✓ |
| node-cache only | In-memory only. Resets on cold start — always re-fetches from Google after restart. | |
| You decide | Claude picks. | |

**User's choice:** Supabase table with node-cache hot layer
**Notes:** None

---

## Photo Reference Lifecycle

| Option | Description | Selected |
|--------|-------------|----------|
| Store references, resolve on request | Store photo_reference strings. Generate fresh URLs on API request. References long-lived, URLs expire. | ✓ |
| Store resolved URLs with TTL | Pre-resolve into full URLs, refresh on schedule. Risks expired URLs between cycles. | |
| You decide | Claude picks. | |

**User's choice:** Store references, resolve on request
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Up to 5 | Enough for swipe hero + detail gallery (Phase 4 D-10). | ✓ |
| Up to 3 | Minimal. Thin gallery. | |
| Up to 10 | Maximum. Doubles storage and resolve cost. | |

**User's choice:** Up to 5
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated endpoint | GET /restaurants/:id/photos returns resolved URLs. Lightweight restaurant response. | ✓ |
| Inline in restaurant response | Resolve photos in the restaurant GET response. Fewer client calls but coupled. | |
| You decide | Claude picks. | |

**User's choice:** Dedicated endpoint
**Notes:** None

---

## Field Mask & Cost Tiers

| Option | Description | Selected |
|--------|-------------|----------|
| Two-tier split | Nearby Search uses cheap fields. Detail view adds Enterprise fields on tap. The $30K→$200 optimization. | ✓ |
| Single fetch with all fields | Simpler code but bills everything at Enterprise rate. | |
| You decide | Claude picks. | |

**User's choice:** Two-tier split
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Service-level constants | FIELD_MASK_NEARBY and FIELD_MASK_DETAIL as constants in Places service module. Structural enforcement. | ✓ |
| Middleware validation | Express middleware inspects outbound Google requests. Belt-and-suspenders but complex. | |
| You decide | Claude picks. | |

**User's choice:** Service-level constants
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| On first detail view tap | Lazy fetch Enterprise fields when user taps card. Cache in Supabase. Only pay for viewed restaurants. | ✓ |
| During cluster population | Fetch all fields for all restaurants in area. Rich swipe cards but expensive. | |
| Background job after cluster fetch | Populate basic data first, background fill detail later. Complex scheduling. | |

**User's choice:** On first detail view tap
**Notes:** None

---

## API Cost Guardrails

| Option | Description | Selected |
|--------|-------------|----------|
| In-app daily counter | Track daily Google API requests in node-cache. Switch to cache-only at budget limit. | ✓ |
| Billing alert only | Rely on Google Cloud $50/day alert. Simpler but risk if alert delayed. | |
| You decide | Claude picks. | |

**User's choice:** In-app daily counter
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| 500 requests/day | ~$16/day max. Conservative, well under $50 alert. | ✓ |
| 1,000 requests/day | ~$32/day. More headroom, tighter to alert threshold. | |
| 200 requests/day | ~$6.40/day. Very conservative, may hit cache-only quickly. | |
| You decide | Claude picks. | |

**User's choice:** 500 requests/day
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| No per-user limit | Geohash cache means most users hit cached data. Global daily cap sufficient. | ✓ |
| Soft per-user limit | 20/day per user. Prevents one power user burning global budget. | |
| You decide | Claude picks. | |

**User's choice:** No per-user limit
**Notes:** None

---

## Claude's Discretion

- Places service module structure and internal API design
- Geohash library choice
- Google Places API request/response mapping
- node-cache TTL for hot layer
- Error handling for Places API failures
- Background refresh mechanism

## Deferred Ideas

None — discussion stayed within phase scope.
