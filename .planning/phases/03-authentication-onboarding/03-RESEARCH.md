# Phase 3: Authentication + Onboarding - Research

**Researched:** 2026-04-12
**Domain:** Expo Auth (email + Google + Apple), Expo Router guards, onboarding UX, location permissions
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Onboarding sequence is **Location → Preferences → Auth**. User grants location and sets preferences before creating an account.

**D-02:** Preferences are held in a **Zustand onboarding store** (in-memory) during the flow and **flushed to the Supabase `preferences` table immediately after account creation**. No AsyncStorage for onboarding. Abandoned mid-flow = restart from scratch.

**D-03:** Single auth screen with email/password form at the top, divider, then Google and Apple buttons below.

**D-04:** Single screen with sign-in / create account toggle — not two separate screens. Social auth works identically in both modes.

**D-05:** Full-screen soft-prompt before native location dialog — icon, heading, 2-sentence explanation, "Allow Location" button. Fires `requestForegroundPermissionsAsync()` on tap.

**D-06:** iOS `NSLocationWhenInUseUsageDescription` must be exactly: `"Cravyr uses your location to find restaurants near you and show distance information."` (App Store compliance — already set in `app.config.ts`).

**D-07:** When location is denied: dedicated fallback screen with `Linking.openSettings()` deep link. No default city fallback. User cannot proceed without location permission.

**D-08:** Three preference steps: (1) Cuisines multi-select grid, (2) Price range multi-select, (3) Max distance. All three required — no "Skip for now."

**D-09:** All three preference steps are required.

**D-10:** Expo Router auth guard in `app/_layout.tsx` using `useEffect + router.replace()` based on `supabase.auth.onAuthStateChange`. (See research note below — `Stack.Protected` is the current SDK 55 pattern.)

### Claude's Discretion

- Exact cuisine list icons and visual treatment of multi-select grid
- Distance slider step increments (discrete vs continuous)
- Sign-in screen typography and spacing
- Loading/error states during social sign-in
- Whether to add a "Forgot password" flow

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | Supabase auth (email + Google + Apple) with session persistence across app restarts | Confirmed: `supabase.ts` already configured with AsyncStorage + autoRefresh; Google needs `@react-native-google-signin/google-signin` + `iosUrlScheme` plugin; Apple needs `expo-apple-authentication` + nonce handling |
| UX-01 | Onboarding flow: location permission → preferences → account creation, with session-guard protecting tabs | Confirmed: `Stack.Protected` (SDK 53+) is the current Expo Router pattern; onboarding file group at `app/onboarding/`; `user_preferences` INSERT covered by existing RLS `preferences_owner` policy |
</phase_requirements>

---

## Summary

Phase 3 wires three distinct concerns: (1) social and email auth via Supabase, (2) a 5-screen onboarding flow that collects location permission and preferences before account creation, and (3) an Expo Router auth guard that protects the tabs group.

The infrastructure is mostly in place. The Supabase client (`apps/mobile/lib/supabase.ts`) is already correctly configured with AsyncStorage, `detectSessionInUrl: false`, and AppState auto-refresh handling. The `user_preferences` table exists with an `FOR ALL` RLS policy that covers INSERT. The `@cravyr/shared` package exports `UserPreferences`, `CUISINE_OPTIONS`, and `UserPreferences` types that the onboarding store will reuse. The `preferencesStore.ts` already implements the draft/commit pattern needed — the onboarding store can use the same store (flush to it on auth completion) rather than creating a separate one.

The primary complexity is the Google Sign-In native setup, which requires two OAuth client IDs from Google Cloud Console (a Web client ID and an iOS client ID), an `iosUrlScheme` plugin entry in `app.config.ts`, and a development build — it cannot run in Expo Go. Apple Sign-In has the critical "full name returned only once" constraint that requires an immediate `supabase.auth.updateUser()` call on first sign-in. The auth guard decision (D-10) references the older `useEffect + router.replace()` pattern; `Stack.Protected` (introduced in SDK 53, available in SDK 55) is cleaner but either approach works — this is left to the planner's discretion.

