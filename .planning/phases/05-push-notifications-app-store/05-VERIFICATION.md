---
phase: 05-push-notifications-app-store
verified: 2026-04-24T18:05:00Z
status: human_needed
score: 9/11 must-haves verified (2 device-blocked, pending human verification)
overrides_applied: 0
re_verification:
  previous_status: null
  note: "Initial phase verification after gap-closure plan 05-04 completed"
human_verification:
  - test: "Daily reminder delivery at SEND_HOUR on a physical device"
    expected: "Physical device with granted push permission and a recent save receives 'Tonight's Picks 🍽️' push within ~1h of CRON_SEND_HOUR"
    why_human: "Expo push tokens do not work in simulators; requires physical device, granted permission, and live save data"
    source: "05-UAT Test 5 (blocked), Roadmap SC-1"
  - test: "Push token appears in push_tokens after sign-in on a physical device"
    expected: "Signing in on iOS or Android inserts a row in push_tokens with ExponentPushToken[...] and correct platform"
    why_human: "Physical device + live sign-in required; simulators cannot obtain Expo push tokens"
    source: "05-UAT Test 2 (blocked)"
  - test: "Notification renders app icon + tint color"
    expected: "Delivered push shows ./assets/icon.png and #f97316 (orange) tint, not the generic bell"
    why_human: "Visual rendering on real hardware — cannot be checked statically"
    source: "05-UAT Test 8 (blocked)"
  - test: "Test 7 regression — restart-proof daily reminder"
    expected: "With CRON_SEND_HOUR set to current hour, one user with a push token and save <24h old, start API → observe '[cron] Sending to N token(s)... for YYYY-MM-DD'. Verify push_sends row exists. Kill and restart the process during the same UTC hour → observe '[cron] All eligible users already notified for YYYY-MM-DD' and NO second device notification."
    why_human: "Confirms the 05-04 gap closure end-to-end; requires live Supabase + API process + device"
    source: "05-04-PLAN verification block"
  - test: "EAS production build completes for iOS + Android"
    expected: "eas build --platform all --profile production exits 0 for both platforms; artifacts produced"
    why_human: "Requires EAS token + Apple Developer + Google Play Console credentials; cannot run in this automation"
    source: "Roadmap SC-3"
  - test: "TestFlight external-tester completes full core loop unattended"
    expected: "A non-developer tester installs via TestFlight link, onboards, swipes, saves at least one pick — without guidance"
    why_human: "Human user-acceptance testing; cannot be automated"
    source: "Roadmap SC-4"
  - test: "App Store submission passes initial review"
    expected: "Apple review accepts the submission — no rejection for skeleton MVP, missing Apple Sign-In, missing delete-account, or generic location string"
    why_human: "Apple review is out-of-band; result delivered by App Store Connect"
    source: "Roadmap SC-5"
  - test: "ascAppId populated in eas.json with real App Store Connect app ID"
    expected: "apps/mobile/eas.json submit.production.ios.ascAppId is the real numeric ID, not the placeholder 'YOUR_APP_STORE_CONNECT_ID'"
    why_human: "Requires Apple Developer account + App Store Connect app record; human-gated"
    source: "05-03 checklist row 8, STATE.md Human Actions item 3"
  - test: "Privacy policy URL hosted and referenced in App Store listing"
    expected: "App Store metadata points to a live privacy policy URL (Cravyr /privacy endpoint exists in server.ts at line 58–60 serving public/privacy.html — verify actual content is production-ready)"
    why_human: "Human must write, review legally, and supply URL to Apple"
    source: "05-03 checklist row 5"
  - test: "Apple APNs + Firebase FCM credentials provisioned"
    expected: "eas credentials shows APNs key configured for iOS and FCM server key configured for Android — required for push delivery on release builds"
    why_human: "Interactive EAS CLI + Apple Developer + Firebase Console actions"
    source: "05-03 checklist rows 11, 12"
  - test: "EXPO_TOKEN GitHub repo secret set"
    expected: "Settings → Secrets and variables → Actions has EXPO_TOKEN — without it eas-build.yml will fail on first real run"
    why_human: "Cannot verify without repo admin access"
    source: "05-03 checklist row 10"
  - test: "App icon + 1024x1024 asset verified"
    expected: "./assets/icon.png exists at 1024x1024 per Apple spec"
    why_human: "Requires raster-image inspection tools + production asset review"
    source: "05-03 checklist row 6"
  - test: "App Store screenshots captured"
    expected: "Screenshots for iPhone 6.7\" + 5.5\" (and iPad if supported) uploaded to App Store Connect"
    why_human: "Manual capture on simulators/devices after final UI polish"
    source: "05-03 checklist row 7"
