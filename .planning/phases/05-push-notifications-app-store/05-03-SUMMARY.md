---
phase: 05-push-notifications-app-store
plan: 03
subsystem: infra, ci, mobile
tags: [eas, expo, github-actions, app-store, testflight, submit]

requires:
  - phase: 05-01
    provides: "expo-notifications plugin registered in app.config.ts"
  - phase: 05-02
    provides: "Push delivery pipeline that TestFlight testers can trigger"
provides:
  - "EAS production build profile with autoIncrement, API_URL env, submit config"
  - ".github/workflows/eas-build.yml — main-push CI build filtered to apps/mobile/** + packages/shared/**"
  - "App Store pre-submission checklist with gating items identified"
affects: [submission, testflight, app-store-launch]

tech-stack:
  added: []
  patterns: [path-filtered-ci-trigger, eas-auto-increment-build-number]

key-files:
  created:
    - .github/workflows/eas-build.yml
  modified:
    - apps/mobile/eas.json
    - apps/mobile/app.config.ts

key-decisions:
  - "CI filters on apps/mobile/** + packages/shared/** — avoids wasteful builds for API-only changes"
  - "Production build profile sets EXPO_PUBLIC_API_URL=https://cravyr-api.onrender.com so builds don't depend on local .env"
  - "newArchEnabled: true retained — required by react-native-worklets 0.7.2 used by rn-swiper-list 3.0.0"
  - "ascAppId and serviceAccountKeyPath are placeholders — intentional, Apple Developer + Google Play setup is a human gate"

patterns-established:
  - "EAS build/submit config lives in apps/mobile/eas.json; never inline in CLI invocations"
  - "Project-scoped secrets (EXPO_TOKEN) via GitHub Actions repo secrets, not workflow env"

requirements-completed: [NOTIF-01, INFRA-01]

duration: retroactive
completed: 2026-04-15
reconciled: 2026-04-24
---

# Plan 05-03: EAS Build Config + CI + Pre-Submission Checklist Summary

**EAS production build profile wired end-to-end with GitHub Actions CI on main-push, path-filtered to mobile-only changes. Pre-submission checklist identifies remaining human-gated items (ascAppId, privacy policy URL, App Store Connect setup).**

## Performance

- **Duration:** retroactive (EAS-adjacent commits: `1e53b74` + `ecc981c` sync)
- **Completed:** 2026-04-15
- **Reconciled to GSD:** 2026-04-24
- **Tasks:** 2 auto + 1 human checklist
- **Files created:** 1
- **Files modified:** 2

## Accomplishments

- `apps/mobile/eas.json` — production profile with `autoIncrement: true` and `EXPO_PUBLIC_API_URL` pointing to Render; submit config scaffolded for iOS (`ascAppId`) and Android (`track: internal`, `serviceAccountKeyPath`)
- `.github/workflows/eas-build.yml` — triggers on push to `main` filtered to `apps/mobile/**` and `packages/shared/**`; uses pnpm 9 + Node 20 + expo/expo-github-action@v8 + frozen lockfile; runs `eas build --platform all --profile production --non-interactive`
- `app.config.ts` verified — bundleIdentifier `com.cravyr.app` (iOS), package `com.cravyr.app` (Android), `usesAppleSignIn: true`, `NSLocationWhenInUseUsageDescription` has specific wording, `expo-apple-authentication` + `expo-notifications` + `expo-location` + Google Sign-In plugins all registered
- `EAS_PROJECT_ID` = `e6d2a650-fd20-4092-a4a5-0f7a211e1e1a` — live Expo project exists

## Task Commits

1. **Task 1 — eas.json production profile + submit scaffold** — split across `1e53b74` (EAS setup, disable new arch, gitignore) and `ecc981c` (sync)
2. **Task 2 — .github/workflows/eas-build.yml** — part of `ecc981c` (sync)
3. **Task 3 — pre-submission checklist** — see `Issues Encountered` for unresolved items