There is one schema constraint conflict: CONTEXT.md D-08 describes the distance preference as a "slider, 1km–25km, default 10km," but the live database CHECK constraint and the `UserPreferences` TypeScript type both lock `max_distance_km` to `ANY(ARRAY[1, 5, 15])`. The onboarding UI must use three discrete options (1 km, 5 km, 15 km), not a free slider from 1–25.

**Primary recommendation:** Use `Stack.Protected` for the auth guard, reuse `preferencesStore.ts` draft actions for onboarding state, and treat the distance preference as a 3-option toggle (not a slider) to match the live schema constraint.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@react-native-google-signin/google-signin` | 16.1.2 | Native Google Sign-In flow → idToken → Supabase | Only maintained native Google Sign-In for RN; required for non-Firebase Supabase flow |
| `expo-apple-authentication` | 55.0.13 | Native Apple Sign-In (mandatory when any social login offered) | Ships with Expo SDK 55; required by App Store policy; works in Expo Go for testing |
| `expo-location` | 55.1.8 | `requestForegroundPermissionsAsync()` | Already installed in `apps/mobile/package.json` |
| `@supabase/supabase-js` | 2.101.1 | Auth: `signUp`, `signIn`, `signInWithIdToken`, `updateUser`, `onAuthStateChange` | Already installed and configured; no changes to `lib/supabase.ts` needed |
| Zustand (via `preferencesStore.ts`) | 5.0.12 | Onboarding state (draft cuisines/price/distance) | Already installed; pattern established |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `expo-router` | 55.0.12 | `Stack.Protected` guard, file-based onboarding route group | Already installed; SDK 55 supports `Stack.Protected` |
| `react-native` `Linking` | bundled | `Linking.openSettings()` for denied-location fallback | Built-in; no install needed |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `Stack.Protected` guard | `useEffect + router.replace()` (D-10) | Both work in SDK 55. `Stack.Protected` is the official SDK 53+ pattern and eliminates async flash-of-wrong-screen. `useEffect + router.replace()` is locked in D-10 but is technically fine — planner may choose either. |
| 3-option distance toggle | Free slider | DB constraint `CHECK (max_distance_km = ANY (ARRAY[1, 5, 15]))` makes a free slider incorrect — it would fail on insert unless migration + type are also updated. |

**Installation (new packages only — all others already installed):**

```bash
# From apps/mobile
npx expo install expo-apple-authentication
pnpm add @react-native-google-signin/google-signin
```

`expo-location` is already in `package.json` (v55.1.8). `expo-apple-authentication` is not yet installed. `@react-native-google-signin/google-signin` is not yet installed.

**Version verification:** [VERIFIED: npm registry]
- `@react-native-google-signin/google-signin` latest: 16.1.2 (published 2025)
- `expo-apple-authentication` latest: 55.0.13 (SDK 55 aligned)
- `expo-location` already at 55.1.8 in `package.json`

---

## Architecture Patterns

### Recommended File Structure (new files only)

```
apps/mobile/app/
├── _layout.tsx                        # MODIFY: add Stack.Protected auth guard + onboarding screens
├── onboarding/
│   ├── _layout.tsx                    # NEW: Stack for onboarding sequence
│   ├── index.tsx                      # NEW: Location soft-prompt screen
│   ├── location-denied.tsx            # NEW: Fallback screen with Linking.openSettings()
│   ├── cuisines.tsx                   # NEW: Cuisine multi-select grid
│   ├── price-range.tsx                # NEW: Price range multi-select
│   ├── distance.tsx                   # NEW: Distance 3-option selector
│   └── auth.tsx                       # NEW: Sign-in / Create account toggle screen
apps/mobile/stores/
│   └── onboardingStore.ts             # NEW: transient store for onboarding flow progress
```

The `preferencesStore.ts` draft actions (`draftCuisines`, `draftPriceRange`, `draftMaxDistance`) already implement the data model needed for onboarding. The onboarding store only needs to track: (a) which step the user is on, and (b) the draft values before flush. The cleanest approach is a thin `onboardingStore.ts` that holds step state and delegates data to the existing `preferencesStore` draft actions.

### Pattern 1: Stack.Protected Auth Guard

**What:** Wraps `(tabs)` screen group so unauthenticated users cannot navigate there. Wraps `onboarding` group so authenticated users are not shown it.

**When to use:** SDK 53+ (which includes SDK 55). Eliminates the `useEffect` timing issue where a brief flash of the wrong screen occurs during navigation resolution.

```typescript
// Source: https://docs.expo.dev/router/advanced/protected/
// app/_layout.tsx — modified version