---

# Phase 05: Push Notifications + App Store Submission — Verification Report

**Phase Goal:** Daily 6PM push notifications are live and delivering, EAS builds pass, TestFlight beta is accessible to non-developer testers, and the app is submitted to the App Store without skeleton-MVP rejection.

**Plus:** Test 7 gap closure from 05-04 — restart-proof daily reminder idempotency via Postgres `push_sends` table.

**Verified:** 2026-04-24T18:05:00Z
**Status:** human_needed
**Re-verification:** No — initial verification after gap-closure plan 05-04 completed

## Goal Achievement

### Observable Truths

Score: **9/11 code-verifiable truths** VERIFIED. The remaining 2 (device behavior + App Store outcomes) are human-gated by design.

| #   | Truth                                                                                                                     | Status            | Evidence                                                                                                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `push_tokens` table exists with user_id, expo_push_token, platform, updated_at and RLS enforced                           | ✓ VERIFIED        | `supabase/migrations/20260415100000_push_tokens.sql:5-21` — all columns, `UNIQUE(user_id, platform)`, `ENABLE ROW LEVEL SECURITY`, owner-only policy via `(SELECT auth.uid())`                          |
| 2   | POST /api/v1/notifications/register upserts a push token for the authenticated user (JWT-sourced user_id)                 | ✓ VERIFIED        | `apps/api/src/routes/notifications.ts:25-57` — `requireAuth` gate, `validate(RegisterPushTokenSchema)`, upsert with `onConflict: 'user_id,platform'`; mounted at `server.ts:95`                           |
| 3   | expo-notifications is installed in apps/mobile and configured in app.config.ts                                            | ✓ VERIFIED        | `apps/mobile/package.json:30` — `expo-notifications@~55.0.19`; `app.config.ts:37-43` — plugin registered with icon + #f97316 tint                                                                         |
| 4   | On every authenticated app foreground, the mobile app registers/upserts its Expo push token via the API                   | ✓ VERIFIED        | `_layout.tsx:26-51` defines `registerPushToken()`; `:60-72` fires on getSession + onAuthStateChange; `:78-86` fires on AppState inactive→active transitions                                               |
| 5   | A reinstalled device does not leave stale token records — upsert on (user_id, platform) ensures one token per user/platform | ✓ VERIFIED        | DB `UNIQUE(user_id, platform)` + API `onConflict: 'user_id,platform'` — 05-UAT Test 4 passed via direct DB simulation                                                                                    |
| 6   | Push service sends Expo push notifications given tokens and a message                                                     | ✓ VERIFIED        | `apps/api/src/services/push.ts:16-49` — `sendPushNotifications(tokens, title, body)`, filters via `Expo.isExpoPushToken`, chunks via `expo.chunkPushNotifications`, collects ticket IDs                  |
| 7   | A daily cron fires at SEND_HOUR with 24h save filter; notifications routed to users with unseen Tonight's Picks            | ✓ VERIFIED        | `cron.ts:28-113` — hourly `setInterval`, `SEND_HOUR` env-overridable, filters `saves.saved_at >= now-24h`, sends "Tonight's Picks 🍽️" message                                                             |
| 8   | `eas.json` production profile has autoIncrement + submit config                                                           | ✓ VERIFIED        | `apps/mobile/eas.json:19-24` — `autoIncrement: true`, `EXPO_PUBLIC_API_URL: https://cravyr-api.onrender.com`; submit iOS/Android scaffolded                                                               |
| 9   | GitHub Actions workflow triggers EAS build on main-push filtered to apps/mobile + packages/shared                         | ✓ VERIFIED        | `.github/workflows/eas-build.yml:5-11` path filter correct; `:34-36` runs `eas build --platform all --profile production --non-interactive` in apps/mobile                                                |
| 10  | SC-1: A test user receives a push at ~6PM local time on a physical device                                                 | ? NEEDS HUMAN     | Code path verified end-to-end; physical device required to observe actual delivery                                                                                                                       |
| 11  | **Test 7 — Restart-proof daily reminder** (05-04 gap closure)                                                             | ✓ VERIFIED (code) | `cron.ts` has ZERO `lastSendDate` references (confirmed via grep); upsert into `push_sends` with `ignoreDuplicates: true` and `onConflict: 'user_id,sent_on'` at `:68-74` precedes `sendPushNotifications`; migration `20260424120000_push_sends.sql:9-14` creates table with composite PK and RLS enabled |