## Files Created/Modified

- `.github/workflows/eas-build.yml` — EAS build pipeline
- `apps/mobile/eas.json` — build profiles (development/preview/production) + submit config
- `apps/mobile/app.config.ts` — all required plugins, bundle IDs, permission strings, EAS project ID

## Decisions Made

- **Path-filtered CI:** triggering on every `main` push would waste EAS build minutes for API-only or planning-only commits. Filter scopes to `apps/mobile/**` + `packages/shared/**` only.
- **autoIncrement in production profile:** App Store rejects uploads with duplicate build numbers; EAS's `autoIncrement: true` handles this automatically — no manual version bumps needed between builds.
- **Kept `newArchEnabled: true`:** earlier commit (`1e53b74`) experimented with disabling it; reverted because `react-native-worklets@0.7.2` (peer dep of `rn-swiper-list@3.0.0`) requires New Architecture.
- **Google Sign-In iOS URL scheme pulled from env** — `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME` with a baked-in fallback client ID. Keeps local dev working without leaking prod secrets.

## Deviations from Plan

None material — plan was followed.

## Issues Encountered

### Pre-Submission Checklist Status

| # | Item | Status | Blocker |
|---|------|--------|---------|
| 1 | Delete Account endpoint | ✓ Done | Phase 04 — `DELETE /api/v1/users/me` wired |
| 2 | Apple Sign-In UI | ◆ Placeholder | Needs Apple Developer entitlement + App Store Connect app ID |
| 3 | Location permission string | ✓ Done | Specific wording set in `NSLocationWhenInUseUsageDescription` |
| 4 | Minimum functionality | ✓ Done | Onboarding, swipe deck, detail, saved list, prefs, settings all shipped |
| 5 | Privacy Policy URL | ✗ Not done | **Human gate** — needs a hosted privacy policy page (landing site or static) |
| 6 | App Icon (1024x1024) | ◆ Partial | `./assets/icon.png` exists — verify it meets 1024×1024 raster spec |
| 7 | App Store screenshots | ✗ Not done | **Human gate** — capture after final UI polish |
| 8 | `ascAppId` in eas.json | ✗ Placeholder (`YOUR_APP_STORE_CONNECT_ID`) | **Human gate** — create App Store Connect record, paste real ID |
| 9 | Google Play `google-sa.json` | ✗ Not committed | **Human gate** — generate Play service account key, reference via CI secret not repo file |
| 10 | `EXPO_TOKEN` GitHub secret | ? Unknown | **Human gate** — verify set under repo Settings → Secrets |
| 11 | Apple APNs credentials | ? Unknown | **Human gate** — run `eas credentials` once to provision |
| 12 | Firebase FCM server key | ? Unknown | **Human gate** — needed for Android push delivery |

### Items that were DONE beyond the plan (uncommitted on `main` at reconciliation time)

- `scripts/eas-ship-readiness.mjs` — local EAS config sanity script
- `scripts/prod-smoke-mobile.mjs`, `scripts/prod-verify.mjs` — production smoke helpers
- `scripts/device-uat-checklist.mjs`, `scripts/dashboard-checklist.mjs` — UAT prep
- `apps/mobile/env.smoke.template` — smoke test env template
- Edits to `apps/mobile/app/settings.tsx`, both `.env.example` files

These ship-readiness scripts belong to Phase 05 spiritually but were never committed. Recommend a `chore(05): commit ship-readiness scripts` commit as part of phase closure.

## User Setup Required

All items in **Issues Encountered** rows flagged **Human gate** above are user setup items. See those rows for the specific action required.

## Next Phase Readiness

Phase 05 is functionally complete in code. Shippability is gated on the human-only items (6 of 12 checklist rows). Milestone v1.0 cannot be marked complete until items 5, 7, 8, 10, 11, 12 are resolved.

---
*Phase: 05-push-notifications-app-store*
*Completed: 2026-04-15 (reconciled 2026-04-24)*