import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setSession(session)
    );
    return () => subscription.unsubscribe();
  }, []);

  if (loading) return null; // Keep splash screen visible via SplashScreen.preventAutoHideAsync()

  return (
    <Stack>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="restaurant/[id]" options={{ ... }} />
        <Stack.Screen name="preferences" options={{ ... }} />
        <Stack.Screen name="settings" options={{ ... }} />
      </Stack.Protected>

      <Stack.Protected guard={!session}>
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}
```

[CITED: https://docs.expo.dev/router/advanced/protected/]

### Pattern 2: Google Sign-In → Supabase

**What:** `GoogleSignin.configure()` once at app start, then `signIn()` + `signInWithIdToken`.

**Key constraint:** `webClientId` is the Web OAuth client ID from Google Cloud Console — NOT the iOS or Android client ID. The `iosUrlScheme` is the reversed iOS client ID (`com.googleusercontent.apps.XXXX`).

```typescript
// Source: https://supabase.com/docs/guides/auth/social-login/auth-google + [CITED: react-native-google-signin docs]
import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';
import { supabase } from '@/lib/supabase';

// Call once at app startup (e.g., in RootLayout or a provider)
GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
});

async function signInWithGoogle() {
  await GoogleSignin.hasPlayServices();
  const response = await GoogleSignin.signIn();
  if (isSuccessResponse(response)) {
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: response.data.idToken!,
    });
    if (error) throw error;
    return data;
  }
}
```

### Pattern 3: Apple Sign-In → Supabase (with name capture)

**What:** `AppleAuthentication.signInAsync()` with both FULL_NAME and EMAIL scopes. Immediately call `supabase.auth.updateUser()` with name if `credential.fullName` is non-null.

**Critical:** `credential.fullName` returns non-null ONLY on the very first sign-in. On all subsequent sign-ins it is null. The `updateUser` call must happen before any other async operations and must not be skipped if fullName is null (to avoid overwriting a previously saved name).

```typescript
// Source: https://supabase.com/docs/guides/auth/social-login/auth-apple [CITED]
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from '@/lib/supabase';