**Score:** 9/11 code-verifiable truths VERIFIED, 2 require physical-device human verification (Roadmap SC-1 end-to-end delivery + Test 7 restart-proof reproduction with live data).

### Required Artifacts

| Artifact                                                          | Expected                                                 | Level 1 | Level 2 | Level 3 | Status      | Details                                                                                                                |
| ----------------------------------------------------------------- | -------------------------------------------------------- | ------- | ------- | ------- | ----------- | ---------------------------------------------------------------------------------------------------------------------- |
| `supabase/migrations/20260415100000_push_tokens.sql`              | push_tokens table + RLS + UNIQUE + index                 | ✓       | ✓ 21 L  | ✓       | ✓ VERIFIED  | All 21 lines substantive; referenced by `push.ts` + `notifications.ts` + `cron.ts`                                     |
| `apps/api/src/routes/notifications.ts`                            | POST /register with Zod validation + upsert              | ✓       | ✓ 58 L  | ✓       | ✓ VERIFIED  | Imported + mounted at `server.ts:14,95`                                                                                |
| `apps/mobile/app/_layout.tsx`                                     | Push token registration on foreground                    | ✓       | ✓ 142 L | ✓       | ✓ VERIFIED  | registerPushToken invoked in 3 paths; AppState listener wired                                                          |
| `packages/shared/src/types/push-token.ts`                         | PushToken type                                           | ✓       | ✓ 7 L   | ✓       | ✓ VERIFIED  | Re-exported from `shared/src/index.ts:5`                                                                               |
| `apps/api/src/services/push.ts`                                   | sendPushNotifications + cleanupInvalidTokens             | ✓       | ✓ 103 L | ✓       | ✓ VERIFIED  | `sendPushNotifications` called from `cron.ts:98`; `checkReceiptsAndCleanup` scheduled via `setTimeout` at `cron.ts:106` |
| `apps/api/src/services/cron.ts`                                   | startCronJobs + restart-proof tickDailyReminder          | ✓       | ✓ 130 L | ✓       | ✓ VERIFIED  | `startCronJobs` imported + invoked from `server.ts:15,100`                                                             |
| `apps/mobile/eas.json`                                            | EAS build + submit config                                | ✓       | ✓ 37 L  | —       | ✓ VERIFIED  | Consumed by EAS CLI (contract file — not JS-imported)                                                                  |
| `.github/workflows/eas-build.yml`                                 | CI build pipeline                                        | ✓       | ✓ 36 L  | —       | ✓ VERIFIED  | Consumed by GitHub Actions (contract file — not JS-imported)                                                           |
| `supabase/migrations/20260424120000_push_sends.sql` **(05-04)**   | push_sends dedupe table                                  | ✓       | ✓ 23 L  | ✓       | ✓ VERIFIED  | Referenced by `cron.ts:69` via `.from('push_sends')`                                                                   |

