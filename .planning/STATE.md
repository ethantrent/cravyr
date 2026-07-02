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
- Social features (friends/connections, group matches, travel mode) shipped 2026-06-28 in fd2a683/de2eca5 — outside the original MVP roadmap; privacy policy updated 2026-07-02 (quick 260702-pv1); migrations 20260710/20260720 confirmed applied to remote (verified via `supabase migration list` 2026-07-02)
- Render free-tier cold-start (25–60s on the first request after 15 min idle) is an ACCEPTED known limitation — the user deliberately keeps render.yaml `plan: free` and 800px photo widths (maxWidthPx) as-is; UptimeRobot / paid Render Starter upgrade explicitly deferred (quick 260702-dpv)
- DB-size CI guard (quick 260702-dpv): the supabase-keepalive workflow now fails above ~400MB (419430400 bytes) so GitHub emails on approach to the 500MB free-tier read-only cap (Pitfall 8); migration 20260702000000_database_size_rpc.sql applied to remote 2026-07-02, guard verified green in CI
- Supabase keepalive had silently failed every scheduled run since 2026-06-07: (a) Supabase stopped serving the /rest/v1/ OpenAPI root with query-param auth (fixed 87d3ece — ping now header-auths a real `restaurants?select=id&limit=1` query, which is what the auto-pause policy actually counts), and (b) the SUPABASE_URL/SUPABASE_ANON_KEY GitHub secrets set 2026-04-12 were stale — reset 2026-07-02 to current project values

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
| 260702-st1 | Fix social-route auth bug (res.locals.user 500s) + 3-digit invite codes; 14 authenticated integration tests | 2026-07-02 | 66b7326 | [260702-st1-fix-social-auth-bug-add-endpoint-tests](./quick/260702-st1-fix-social-auth-bug-add-endpoint-tests/) |
| 260702-da1 | Deploy-failure alarm: GET /version + deploy-verify workflow; also fixed CI pnpm setup broken since 8e38d19 | 2026-07-02 | c239994 | [260702-da1-deploy-verification-alarm](./quick/260702-da1-deploy-verification-alarm/) |
| 260702-dpv | PITFALLS.md open items: DB-size CI guard (RPC + keepalive workflow), billing-alert human action, cold-start accepted-risk decision | 2026-07-02 | 59523e9 | [260702-dpv-address-pitfalls-md-open-items-db-size-c](./quick/260702-dpv-address-pitfalls-md-open-items-db-size-c/) |

## Session Continuity

Last activity: 2026-07-02 — Completed quick task 260702-dpv: PITFALLS.md open items (DB-size CI guard, billing-alert human action, cold-start accepted risk).
Last updated: 2026-07-02 — Quick tasks pv1 (privacy), st1 (social auth bug + tests), da1 (deploy alarm) complete. Found+fixed: Render deploys silently failing since 2026-06-28 (stale lockfile, 652b7ff), CI silently failing since 8e38d19 (pnpm action-setup conflict, 3bf503a), social routes 500ing on every authed call (res.locals.user, 66b7326), unredeemable 3-digit invite codes (66b7326). PROJECT.md requirements marked implemented; SOCIAL-01/02 + TRAVEL-01 registered. GSD tooling migrated to @opengsd/gsd-core 1.6.1.
Next action: human-only steps in SUBMISSION-RUNBOOK.md §1 (Apple Developer enrollment — 24-48h bottleneck, start first), §5 (portal), §6 (App Store Connect — unlocks ascAppId), §7-13. All migrations applied.
✅ RENDER DEPLOYS FIXED 2026-07-02 (0f3e930) after being broken since ~April 24: root cause was NODE_ENV=production in render.yaml envVars applying at BUILD time — pnpm skipped devDependencies, tsc failed on missing @types/* (exit 2). The stale lockfile (652b7ff) was a second, earlier layer (exit 1). Fix: `pnpm install --frozen-lockfile --prod=false`. Verified live: /version reports 0f3e930, deploy-verify run 28620011245 green.

## Human Actions Required

1. ✅ Apply Supabase migrations (quick 260424-kxi — `supabase db push --yes` applied remaining migration; earlier ones already on remote)
2. Configure Apple Developer account and enable "Sign in with Apple" capability
3. Set `ascAppId` in `apps/mobile/eas.json` to real App Store Connect app ID
4. Set `EXPO_TOKEN` secret in GitHub repo for CI builds
5. ✅ Privacy policy live (verified 2026-07-02: https://cravyr-api.onrender.com/privacy shows "Last updated: July 2, 2026" with social-features copy, after Render deploy fix 0f3e930)
6. ✅ App icon sized to 1024×1024 (quick 260424-jw8 — center crop of existing landscape; a designer-supplied high-res source is still recommended before final submission, regenerate via `node apps/mobile/scripts/generate-app-icons.mjs --source <new-source> --mode fit --out-dir apps/mobile/assets --confirm-overwrite`)
7. Run `eas build --platform all --profile production` to verify builds
8. Run `eas submit --platform ios` for TestFlight
9. Capture App Store screenshots
10. ✅ Google Cloud cost guards set up 2026-07-02 via gcloud CLI (project eminent-bond-467116-h6): (a) $100/month budget "Cravyr Places API cost guard" with 25/50/90/100% email alerts (budget 41ebdfc6-a246-442f-83b6-b42fdbeccac3); (b) hard daily quota caps on Places API (New) — SearchNearby/GetPlace/Autocomplete 1,000/day, GetPhotoMedia 2,000/day, unused endpoints 100/day; (c) API key restricted from the 33-service Maps Platform bundle down to places.googleapis.com only.
11. ✅ Apply migration 20260702000000_database_size_rpc.sql (`pnpm exec supabase db push --yes --include-all`, 2026-07-02) — DB-size guard verified live in CI: run 28615606565 reported ~19 MB, passed.
