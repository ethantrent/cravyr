# Coding Conventions

**Analysis Date:** 2026-07-02

## Naming Patterns

**Files:**
- React components: PascalCase matching the exported component name — `SwipeCard.tsx`, `MatchModal.tsx`, `RestaurantRow.tsx`
- Component directories: PascalCase matching the component — `components/SwipeCard/`, `components/SwipeDeck/`
- Stores: camelCase with `Store` suffix — `swipeDeckStore.ts`, `preferencesStore.ts`, `picksStore.ts`
- API routes: kebab-case noun plurals — `routes/swipes.ts`, `routes/restaurants.ts`, `routes/notifications.ts`
- Utilities: kebab-case descriptive — `restaurant-mapper.ts`, `geo-cache.ts`, `places-constants.ts`
- Middleware: single-word lowercase — `validate.ts`, `auth.ts`

**Functions:**
- Named exports for all components and utilities — `export function SwipeCard(...)`, `export function validate(...)`
- No default exports for React components (named exports only, per CLAUDE.md)
- Zustand stores use `use` prefix — `useSwipeDeckStore`, `usePicksStore`, `usePreferencesStore`
- Async utilities use descriptive verb phrases — `getAuthHeader()`, `fetchDeck()`, `photoProxyUrl()`
- Helper functions use camelCase verbs — `buildOptimisticPick()`, `optimisticPickId()`

**Variables:**
- camelCase throughout — `restaurantId`, `matchNames`, `undoStack`
- Boolean state fields use `is`/`has` prefix — `isLoading`, `hasError`, `isDeckEmpty`

**Types/Interfaces:**
- Interfaces use PascalCase with descriptive suffix — `SwipeDeckState`, `SwipeCardProps`
- Zod-inferred types are exported as `type` alongside their schema — `SwipeBody`, `LatLngQuery`
- Types from `@cravyr/shared` are always imported as `type` (type-only imports)

**Router exports:**
- Express routers use `Router` suffix — `swipesRouter`, `savesRouter`, `notificationsRouter`

## Code Style

**Formatting:**
- No Prettier or ESLint config detected at the repo root — style is enforced by TypeScript strict mode and convention
- Trailing commas in multi-line objects/arrays (observed throughout)
- Single quotes for strings in TypeScript files
- Template literals for string interpolation

**TypeScript:**
- Strict mode enabled (`"strict": true`) in `apps/api/tsconfig.json`
- `esModuleInterop: true`, `skipLibCheck: true`, `forceConsistentCasingInFileNames: true`
- Non-null assertions (`!`) used sparingly for env vars — `process.env.SUPABASE_URL!`
- Type widening via `as unknown as Record<string, unknown>` pattern when TypeScript cannot narrow (e.g., `middleware/validate.ts`)
- Security annotations inline: comments reference ticket IDs like `T-04-06-01` for security decisions

## Import Organization

**Order (observed pattern):**
1. React / React Native built-ins — `import { View, Text, StyleSheet } from 'react-native'`
2. Third-party Expo packages — `import { Image } from 'expo-image'`, `import { useRouter } from 'expo-router'`
3. Internal monorepo package — `import type { Restaurant } from '@cravyr/shared'`
4. Local app imports — stores, lib, components — `import { useSwipeDeckStore } from '../../stores/swipeDeckStore'`

**Path Aliases:**
- `@cravyr/shared` — internal monorepo package for shared types and Zod schemas
- Relative paths used for all intra-app imports (no `@/` alias configured in mobile app)

**Type imports:**
- All shared package types imported as `import type` — enforces zero runtime cost

## Shared Types Rule

**Critical convention:** All TypeScript types shared between `apps/mobile` and `apps/api` MUST come from `@cravyr/shared`. Never duplicate a type in both apps. The `Restaurant`, `SavedRestaurant`, `UserPreferences`, and all Zod schema inferred types live in `packages/shared/src/`.

## Error Handling

**API routes (Express 5):**
- Express 5 async error propagation is relied upon — no `try/catch` wrappers needed in route handlers for most cases
- Explicit early returns with `res.status(N).json({ error: '...' }); return;` pattern — never fall through
- Supabase errors destructured as `{ data, error }` with immediate check: `if (error) { res.status(500).json(...); return; }`
- 401 returned from route handler directly when `req.user` is absent (defense-in-depth after `requireAuth` middleware)
- 204 with no body for idempotent deletes

**Mobile (React Native):**
- `try/catch` in async `useCallback` fetch functions — `setError(true)` on catch
- Optimistic UI updates applied immediately; authoritative data replaces on next focus/refetch
- `ErrorBoundary` component (`components/ErrorBoundary.tsx`) wraps the component tree

**Validation:**
- All request bodies/query params validated via `validate()` middleware using Zod schemas from `@cravyr/shared`
- `res.locals.validated` holds coerced/validated data for route handlers (Express 5 compatible — `req.query` is read-only)
- 400 with structured `{ error, issues: [{ path, message }] }` shape on validation failure

## Logging

**Framework:** `console.error` / no structured logging library detected

**Patterns:**
- No application-level request logging middleware observed
- Errors surfaced to the client via JSON response bodies rather than server logs

## Comments

**When to Comment:**
- JSDoc comments on all exported middleware functions and route handlers
- Security rationale comments with ticket IDs (`T-04-06-01`) on any auth/privilege decision
- Inline comments for non-obvious business logic (e.g., optimistic pick building, Apple sign-in name capture)
- DB trigger behavior documented in route handler comments where the trigger does implicit work

**Style:**
- JSDoc `/** ... */` blocks on middleware and service exports
- Single-line `//` for inline explanations
- Multi-line business logic explanations use prose `//` blocks above the relevant code

## Module Design

**Exports:**
- Named exports only — no default exports (enforced by CLAUDE.md convention)
- `packages/shared/src/index.ts` acts as the barrel file for the shared package; all consumers import from `@cravyr/shared` directly

**Barrel Files:**
- Only at the shared package root (`packages/shared/src/index.ts`)
- Individual apps do not use barrel files — direct relative imports

## Zustand Store Pattern

All stores follow the same structure in `apps/mobile/stores/`:
```typescript
import { create } from 'zustand';

interface XState {
  // state fields
  // action signatures
}

export const useXStore = create<XState>()((set, get) => ({
  // initial state
  // action implementations using set/get
}));
```

- Curried `create<XState>()((set, get) => ...)` form for TypeScript type inference
- State and actions defined in a single interface
- `get()` used when an action needs to read current state before updating

## React Native Component Pattern

Components in `apps/mobile/components/` follow:
```typescript
import { ... } from 'react-native';
// other imports

interface ComponentProps {
  // props
}

export function Component({ prop }: ComponentProps) {
  // hooks at top
  // render
}

const styles = StyleSheet.create({
  // styles using theme tokens
});
```

- `StyleSheet.create()` defined at module level (not inside component)
- `theme` tokens from `apps/mobile/lib/theme.ts` used for colors, typography, spacing
- `accessibilityLabel` provided on interactive elements

---

*Convention analysis: 2026-07-02*