All artifacts pass Levels 1–3. No STUB, MISSING, or ORPHANED.

### Data-Flow Trace (Level 4)

| Artifact                                 | Data Variable           | Source                                                                       | Produces Real Data | Status     |
| ---------------------------------------- | ----------------------- | ---------------------------------------------------------------------------- | ------------------ | ---------- |
| `apps/api/src/services/cron.ts`          | `tokenRows`             | `supabaseAdmin.from('push_tokens').select('expo_push_token, user_id')`       | ✓ (real query)     | ✓ FLOWING  |
| `apps/api/src/services/cron.ts`          | `usersWithSaves`        | `supabaseAdmin.from('saves')...gte('saved_at', now-24h)`                     | ✓ (real query)     | ✓ FLOWING  |
| `apps/api/src/services/cron.ts`          | `claimedRows` (05-04)   | `supabaseAdmin.from('push_sends').upsert(...).select('user_id')`             | ✓ (real atomic claim) | ✓ FLOWING |
| `apps/api/src/services/push.ts`          | `tickets`               | `expo.sendPushNotificationsAsync(chunk)`                                     | ✓ (live Expo API)  | ✓ FLOWING  |
| `apps/api/src/routes/notifications.ts`   | `data`                  | `supabaseAdmin.from('push_tokens').upsert(...).select('id').single()`        | ✓ (real upsert)    | ✓ FLOWING  |
| `apps/mobile/app/_layout.tsx`            | `tokenData.data`        | `Notifications.getExpoPushTokenAsync({ projectId })`                         | ✓ (Expo native)    | ? PARTIAL  |

All data paths produce real data when infrastructure is provisioned. The mobile-side token path is `? PARTIAL` only because actual delivery requires a physical device (simulators return null) — this is a human-verification concern, not a code defect.

### Key Link Verification

| From                                                | To                                                  | Via                                                               | Status      | Details                                                                                                               |
| --------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------- |
| `apps/mobile/app/_layout.tsx`                       | `apps/api/src/routes/notifications.ts`              | `fetch('${API_URL}/api/v1/notifications/register', POST)`         | ✓ WIRED     | `_layout.tsx:37-47` with Bearer token + `{expo_push_token, platform}` body                                            |
| `apps/api/src/routes/notifications.ts`              | `push_tokens` table                                 | `supabase.from('push_tokens').upsert(...)`                        | ✓ WIRED     | `notifications.ts:37-49`                                                                                              |
| `apps/api/src/services/cron.ts`                     | `apps/api/src/services/push.ts`                     | `sendPushNotifications(tokens, title, body)`                      | ✓ WIRED     | `cron.ts:98-102`                                                                                                      |
| `apps/api/src/services/cron.ts`                     | `push_tokens` + `saves` tables                      | Supabase queries at `cron.ts:39,51`                               | ✓ WIRED     | Chained to filter by recent-saves                                                                                     |
| `apps/api/src/services/cron.ts` **(05-04)**         | `push_sends` table                                  | `upsert(...).select('user_id')` with `ignoreDuplicates:true`      | ✓ WIRED     | `cron.ts:68-74` — exact pattern required by 05-04 plan Task 2                                                          |
| `apps/api/src/services/cron.ts` **(05-04 regression)** | **(in-memory `lastSendDate` guard)**             | **DELETED**                                                       | ✓ REMOVED   | Grep for `lastSendDate` in cron.ts → zero matches. Module-level `let` is gone. DB-only dedupe.                        |
| `.github/workflows/eas-build.yml`                   | `apps/mobile/eas.json`                              | `eas build --platform all --profile production --non-interactive` | ✓ WIRED     | `eas-build.yml:34-36`                                                                                                 |
| `apps/api/src/server.ts`                            | `apps/api/src/services/cron.ts`                     | `startCronJobs()` after `app.listen()`                            | ✓ WIRED     | `server.ts:15,100`                                                                                                    |