async function signInWithApple() {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  if (!credential.identityToken) throw new Error('No identity token from Apple');

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
  });
  if (error) throw error;

  // Capture full name ONLY if non-null — Apple provides this exactly once
  const givenName = credential.fullName?.givenName;
  const familyName = credential.fullName?.familyName;
  if (givenName || familyName) {
    const fullName = [givenName, familyName].filter(Boolean).join(' ');
    await supabase.auth.updateUser({
      data: { full_name: fullName, given_name: givenName, family_name: familyName },
    });
  }

  return data;
}
```

[CITED: https://supabase.com/docs/guides/auth/social-login/auth-apple]

### Pattern 4: Preferences Flush After Auth

**What:** After `signUp` or `signInWithIdToken` succeeds, the authenticated user's draft preferences are written to `user_preferences`.

**Key:** The `preferences_owner` RLS policy is `FOR ALL`, which covers INSERT. The `user_id` must equal `auth.uid()` — pass it explicitly from the session.

```typescript
// After successful auth, flush onboarding state to DB
async function flushPreferences(userId: string, drafts: {
  cuisines: string[];
  priceRange: Array<1|2|3|4>;
  maxDistanceKm: 1 | 5 | 15;
}) {
  const { error } = await supabase
    .from('user_preferences')
    .upsert({
      user_id: userId,
      cuisines: drafts.cuisines,
      price_range: drafts.priceRange,
      max_distance_km: drafts.maxDistanceKm,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

  if (error) throw error;
}
```

### Anti-Patterns to Avoid

- **Calling `router.replace()` inside `onAuthStateChange`:** Causes race conditions with Expo Router hydration. Use `Stack.Protected` instead, or if using `useEffect + router.replace()` (D-10), call replace from within the effect body only after `loading` is false.
- **Skipping Apple `updateUser` when `fullName` is null:** Correct — don't call `updateUser` if fullName is null; it would overwrite an existing name with an empty value.
- **Passing all `credential.fullName` parts without null-check:** `credential.fullName.givenName` can be null even when `fullName` itself is not null — filter with `filter(Boolean)`.
- **Using `supabase.from('user_preferences').insert()` instead of `upsert()`:** Social sign-in may trigger `onAuthStateChange` multiple times; upsert with `onConflict: 'user_id'` is safe for re-runs.
- **Configuring Google Sign-In with Android client ID instead of Web client ID:** `webClientId` must be the Web Application type OAuth credential from Google Cloud Console, not the Android type.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Native Google Sign-In | OAuth WebView flow | `@react-native-google-signin/google-signin` | Native SDK handles token refresh, Play Services checks, keychain storage; WebView flow violates Google ToS for mobile |
| Native Apple Sign-In | Custom ASWebAuthenticationSession | `expo-apple-authentication` | Expo SDK handles entitlements, `com.apple.developer.applesignin` capability, and credential storage |
| Foreground location request | Manual native permissions | `expo-location` `requestForegroundPermissionsAsync()` | Handles iOS/Android difference; re-prompting behavior; status values |
| Deep-link to Settings | Platform-specific code | `Linking.openSettings()` or `Linking.openURL('app-settings:')` | React Native built-in; works on both platforms |
| Session persistence | Manual AsyncStorage reads | Supabase client + `persistSession: true` (already configured) | `lib/supabase.ts` already handles this |

**Key insight:** The Supabase client, Google Sign-In SDK, and Apple authentication SDK handle all the credential storage, token refresh, and platform-specific behavior. The app code is just the glue between SDK calls.

---

## Schema / Type Conflict: max_distance_km

**This is an active constraint that affects the onboarding UI design (D-08).**

The CONTEXT.md D-08 describes distance as a "slider, 1km–25km, default 10km." However:

- `user_preferences` table: `CHECK (max_distance_km = ANY (ARRAY[1, 5, 15]))` [VERIFIED: migration file]
- `@cravyr/shared` `UserPreferences` type: `max_distance_km: 1 | 5 | 15` [VERIFIED: codebase]
- `preferencesStore.ts` `draftMaxDistance`: `1 | 5 | 15` [VERIFIED: codebase]

**Resolution:** The onboarding distance screen must present three discrete options (1 km, 5 km, 15 km), not a free slider from 1–25. Default should be 5 km (matches DB DEFAULT). The "slider" language in D-08 likely referred to a segmented control / toggle UX metaphor, not a continuous input.

If a free-range slider is genuinely desired, a new migration to relax the CHECK constraint AND a TypeScript type update would be required — that is out of scope for Phase 3 without explicit user approval.

---

## Common Pitfalls

### Pitfall 1: Apple Sign-In Full Name Lost on Second Login

**What goes wrong:** App captures Google display name correctly, but Apple users only see their email after the first session expires and they re-authenticate — full name is blank/null.

**Why it happens:** Apple returns `credential.fullName` only on the first sign-in ever for a given Apple ID + app bundle combination. Subsequent calls return null.

**How to avoid:** In the Apple sign-in handler, call `supabase.auth.updateUser()` with `data.full_name` immediately after a successful `signInWithIdToken`, but only if `credential.fullName?.givenName` is non-null. [VERIFIED: https://supabase.com/docs/guides/auth/social-login/auth-apple]

**Warning signs:** User signs out and back in; their name disappears in the UI.

### Pitfall 2: Apple Sign-In Fails in Expo Go (Wrong `aud` Claim)

**What goes wrong:** `supabase.auth.signInWithIdToken()` with Apple token returns a 401 or "Invalid JWT" error during development with Expo Go.

**Why it happens:** When testing in Expo Go, `AppleAuthentication.signInAsync()` returns an `identityToken` JWT where `aud` is `host.exp.Exponent` (Expo's bundle ID), not `com.cravyr.app`. Supabase's Apple provider validates the audience claim and rejects the token. [VERIFIED: https://github.com/expo/expo/issues/16162]

**How to avoid:** Test Apple Sign-In only with a development build (`npx expo run:ios` or `eas build --profile development`). Do not test Apple Sign-In end-to-end in Expo Go.

**Warning signs:** Apple Sign-In works in Expo Go up to the native dialog, then fails silently or returns a 400/401 from Supabase.

### Pitfall 3: Google Sign-In Not Working in Expo Go

**What goes wrong:** `GoogleSignin.configure()` throws or the sign-in button does nothing in Expo Go.

**Why it happens:** `@react-native-google-signin/google-signin` uses native modules that are not bundled in Expo Go. [VERIFIED: react-native-google-signin.github.io/docs/setting-up/expo]

**How to avoid:** Google Sign-In requires a development build. Add a conditional in dev: render a placeholder "Google (dev build only)" button, or use `GoogleSignin.isSignedIn()` in a try/catch to detect the missing module.

**Warning signs:** Module not found error, app crashes immediately on Google button tap in Expo Go.

### Pitfall 4: `Stack.Protected` vs. `useEffect + router.replace()` Flash

**What goes wrong:** With `useEffect + router.replace()` (D-10), there is a brief frame where the protected screen renders before the redirect fires. On slow devices this shows the tabs screen to an unauthenticated user for ~100–300ms before redirect.

**Why it happens:** The `useEffect` runs after the first render. Expo Router has already rendered the matched route by then.

**How to avoid:** Render `null` (keeping splash screen visible) until `loading === false`, then return the navigator. With `Stack.Protected`, this flash is eliminated because the guard is evaluated synchronously at render time.

**Warning signs:** Tabs tab bar briefly visible on cold launch before redirect to onboarding.

### Pitfall 5: Preferences INSERT Fails with RLS Error After Auth

**What goes wrong:** `supabase.from('user_preferences').upsert(...)` returns a 403 or "violates row-level security" error immediately after account creation.

**Why it happens:** There is a brief window (< 1s) between `signUp()` resolving and the Supabase Auth JWT being refreshed with the new `auth.uid()`. If the upsert fires before the session is live, `auth.uid()` returns null and the RLS check fails.

**How to avoid:** Use `onAuthStateChange` to detect the `SIGNED_IN` event, then flush preferences — do not fire the upsert in the same synchronous call chain as `signUp()`. Alternatively, `await supabase.auth.getSession()` after signUp before upsert.

**Warning signs:** First-time sign-up works, but the preferences row is not created; `user_preferences` table is empty for the new user.

### Pitfall 6: `iosUrlScheme` Missing Causes Silent Google Sign-In Failure on iOS

**What goes wrong:** Google Sign-In appears to work (native dialog shows) but the app never receives the callback — it just returns to the sign-in screen.

**Why it happens:** iOS requires the reversed client ID (`com.googleusercontent.apps.XXXXX`) registered as a URL scheme in `Info.plist`. Without the `iosUrlScheme` plugin entry, the Google SDK cannot redirect back to the app after authentication. [CITED: react-native-google-signin.github.io/docs/setting-up/expo]

**How to avoid:** Add to `app.config.ts` plugins:
```typescript
['@react-native-google-signin/google-signin', {
  iosUrlScheme: process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME,
}]
```
Rebuild the development build after adding the plugin.

**Warning signs:** Google sign-in works on Android but silently does nothing on iOS after the consent screen.

---

## Code Examples

### Auth Guard in _layout.tsx (Stack.Protected approach)

```typescript
// Source: https://docs.expo.dev/router/advanced/protected/ [CITED]
// Replaces the current minimal RootLayout — MODIFY, do not recreate

import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      SplashScreen.hideAsync();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setSession(session)
    );
    return () => subscription.unsubscribe();
  }, []);

  if (loading) return null;

  return (
    <Stack>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="restaurant/[id]" options={{ headerShown: true, title: '', headerTransparent: true, presentation: 'card' }} />
        <Stack.Screen name="preferences" options={{ title: 'Preferences', headerTintColor: '#ffffff', headerStyle: { backgroundColor: '#0f0f0f' } }} />
        <Stack.Screen name="settings" options={{ title: 'Settings', headerTintColor: '#ffffff', headerStyle: { backgroundColor: '#0f0f0f' } }} />
      </Stack.Protected>

      <Stack.Protected guard={!session}>
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}
```

### Location Soft-Prompt → Native Dialog → Denied Fallback

```typescript
// Source: https://docs.expo.dev/versions/latest/sdk/location/ [CITED]
import * as Location from 'expo-location';
import { Linking } from 'react-native';
import { router } from 'expo-router';

