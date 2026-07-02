---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
last_updated: "2026-07-02T00:00:00.000Z"
progress:
  total_phases: 5
  completed_phases: 4
  total_plans: 20
  completed_plans: 19
  percent: 95
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-06)

**Core value:** 60fps swipe feel — because a janky swipe kills the product before the user finds a restaurant they love
**Current focus:** Phase 05 — push-notifications-app-store

## Current Position

Phase: 05 (push-notifications-app-store) — EXECUTING
Plan: 1 of 4
**Milestone:** 1 — MVP
**Next phase:** None — all 5 phases complete
**Status:** Executing Phase 05
**Progress:** ██████████ 100% (5 of 5 phases complete)

## Accumulated Context

### Key Decisions

- rn-swiper-list 3.0.0 requires react-native-worklets 0.7.2 (resolved — installed in apps/mobile)
- Use geography(Point) not geometry for PostGIS location column
- Expo SDK 55 (not 52 as originally researched)
- Reanimated v4 (not v3 as originally assumed)
- Express v5 (async error propagation — no try/catch needed in route handlers)
- Zustand v5
- FIELD_MASK_NEARBY excludes priceLevel (keeps Nearby Search on Pro tier, 5,000 free/month vs 1,000 Enterprise)
- upsert_restaurant RPC requires SET search_path TO 'public', 'extensions' for ST_MakePoint to resolve
- New Architecture enabled for react-native-worklets compatibility
- Apple Sign-In fully wired (onboarding/index.tsx: signInWithIdToken + first-sign-in fullName capture) — Apple Developer entitlement (capability on the App ID) still required before it works on device
- Social features (friends/connections, group matches, travel mode) shipped 2026-06-28 in fd2a683/de2eca5 — outside the original MVP roadmap; privacy policy updated 2026-07-02 (quick 260702-pv1); migrations 20260710/20260720 still need `supabase db push` to production

### Open Research Gaps

- ~~Per-user timezone support for push notifications~~ — resolved 2026-06-21 (commit 3a6a17e + migration 20260621000000_push_token_timezone.sql)

### Blockers

None

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260424-jw8 | fix app icon to 1024x1024 square | 2026-04-24 | cf634c1 | [260424-jw8-fix-app-icon-to-1024x1024-square](./quick/260424-jw8-fix-app-icon-to-1024x1024-square/) |
| 260424-ke6 | scaffold App Store listing copy for Cravyr | 2026-04-24 | 8c1a2a7 | [260424-ke6-scaffold-app-store-listing-copy-for-crav](./quick/260424-ke6-scaffold-app-store-listing-copy-for-crav/) |
| 260424-km4 | production submission runbook + app config validation | 2026-04-24 | 9e2089e | [260424-km4-generate-production-submission-runbook-a](./quick/260424-km4-generate-production-submission-runbook-a/) |
| 260424-kxi | Execute automatable submission runbook steps: Supabase migrations, Render verify, app.config.ts + eas.json fixes | 2026-04-24 | d875507 | [260424-kxi-execute-automatable-submission-runbook-s](./quick/260424-kxi-execute-automatable-submission-runbook-s/) |
| 260702-pv1 | Update privacy policy + App Privacy declarations for social features (friends/connections/matches) | 2026-07-02 | d40ee42 | [260702-pv1-update-privacy-policy-social-features](./quick/260702-pv1-update-privacy-policy-social-features/) |

## Session Continuity

Last updated: 2026-07-02 — Completed quick task 260702-pv1: privacy policy + App Privacy declarations updated for the June social features (friends/connections/group matches). GSD tooling migrated to @opengsd/gsd-core 1.6.1 (project-local install).
Next action: apply social-feature migrations (20260710, 20260720) to production Supabase, then human-only steps in SUBMISSION-RUNBOOK.md §1 (Apple Developer), §5 (portal), §6 (App Store Connect — unlocks ascAppId), §7-13

## Human Actions Required

1. ✅ Apply Supabase migrations (quick 260424-kxi — `supabase db push --yes` applied remaining migration; earlier ones already on remote)
2. Configure Apple Developer account and enable "Sign in with Apple" capability
3. Set `ascAppId` in `apps/mobile/eas.json` to real App Store Connect app ID
4. Set `EXPO_TOKEN` secret in GitHub repo for CI builds
5. Privacy policy page ✅ written (apps/api/src/public/privacy.html, updated 2026-07-02 for social features) — still needs a Render deploy (`git push origin main`) so https://cravyr-api.onrender.com/privacy serves the new copy
6. ✅ App icon sized to 1024×1024 (quick 260424-jw8 — center crop of existing landscape; a designer-supplied high-res source is still recommended before final submission, regenerate via `node apps/mobile/scripts/generate-app-icons.mjs --source <new-source> --mode fit --out-dir apps/mobile/assets --confirm-overwrite`)
7. Run `eas build --platform all --profile production` to verify builds
8. Run `eas submit --platform ios` for TestFlight
9. Capture App Store screenshots