All key links VERIFIED. The critical 05-04 wiring — DB-level dedupe replacing in-memory state — is correct both additively (upsert present) and subtractively (`lastSendDate` removed).

### Behavioral Spot-Checks

| Behavior                                                           | Command                                                                             | Result                                                           | Status |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------ |
| `push_sends` migration contains composite PK + RLS                 | `grep -E "PRIMARY KEY \(user_id, sent_on\)\|ENABLE ROW LEVEL SECURITY" migration`   | Both lines present at `push_sends.sql:13,18`                     | ✓ PASS |
| `cron.ts` no longer contains `lastSendDate` literal (05-04 Ed. 1)  | `grep "lastSendDate" cron.ts`                                                       | Zero matches                                                     | ✓ PASS |
| `cron.ts` contains required upsert pattern (05-04 Ed. 3)           | `grep -E "ignoreDuplicates\|onConflict: 'user_id,sent_on'" cron.ts`                 | Both present at `cron.ts:72`                                     | ✓ PASS |
| `currentHour !== SEND_HOUR` early-return preserved (05-04 guard)   | `grep "currentHour !== SEND_HOUR" cron.ts`                                          | Present at `cron.ts:33`                                          | ✓ PASS |
| Startup tick in `startCronJobs()` preserved (05-04 safety net)     | `grep -A1 "Also check immediately" cron.ts`                                         | `tickDailyReminder().catch(console.error);` at `cron.ts:129`     | ✓ PASS |
| Upsert into push_sends precedes sendPushNotifications (05-04 ordering) | Line-number check: upsert at `:68`, send at `:98`                                | 30-line gap, send strictly later                                 | ✓ PASS |
| Two 05-04 commits present on main                                   | `git log --oneline`                                                                 | `0efa24f feat(05-04)` + `ad8e868 fix(05-04)` both present        | ✓ PASS |
| `expo-server-sdk` installed in apps/api                             | `grep expo-server-sdk apps/api/package.json`                                        | `"expo-server-sdk": "^6.1.0"`                                    | ✓ PASS |
| `expo-notifications` installed in apps/mobile                       | `grep expo-notifications apps/mobile/package.json`                                  | `"expo-notifications": "~55.0.19"`                               | ✓ PASS |
| API server mounts notifications router                              | `grep notifications server.ts`                                                      | Imported at `:14`, mounted at `:95`                              | ✓ PASS |
| EAS workflow path filter includes apps/mobile + packages/shared     | `grep -A3 paths: eas-build.yml`                                                     | Both paths present                                               | ✓ PASS |

All 11 code-level spot-checks PASS. End-to-end push delivery (Test 5), token registration from a signed-in device (Test 2), notification visual rendering (Test 8) — require physical hardware and are routed to human verification.

### Requirements Coverage

**Note:** `.planning/REQUIREMENTS.md` does not exist in this project. Requirements are tracked via `requirements:` fields in PLAN frontmatter and Phase-level `Requirements: NOTIF-01` in ROADMAP.md. Verification maps requirement IDs to roadmap Success Criteria instead.

| Requirement | Source Plan(s)                  | Description (inferred from roadmap)                                                                       | Status       | Evidence                                                                          |
| ----------- | ------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------ | --------------------------------------------------------------------------------- |
| NOTIF-01    | 05-01, 05-02, 05-03, 05-04      | Push notification infrastructure: token registration, sending service, daily reminder cron, restart-proof | ✓ SATISFIED (code) | Truths 1–7, 11 all verified; all SUMMARYs list `requirements-completed: [NOTIF-01]` |
| INFRA-01    | 05-03                           | Infrastructure baseline (EAS + CI)                                                                        | ✓ SATISFIED (code) | Truths 8–9 verified. Note: INFRA-01 is primarily owned by Phase 1; 05-03 only claims the CI slice |