async function handleAllowLocationTap() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status === 'granted') {
    router.push('/onboarding/cuisines');
  } else {
    router.push('/onboarding/location-denied');
  }
}

// On location-denied screen:
function handleOpenSettings() {
  Linking.openSettings(); // opens app-specific settings on both iOS and Android
}
```

### Onboarding State Store

```typescript
// apps/mobile/stores/onboardingStore.ts [ASSUMED pattern based on existing preferencesStore.ts]
import { create } from 'zustand';

type OnboardingStep = 'location' | 'cuisines' | 'price' | 'distance' | 'auth';

interface OnboardingState {
  step: OnboardingStep;
  setStep: (step: OnboardingStep) => void;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>()((set) => ({
  step: 'location',
  setStep: (step) => set({ step }),
  reset: () => set({ step: 'location' }),
}));
// Draft preference data lives in preferencesStore.ts draftCuisines / draftPriceRange / draftMaxDistance
```

---

## Runtime State Inventory

> Phase 3 is not a rename/refactor phase — this section is minimal.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | `user_preferences` table exists (empty for any existing test users) | First-time flush from onboarding writes new row |
| Live service config | Supabase Auth providers (Google, Apple) must be enabled in Supabase dashboard — not in git | Manual: enable Google + Apple in Supabase Auth → Providers settings |
| OS-registered state | None | None |
| Secrets/env vars | `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME` — not yet in `.env` or `apps/mobile/.env` | Add to `apps/mobile/.env` and `.env.example` |
| Build artifacts | Google Sign-In requires development build — Expo Go will not work | `npx expo run:ios` / `eas build --profile development` needed before testing Google auth |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `expo-apple-authentication` | Apple Sign-In | Not yet installed | 55.0.13 (latest) | None — required by App Store policy |
| `@react-native-google-signin/google-signin` | Google Sign-In | Not yet installed | 16.1.2 (latest) | None — no alternative native Google Sign-In library |
| `expo-location` | Location permission prompt | Already installed | 55.1.8 | N/A |
| Google Cloud Console OAuth credentials | Google Sign-In | Unknown — must verify manually | N/A | Cannot implement Google Sign-In without credentials |
| Supabase Auth: Google provider enabled | Google Sign-In | Unknown — must verify in dashboard | N/A | Cannot test until enabled |
| Supabase Auth: Apple provider enabled | Apple Sign-In | Unknown — must verify in dashboard | N/A | Cannot test until enabled |
| Development build | Google Sign-In + Apple Sign-In (production test) | Not built yet | N/A | Expo Go for email auth testing only |

**Missing dependencies with no fallback:**
- `expo-apple-authentication` — must install before any Apple auth implementation
- `@react-native-google-signin/google-signin` — must install before any Google auth implementation
- Google Cloud Console OAuth credentials — developer must create iOS + Web OAuth client IDs in Google Cloud Console and add `iosUrlScheme` to `app.config.ts`

**Missing dependencies with fallback:**
- Development build: email auth can be tested in Expo Go; Google + Apple require dev build

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `useEffect + router.replace()` auth guard | `Stack.Protected` guard prop | Expo Router SDK 53 (2024) | Eliminates auth flash; synchronous guard evaluation |
| `react-native-auth-screen` (outdated) | Direct Supabase `signUp`/`signInWithIdToken` | Ongoing | Supabase v2 handles everything natively |
| Storing Google `accessToken` | Store Google `idToken` only, pass to Supabase | Current | Supabase verifies the idToken server-side; access token not needed |

**Deprecated/outdated:**
- `expo-google-sign-in`: Deprecated. Use `@react-native-google-signin/google-signin` instead.
- React Navigation manual auth redirects: Still works, but Expo Router `Stack.Protected` is cleaner for file-based routing.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `max_distance_km: 1 \| 5 \| 15` is intentional and should not be expanded to a free slider | Schema Conflict section | If a continuous slider was truly intended, the plan will need a migration task added |
| A2 | The Google OAuth credentials (Web Client ID, iOS Client ID, iosUrlScheme) have not yet been created in Google Cloud Console | Environment Availability | If already created, the env var setup task is shorter |
| A3 | Apple Sign-In has not yet been enabled in the Supabase dashboard | Environment Availability | If already enabled, the "enable Apple provider" task is not needed |
| A4 | Google Sign-In has not yet been enabled in the Supabase dashboard | Environment Availability | Same as A3 |
| A5 | The `app/(tabs)/` Stack screens defined in `_layout.tsx` (preferences, settings, restaurant/[id]) should all move inside `Stack.Protected guard={!!session}` | Auth Guard pattern | If planner uses `useEffect + router.replace()` (D-10) instead, the Stack structure stays as-is |

---

## Open Questions

1. **Onboarding re-entry after partial completion**
   - What we know: D-02 says abandoned onboarding restarts from scratch (no AsyncStorage)
   - What's unclear: If a user installs the app, completes cuisines, then backgrounds it for 3 days — when they return, do they restart at step 1 (location) or at the auth screen?
   - Recommendation: Since no AsyncStorage is used, Zustand resets on app restart — they always restart from step 1. This is consistent with D-02.

2. **Returning authenticated user who skipped preferences (edge case)**
   - What we know: All three preference steps are required (D-09)
   - What's unclear: If a user somehow has an active session but no `user_preferences` row (e.g., DB was wiped during development), should the auth guard redirect them back through onboarding?
   - Recommendation: Check for `user_preferences` row after session load. If session exists but no preferences row, redirect to `/onboarding/cuisines` instead of `/(tabs)`. Planner should decide.

3. **`Stack.Protected` vs. `useEffect + router.replace()` (D-10 vs. current SDK recommendation)**
   - What we know: D-10 locks `useEffect + router.replace()`. `Stack.Protected` is the current official SDK 55 pattern.
   - What's unclear: Whether the user wants to be informed of the newer pattern before execution.
   - Recommendation: Planner should note both approaches in the plan and implement `Stack.Protected` (it is strictly better and D-10 pre-dates the SDK 53 feature). If the user has a strong reason for the old pattern, they can override during plan review.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase Auth (email+password min length, bcrypt server-side); social via IdP tokens only |
| V3 Session Management | yes | Supabase JWT in AsyncStorage via `supabase-js`; `autoRefreshToken: true`; `startAutoRefresh()`/`stopAutoRefresh()` on AppState already implemented |
| V4 Access Control | yes | Expo Router `Stack.Protected`; Supabase RLS `preferences_owner FOR ALL` |
| V5 Input Validation | yes | Email format: Supabase validates server-side; password: enforce min 8 chars client-side; cuisine/price selections from fixed enum (`CUISINE_OPTIONS` from `@cravyr/shared`) |
| V6 Cryptography | no | Passwords never touch client; Apple nonce handled by `expo-apple-authentication` |

### Known Threat Patterns for Supabase Auth + Expo

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Replay of Apple identityToken | Spoofing | Supabase validates `exp` claim; token is single-use by Apple |
| Stale session after account deletion | Elevation of Privilege | `supabase.auth.signOut()` on account delete (Phase 4 Settings) + RLS enforces per-row |
| User_id injection in preferences upsert | Tampering | Always use `auth.uid()` from server session, not a client-supplied value; current RLS enforces this |
| Location permission data leak | Information Disclosure | `requestForegroundPermissionsAsync()` — no "Always" permission requested; coordinates not logged |

---

## Sources

### Primary (HIGH confidence)
- Supabase `lib/supabase.ts` in codebase — verified AsyncStorage, autoRefresh, detectSessionInUrl config
- `supabase/migrations/20260411000000_remote_schema.sql` — verified `user_preferences` schema, CHECK constraint, `preferences_owner` RLS policy
- `packages/shared/src/types/preferences.ts` — verified `UserPreferences` type and `max_distance_km: 1 | 5 | 15`
- `apps/mobile/package.json` — verified installed packages and versions
- `apps/mobile/app.config.ts` — verified `NSLocationWhenInUseUsageDescription` already set correctly
- npm registry — verified package versions: google-signin 16.1.2, expo-apple-authentication 55.0.13, expo-location 55.1.8

### Secondary (MEDIUM confidence)
- [CITED: https://docs.expo.dev/router/advanced/protected/] — `Stack.Protected` API and guard prop behavior
- [CITED: https://supabase.com/docs/guides/auth/social-login/auth-apple] — Apple Sign-In identityToken flow, no nonce required for native Expo flow, fullName capture pattern
- [CITED: https://supabase.com/docs/guides/auth/social-login/auth-google] — Google signInWithIdToken pattern, webClientId requirement
- [CITED: https://react-native-google-signin.github.io/docs/setting-up/expo] — iosUrlScheme plugin configuration, development build requirement
- [CITED: https://docs.expo.dev/versions/latest/sdk/apple-authentication/] — FULL_NAME + EMAIL scopes, first-login-only constraint
- [CITED: https://docs.expo.dev/versions/latest/sdk/location/] — `requestForegroundPermissionsAsync()` API, `Linking.openSettings()`

### Tertiary (LOW confidence)
- [WebSearch] GitHub issue expo/expo#16162 — Apple Sign-In `aud: host.exp.Exponent` in Expo Go [LOW — single issue, not official docs, but widely reproduced]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified against npm registry; packages verified against codebase
- Architecture patterns: HIGH — `Stack.Protected` from official Expo docs; Apple/Google flows from official Supabase docs
- Schema constraints: HIGH — verified directly in migration file and shared types
- Pitfalls: MEDIUM-HIGH — Apple aud issue from GitHub issue (widely reproduced); other pitfalls from official docs

**Research date:** 2026-04-12
**Valid until:** 2026-05-12 (30 days — Expo Router and Supabase Auth APIs are stable)
