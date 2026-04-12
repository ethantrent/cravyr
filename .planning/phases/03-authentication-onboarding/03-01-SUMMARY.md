---
phase: 03-authentication-onboarding
plan: 01
subsystem: mobile-auth
tags: [auth, routing, onboarding, packages, expo-router]
dependency_graph:
  requires: []
  provides:
    - Stack.Protected auth guard in app/_layout.tsx
    - useOnboardingStore (onboardingStore.ts) with step tracking and reset
    - @react-native-google-signin/google-signin@16.1.2 installed
    - expo-apple-authentication@~55.0.13 installed
    - expo-splash-screen@~55.0.17 installed
    - .env.example documenting all 3 Google OAuth env vars
    - app.config.ts Google Sign-In plugin with iosUrlScheme
  affects:
    - apps/mobile/app/_layout.tsx
    - apps/mobile/stores/onboardingStore.ts
    - apps/mobile/package.json
    - apps/mobile/app.config.ts
    - apps/mobile/.env.example
tech_stack:
  added:
    - "@react-native-google-signin/google-signin@16.1.2"
    - "expo-apple-authentication@~55.0.13"
    - "expo-splash-screen@~55.0.17"
  patterns:
    - "Stack.Protected dual guard (SDK 55 official pattern)"
    - "SplashScreen.preventAutoHideAsync() + hideAsync() after session check"
    - "supabase.auth.getSession() + onAuthStateChange subscription"
    - "Zustand create<State>()() factory pattern"
key_files:
  created:
    - apps/mobile/stores/onboardingStore.ts
  modified:
    - apps/mobile/app/_layout.tsx
    - apps/mobile/package.json
    - apps/mobile/app.config.ts
    - apps/mobile/.env.example
    - pnpm-lock.yaml
decisions:
  - "Used Stack.Protected (SDK 53+ pattern) instead of D-10's useEffect+router.replace() — eliminates auth flash, synchronous guard evaluation, per research recommendation"
  - "Used relative path import '../lib/supabase' (not @/ alias) to match existing codebase convention"
  - "Added expo-splash-screen as explicit dependency (was missing from package.json, required for SplashScreen API)"
metrics:
  duration: "~5 minutes"
  completed: "2026-04-12"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 5
---

# Phase 03 Plan 01: Auth Guard + Onboarding Store Foundation Summary

**One-liner:** Stack.Protected dual-guard routing with Supabase session subscription and Zustand onboarding step store, plus Google Sign-In + Apple auth packages installed.

## Tasks Completed

| Task | Description | Commit | Key Files |
|------|-------------|--------|-----------|
| 1 | Install packages, update app.config.ts, update .env.example | 3e7e83a | apps/mobile/package.json, apps/mobile/app.config.ts, apps/mobile/.env.example |
| 2 | Write Stack.Protected auth guard in _layout.tsx + create onboardingStore.ts | 0192990 | apps/mobile/app/_layout.tsx, apps/mobile/stores/onboardingStore.ts |

## What Was Built

### Auth Guard (_layout.tsx)

The root layout was fully rewritten to implement the `Stack.Protected` auth guard pattern (SDK 53+ official approach). It:

- Calls `supabase.auth.getSession()` on mount to resolve the initial session
- Holds the splash screen (`SplashScreen.preventAutoHideAsync()`) until the session check resolves, hiding it after `getSession()` completes
- Returns `null` during loading (keeps splash screen visible, prevents auth flash)
- Subscribes to `supabase.auth.onAuthStateChange` to track live session changes and cleans up on unmount
- Wraps tabs + detail/preferences/settings screens in `Stack.Protected guard={!!session}` — unauthenticated users cannot navigate there
- Wraps onboarding in `Stack.Protected guard={!session}` — authenticated users are redirected away from onboarding

### Onboarding Store (onboardingStore.ts)

A thin Zustand store that tracks onboarding step progression only. Preference draft data (cuisines/price/distance) remains in `preferencesStore.ts` per the plan's delegation pattern.

Exports:
- `OnboardingStep` type: `'location' | 'cuisines' | 'price' | 'distance' | 'auth'`
- `useOnboardingStore` with `step`, `setStep(step)`, and `reset()` actions

### Packages Installed

| Package | Version | Purpose |
|---------|---------|---------|
| `@react-native-google-signin/google-signin` | 16.1.2 | Native Google Sign-In flow → idToken → Supabase |
| `expo-apple-authentication` | ~55.0.13 | Native Apple Sign-In (mandatory when any social login offered) |
| `expo-splash-screen` | ~55.0.17 | SplashScreen API for auth loading state |

### app.config.ts

Added `@react-native-google-signin/google-signin` plugin entry with `iosUrlScheme: process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME` — required to register the reversed iOS client ID as a URL scheme in Info.plist so the Google SDK can redirect back after authentication.

### .env.example

Documented three new Google OAuth env vars with explanatory comments:
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` — Web Application OAuth client ID (required as `webClientId` in GoogleSignin.configure)
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` — iOS OAuth client ID
- `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME` — Reversed iOS client ID, used as `iosUrlScheme`

## Deviations from Plan

### Auto-added Missing Critical Functionality

**1. [Rule 2 - Missing Dep] Added expo-splash-screen install**
- **Found during:** Task 2
- **Issue:** `_layout.tsx` imports `* as SplashScreen from 'expo-splash-screen'` per plan spec, but `expo-splash-screen` was not listed in `apps/mobile/package.json` dependencies. TypeScript could not resolve the module.
- **Fix:** Ran `npx expo install expo-splash-screen` to install the SDK 55-aligned version (~55.0.17) and added it to package.json
- **Files modified:** apps/mobile/package.json, pnpm-lock.yaml
- **Commit:** 0192990

### Auto-fixed Bugs

**2. [Rule 1 - Bug] Fixed import path for supabase**
- **Found during:** Task 2
- **Issue:** Plan spec used `@/lib/supabase` path alias, but the tsconfig has no `@/` path mapping. All other files in the codebase use relative paths (e.g., `../lib/supabase`, `../../lib/supabase`). TypeScript errored with `Cannot find module '@/lib/supabase'`.
- **Fix:** Changed import to `../lib/supabase` (relative path matching existing codebase convention)
- **Files modified:** apps/mobile/app/_layout.tsx
- **Commit:** 0192990

## Pre-existing Issues (Out of Scope)

- `app.config.ts` has a pre-existing TypeScript error: `newArchEnabled` not in `ExpoConfig` type. This existed before this plan and is unrelated to our changes. It may require an `expo/tsconfig.base` upgrade or a type cast. Deferred.

## TypeScript Status

TypeScript reports zero errors in the two files authored in this plan (`_layout.tsx`, `onboardingStore.ts`). The single remaining TS error (`newArchEnabled` in `app.config.ts`) is pre-existing and out of scope for this plan.

## Self-Check: PASSED

Files exist:
- apps/mobile/app/_layout.tsx: FOUND
- apps/mobile/stores/onboardingStore.ts: FOUND
- apps/mobile/app.config.ts: FOUND
- apps/mobile/.env.example: FOUND

Commits exist:
- 3e7e83a: FOUND (chore(03-01): install google-signin and expo-apple-authentication packages)
- 0192990: FOUND (feat(03-01): Stack.Protected auth guard in _layout.tsx and onboardingStore)
