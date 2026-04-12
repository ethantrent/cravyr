# Phase 3: Authentication + Onboarding - Context

**Gathered:** 2026-04-12
**Status:** Ready for planning

<domain>
## Phase Boundary

A brand-new user completes the full onboarding flow — location permission, cuisine/price/distance preferences, and account creation via email, Google, or Apple Sign-In — and their session persists across app restarts. After this phase, the Expo Router auth guard protects the tabs so Phase 4's swipe deck only renders for authenticated users.

</domain>

<decisions>
## Implementation Decisions

### Onboarding Flow Order
- **D-01:** Sequence is **Location → Preferences → Auth**. User grants location and sets preferences before creating an account — they see value first (nearby restaurants will be personalized), then commit. The account creation is the final step.
- **D-02:** Preferences (cuisines, price range, distance) are held in a **Zustand onboarding store** (in-memory) during the flow and **flushed to the Supabase `preferences` table immediately after account creation** completes. No AsyncStorage needed for the onboarding flow — if the user abandons mid-onboarding, they restart from scratch.

### Sign-In Screen Layout
- **D-03:** **Single screen** with email/password form at the top, a divider, then "Continue with Google" and "Sign in with Apple" buttons below.
- **D-04:** **Single screen with sign-in / create account toggle** — not two separate screens. The toggle switches the CTA text ("Sign In" vs "Create Account") and adjusts any copy. Social auth works identically in both modes.

### Location Permission UX
- **D-05:** **Full-screen soft-prompt** before firing the native location dialog — centered icon, heading ("Find restaurants near you"), 2-sentence explanation of why location is needed, and a single "Allow Location" button. Fires the native `requestForegroundPermissionsAsync()` on tap.
- **D-06:** The iOS `NSLocationWhenInUseUsageDescription` string must be specific: `"Cravyr uses your location to find restaurants near you and show distance information."` (exact string — this is an App Store compliance requirement).
- **D-07:** **When location is denied**: show a dedicated fallback screen with an "Open Settings" deep link (`Linking.openSettings()`) and instructions to enable location. User cannot proceed to the swipe deck without location permission. No default city fallback.

### Preference Collection Depth
- **D-08:** Three required preference steps during onboarding:
  1. **Cuisines** — multi-select grid (~12 options: Italian, Japanese, Mexican, Indian, Chinese, Thai, American, Mediterranean, Korean, French, Middle Eastern, Other)
  2. **Price range** — select one or more levels: $, $$, $$$, $$$$
  3. **Max distance** — slider, 1km–25km, default 10km
- **D-09:** All three steps are **required** — no "Skip for now" option. User must complete all three before the onboarding flow routes to the auth (sign-in/create account) screen.

### Auth Guard Pattern
- **D-10:** **Expo Router auth guard in `app/_layout.tsx`** — use `useEffect` + `router.replace()` based on Supabase session state (`supabase.auth.onAuthStateChange`). Unauthenticated users are redirected to `/onboarding`. The onboarding screen group (`app/onboarding/`) is always accessible; the tabs group (`app/(tabs)/`) requires a valid session.

### Claude's Discretion
- Exact cuisine list icons and visual treatment of the multi-select grid
- Distance slider step increments (e.g., 1km steps vs 5km steps)
- Sign-in screen typography and spacing (follows established dark theme)
- Loading/error states during social sign-in (spinner, error toast)
- Whether to add a "Forgot password" flow for email auth (standard Supabase magic link or email reset)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Scope & Success Criteria
- `.planning/ROADMAP.md` §Phase 3 — Success criteria (5 items), requirements AUTH-01, UX-01

### Project Constraints & Architecture
- `.planning/PROJECT.md` — Apple Sign-In is mandatory when any social login is offered; full name must be captured and persisted on first Apple sign-in (Apple never returns it again); App Store compliance rules

### Technology Stack & Auth Implementation
- `CLAUDE.md` §Auth configuration — Google sign-in with `@react-native-google-signin/google-signin` + `supabase.auth.signInWithIdToken()`; Apple with `expo-apple-authentication`; `detectSessionInUrl: false` for React Native; `startAutoRefresh()` / `stopAutoRefresh()` on AppState change
- `CLAUDE.md` §Ten gotchas — #4 Apple Sign-In: full name only returned on first sign-in; #9 Location permission wording that passes App Store review

### Existing Mobile Code
- `apps/mobile/lib/supabase.ts` — Supabase client already correctly configured (AsyncStorage, detectSessionInUrl: false, AppState handling) — use as-is
- `apps/mobile/app/_layout.tsx` — Root Stack layout that needs the auth guard added (Phase 3 writes this)
- `apps/mobile/app/(tabs)/_layout.tsx` — Tab bar with dark theme (#0f0f0f bg, #f97316 active tint) — onboarding screens must match this visual language
- `apps/mobile/stores/preferencesStore.ts` — Existing preferences Zustand store — Phase 3's onboarding store should align with or extend this

### Prior Phase Decisions
- `.planning/phases/01-monorepo-scaffold-infrastructure/01-CONTEXT.md` — Remote-only Supabase (D-06), per-app .env files (D-07)
- `.planning/phases/04-swipe-core-secondary-screens/04-CONTEXT.md` — Phase 4 depends on Expo Router auth guard from Phase 3 (integration point)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/mobile/lib/supabase.ts` — Supabase client with AsyncStorage, auto-refresh, detectSessionInUrl: false. No changes needed.
- `apps/mobile/stores/preferencesStore.ts` — Existing preferences Zustand store. Onboarding flow should write to this store (or the onboarding store should flush into it after auth).
- `apps/mobile/app/(tabs)/_layout.tsx` — Tab bar visual treatment (dark theme, orange accent) — reference for onboarding screen design consistency.

### Established Patterns
- Dark theme: `backgroundColor: '#0f0f0f'`, orange accent `#f97316`, inactive gray `#636366`
- Zustand v5 for all state management (`create(() => ({ ... }))` pattern)
- Expo Router file-based navigation — onboarding screens at `app/onboarding/` (new group)
- Express 5 async error propagation in API routes

### Integration Points
- `app/_layout.tsx` — Auth guard with `supabase.auth.onAuthStateChange` redirects to `/onboarding` or `/(tabs)` based on session
- `supabase/migrations/` — `preferences` table already exists from Phase 1; Phase 3 writes user's onboarding preferences into it post-auth
- `packages/shared/` — Any shared types for auth/preferences should live here to keep mobile and API in sync

</code_context>

<specifics>
## Specific Ideas

- Onboarding sequence: Location soft-prompt → Location native dialog → Cuisine selection → Price range selection → Distance selection → Auth screen (sign in / create account)
- The "full name" capture for Apple Sign-In must happen in the `credential.fullName` callback on the very first sign-in and immediately `supabase.auth.updateUser({ data: { full_name: ... } })` — this is a one-time opportunity
- The fallback screen for denied location must use `Linking.openSettings()` to deep-link to app permissions (not a generic settings page)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-authentication-onboarding*
*Context gathered: 2026-04-12*
