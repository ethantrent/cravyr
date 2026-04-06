# Technology Stack

**Project:** Cravyr
**Researched:** 2026-04-06
**Version source:** Live npm registry (fetched 2026-04-06)
**Note:** Compatibility details (peer dep resolution, SDK-level integration) are based on training knowledge; flagged with confidence levels accordingly.

---

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

---

## Version Flags and Compatibility Concerns

These are the most important findings from the live npm data. **Verify each before writing implementation code.**

### FLAG 1 — Expo SDK 55, not 52
The project constraints document referenced "Expo SDK 50+" and planning assumed SDK 52. The current stable release is **SDK 55 (expo 55.0.11)**. All SDK-versioned packages (expo-image 55.0.8, expo-router 55.0.10) are already aligned to SDK 55. No action needed on version numbers, but any SDK 52-specific workarounds in external guides are likely outdated.

### FLAG 2 — react-native-reanimated is now v4 (not v3)
The project's constraints and key decisions reference "Reanimated v3" throughout. The current package is **4.3.0**, a major version bump. The core value proposition (native thread worklets at 60fps) is unchanged, but:
- The import paths and some API surface may have changed between v3 and v4.
- The `useAnimatedStyle`, `useSharedValue`, `withSpring`, `withTiming`, and `runOnUI` worklet APIs are expected to be forward-compatible, but verify against the v4 changelog before writing animation code.
- All references to "Reanimated v3" in PROJECT.md and CLAUDE.md should be mentally read as "Reanimated v4."

### FLAG 3 — rn-swiper-list 3.0.0 adds react-native-worklets as a required peer dependency
rn-swiper-list 3.0.0 peer deps include `react-native-worklets` as a **new, separate package** (previously worklets were bundled inside react-native-reanimated). This is likely a consequence of Reanimated v4 extracting worklets into its own package (`react-native-worklets-core` or similar). **Action required:**
- Confirm the exact package name (`react-native-worklets` vs `react-native-worklets-core`) from the rn-swiper-list 3.0.0 README before installing.
- Add it explicitly to `apps/mobile/package.json` — it will not be auto-installed as a transitive dep in a pnpm hoisting setup.
- Check if Expo SDK 55 bundles this package or if a manual `expo install` step is needed.

### FLAG 4 — Express 5 is the latest stable
Express.js **5.2.1** is the current npm `latest` tag, meaning Express 5 has reached general availability. Key changes relevant to this project:
- Async route handlers now propagate errors automatically — no need to wrap every handler in `try/catch` or call `next(err)` manually. This is a significant DX improvement.
- `res.json()` and `res.send()` behavior is unchanged.
- `path-to-regexp` upgrade inside Express 5 changes wildcard route syntax (`:param*` patterns differ). Check any catch-all routes.
- No breaking changes to middleware API that affect Express 4 patterns used here.
- **Use Express 5.** The improvement to async error propagation is directly relevant to the Places API proxy routes.

### FLAG 5 — Zustand v5 is out
Zustand **5.0.12** is the current release. Key changes from v4:
- `create` no longer accepts a plain object — must use a function: `create(() => ({ ... }))`. This was the pattern in v4 too, so most code is unaffected.
- The `immer` middleware and `devtools` middleware have updated type signatures.
- React 18 concurrent mode support is improved.
- No major API surface changes for basic `get`/`set`/`subscribe` usage. Use v5 — the migration from any v4 examples online is minimal.

---

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

---

## Critical Setup Notes

### pnpm Workspace (.npmrc)
Expo and React Native require a flat `node_modules` layout. Add to repo root `.npmrc`:
```
node-linker=hoisted
public-hoist-pattern[]=*react-native*
public-hoist-pattern[]=*expo*
public-hoist-pattern[]=*@expo*
```
Without this, Metro bundler cannot resolve packages from workspace siblings.