**Orphaned requirements check:** Phase 5 roadmap section lists only `Requirements: NOTIF-01`. INFRA-01 appears in 05-03 plan but not in the phase's roadmap line — this is a plan-level addition, not an orphan.

### Anti-Patterns Found

| File                                    | Line | Pattern                                       | Severity | Impact                                                                                                                                                                                  |
| --------------------------------------- | ---- | --------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/mobile/eas.json`                  | 29   | `"ascAppId": "YOUR_APP_STORE_CONNECT_ID"`     | ⚠️ Warning | Placeholder — documented in 05-03 SUMMARY as human-gate. Not a code defect; blocks actual iOS submit but not the build step. Flagged in human_verification.                            |
| `apps/api/src/services/push.ts`         | 72-74 | Comment: "We don't have the token from the receipt, so we'll handle cleanup at the DB level during the next send cycle" | ℹ️ Info | Receipt-to-token correlation not implemented; `invalidTokens` stays empty. Explicitly documented as post-MVP gap in 05-02 SUMMARY "Issues Encountered". Does not block SC-1. |

No blocker anti-patterns. No TODO/FIXME in the code modified by this phase. No empty handlers. No hardcoded-empty-data that flows to render.

### Human Verification Required

See YAML frontmatter `human_verification:` block. Summary:

1. **Daily reminder delivery** (Roadmap SC-1) — requires physical device with granted push permission + live save data
2. **Push token registers on sign-in** (UAT Test 2) — physical device required (Expo push tokens not available in simulators)
3. **Notification icon + color rendering** (UAT Test 8) — visual check on hardware
4. **Test 7 restart-proof reproduction** — live Supabase + API restart during SEND_HOUR to confirm '[cron] All eligible users already notified' log and no second device notification
5. **EAS production build** (Roadmap SC-3) — requires EAS credentials + Apple/Google accounts
6. **TestFlight external-tester loop** (Roadmap SC-4) — human user-acceptance testing
7. **App Store submission passes review** (Roadmap SC-5) — out-of-band Apple review
8. **ascAppId populated with real ID** — human App Store Connect setup
9. **Privacy policy URL supplied to Apple** — /privacy endpoint already exists, content review required
10. **APNs + FCM credentials** — `eas credentials` interactive
11. **EXPO_TOKEN repo secret** — GitHub repo admin action
12. **App icon 1024×1024 verified** — asset spec check
13. **App Store screenshots captured**

### Gaps Summary

**No code gaps.** All code-verifiable must-haves — including the 05-04 gap closure on Test 7 — are satisfied:

- 05-04 Task 1 (push_sends migration): ✓ file exists with PRIMARY KEY (user_id, sent_on) + ENABLE ROW LEVEL SECURITY + CASCADE delete, no CREATE POLICY (service-role-only as intended)
- 05-04 Task 2 (cron.ts refactor): ✓ `lastSendDate` deleted (grep: 0 matches), upsert with `ignoreDuplicates: true` and `onConflict: 'user_id,sent_on'` on line 68–74, `.select('user_id')` filters tokens at line 88–90, `currentHour !== SEND_HOUR` short-circuit at line 33 preserved, startup tick at line 129 preserved
- Commits 0efa24f (migration) and ad8e868 (cron fix) both on main

**Human-gated outcomes** (Roadmap SC-1, SC-3, SC-4, SC-5 + 3 device-blocked UAT tests + 7 App-Store-Connect / credentials / asset items) remain — these are structural to phase 05's goal (ship to App Store) and cannot be closed by code alone. They are correctly captured in `human_verification` rather than `gaps`.

**Status decision tree:** all code truths pass → no `gaps_found`. Human verification items present → status is `human_needed`, not `passed`.

---

_Verified: 2026-04-24T18:05:00Z_
_Verifier: Claude (gsd-verifier)_
