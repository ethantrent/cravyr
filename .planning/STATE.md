---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
last_updated: "2026-04-24T17:31:41.857Z"
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
- Apple Sign-In UI placeholder — needs Apple Developer entitlements before wiring

### Open Research Gaps

- Per-user timezone support for push notifications (post-MVP: currently sends at a single UTC hour)

### Blockers

None

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260424-jw8 | fix app icon to 1024x1024 square | 2026-04-24 | cf634c1 | [260424-jw8-fix-app-icon-to-1024x1024-square](./quick/260424-jw8-fix-app-icon-to-1024x1024-square/) |
| 260424-ke6 | scaffold App Store listing copy for Cravyr | 2026-04-24 | 8c1a2a7 | [260424-ke6-scaffold-app-store-listing-copy-for-crav](./quick/260424-ke6-scaffold-app-store-listing-copy-for-crav/) |
| 260424-km4 | production submission runbook + app config validation | 2026-04-24 | 9e2089e | [260424-km4-generate-production-submission-runbook-a](./quick/260424-km4-generate-production-submission-runbook-a/) |
| 260424-kxi | Execute automatable submission runbook steps: Supabase migrations, Render verify, app.config.ts + eas.json fixes | 2026-04-24 | d875507 | [260424-kxi-execute-automatable-submission-runbook-s](./quick/260424-kxi-execute-automatable-submission-runbook-s/) |

## Session Continuity

Last updated: 2026-04-24 — Completed quick task 260424-kxi: automatable submission runbook steps (migrations applied, Render verified, config fixes shipped)
Next action: Human-only remaining steps in SUBMISSION-RUNBOOK.md §1 (Apple Developer), §5 (Apple Developer portal), §6 (App Store Connect — unlocks ascAppId), §7-13

## Human Actions Required

1. ✅ Apply Supabase migrations (quick 260424-kxi — `supabase db push --yes` applied remaining migration; earlier ones already on remote)
2. Configure Apple Developer account and enable "Sign in with Apple" capability
3. Set `ascAppId` in `apps/mobile/eas.json` to real App Store Connect app ID
4. Set `EXPO_TOKEN` secret in GitHub repo for CI builds
5. Create and host a privacy policy page (required for App Store)
6. ✅ App icon sized to 1024×1024 (quick 260424-jw8 — center crop of existing landscape; a designer-supplied high-res source is still recommended before final submission, regenerate via `node apps/mobile/scripts/generate-app-icons.mjs --source <new-source> --mode fit --out-dir apps/mobile/assets --confirm-overwrite`)
7. Run `eas build --platform all --profile production` to verify builds
8. Run `eas submit --platform ios` for TestFlight
9. Capture App Store screenshots