### react-native-worklets peer dependency (rn-swiper-list 3.0.0)
Before installing, confirm the exact package name from the rn-swiper-list 3.0.0 release notes (likely `react-native-worklets-core`). Install it explicitly:
```bash
cd apps/mobile
npx expo install react-native-worklets-core  # or react-native-worklets — confirm first
```
Do not rely on npm/pnpm hoisting to pull this in transitively.

### react-native-reanimated v4 — babel plugin
Reanimated still requires its Babel plugin in `babel.config.js`:
```js
plugins: ['react-native-reanimated/plugin']
```
This must be the **last** plugin in the array. This is unchanged from v3.

### Supabase React Native client setup
Supabase JS v2 requires two non-default settings for React Native (no browser globals):
```ts
import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,  // mandatory — no window.location in RN
  },
})
```
`detectSessionInUrl: false` is not optional. Omitting it causes a runtime crash on React Native.

### PostGIS setup on Supabase
Enable via SQL editor (one-time, per project):
```sql
create extension if not exists postgis;
```
Use `geography` type (not `geometry`) for the restaurant location column — geography uses meters for distance calculations, avoiding unit conversion errors:
```sql
location geography(Point, 4326)
```
Create a GIST index for `ST_DWithin` performance:
```sql
create index restaurants_location_idx on restaurants using gist (location);
```

### Supabase free tier keep-alive
Supabase free tier pauses the database after 7 days of no activity. Set up a cron job on Render (or GitHub Actions on a schedule) that pings the DB every 4 days:
```ts
// Simple keep-alive: SELECT 1
await supabase.from('restaurants').select('id').limit(1)
```

### Supabase RLS performance
Use `(SELECT auth.uid())` (with SELECT) in RLS policies, not `auth.uid()` directly. This caches the UID per statement rather than evaluating it per row — up to 99% faster on large tables:
```sql
create policy "users can read own swipes"
  on swipes for select
  using ((select auth.uid()) = user_id);
```

### Google Places API (New) — field masks
Always pass a `X-Goog-FieldMask` header. Billing is determined by the fields requested, not the fields returned. Request only what the swipe card renders:
```
X-Goog-FieldMask: places.id,places.displayName,places.formattedAddress,places.rating,places.priceLevel,places.photos,places.currentOpeningHours.openNow
```
`place_id` (`places.id`) may be stored permanently per ToS. Photo URLs expire — regenerate server-side using stored photo references, never cache the URL itself.

### Express 5 async error handling
Express 5 propagates async errors automatically. Do not wrap handlers in try/catch:
```ts
// Express 5 — errors thrown here are caught automatically
app.get('/places/nearby', async (req, res) => {
  const data = await fetchNearbyPlaces(req.query)
  res.json(data)
})
```

### Turborepo pnpm workspace setup
`turbo.json` pipeline must reference the workspace package names exactly as defined in each `package.json`. Typical pipeline:
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": [".expo/**", "dist/**"] },
    "dev": { "cache": false, "persistent": true },
    "lint": {}
  }
}
```

---

## Installation

```bash
# From apps/mobile — use expo install for SDK-versioned packages
npx expo install expo-image expo-router react-native-reanimated react-native-gesture-handler

# Swipe library + worklets (confirm worklets package name from rn-swiper-list 3.0.0 README first)
pnpm add rn-swiper-list
npx expo install react-native-worklets-core

# Supabase (requires AsyncStorage peer)
pnpm add @supabase/supabase-js
npx expo install @react-native-async-storage/async-storage

# State management
pnpm add zustand

# From apps/api
pnpm add express@5 node-cache

# Dev/monorepo root
pnpm add -D turbo -w
```

> **Prefer `npx expo install` over `pnpm add` for any package that has an SDK-versioned counterpart.** `expo install` resolves the correct version for the installed SDK automatically. Using `pnpm add` for Expo-managed packages can pin the wrong version.

---

## Sources

All version numbers are from the live npm registry (fetched 2026-04-06 by user). Compatibility analysis, setup notes, and pricing details are from training knowledge (cutoff August 2025) and should be verified against official docs before implementation:

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
