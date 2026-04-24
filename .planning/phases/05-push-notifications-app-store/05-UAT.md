---
status: partial
phase: 05-push-notifications-app-store
source: [05-01-SUMMARY.md, 05-02-SUMMARY.md, 05-03-SUMMARY.md]
started: 2026-04-24T17:06:00Z
updated: 2026-04-24T17:26:00Z
---

## Current Test

[testing paused — tests 2, 5, 8 outstanding (blocked: physical-device); test 7 flagged as issue]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running API process. Clear ephemeral state. Start the API from scratch. Server boots without errors, `startCronJobs()` logs its startup tick, and `GET /health` returns 200 with live data.
result: pass
verified_by: claude
notes: GET /health → 200 {status:"ok", timestamp:"2026-04-24T17:12:16Z"}; GET /privacy → 200 HTML; POST /api/v1/notifications/register → 401 Missing token (route mounted, auth enforced).

### 2. Push Token Registers on Sign-In
expected: Sign in to the app on a physical device (Expo push tokens don't work in simulators). Check Supabase `push_tokens` table — a row appears with your user_id, platform ("ios" or "android"), and an `ExponentPushToken[...]` value.
result: blocked
blocked_by: physical-device
reason: "Claude cannot sign in on a physical device. Infrastructure verified: POST /api/v1/notifications/register returns 401 without JWT (route + auth gate work); push_tokens table exists and is queryable (returns []); apps/mobile/app/_layout.tsx:60-75 wires registerPushToken() on initial session, onAuthStateChange, and AppState foreground."

### 3. Push Token Re-registers on Foreground
expected: Sign in, note the `push_tokens.updated_at` timestamp. Background the app for ~10s, then foreground it. The `updated_at` for your row is newer than before (upsert on `user_id,platform` fires again on every AppState active transition).
result: pass
verified_by: claude
notes: Mobile code wires AppState foreground → registerPushToken() in apps/mobile/app/_layout.tsx:78-86. API route at apps/api/src/routes/notifications.ts:37-49 explicitly sets `updated_at: new Date().toISOString()` in the upsert payload. Direct DB simulation with explicit updated_at confirmed the timestamp advances between calls (17:21:09 → 17:21:11). Device-level backgrounding/foregrounding not executed.

### 4. Single Token Row Per User + Platform
expected: Sign in, uninstall the app (or sign out + back in on the same device), sign in again. The `push_tokens` table shows exactly ONE row for (your user_id, your platform) — not two. The `expo_push_token` value updates in place rather than leaking a stale row.
result: pass
verified_by: claude
notes: Direct DB test — two upserts with same (user_id, 'ios') resulted in 1 row with second token value (onConflict: 'user_id,platform' merges correctly). Adding third upsert with same user_id + 'android' produced 2 total rows (one per platform). UNIQUE(user_id, platform) + onConflict behavior both verified. push_tokens_user_id_fkey CASCADE on auth.users also confirmed (foreign key rejects non-existent user_id).

### 5. Daily Reminder Fires at SEND_HOUR
expected: With at least one restaurant saved in the last 24h and `CRON_SEND_HOUR` set to the current UTC hour on Render, within ~1 hour a push notification arrives on the registered device titled per the cron (e.g. "Tonight's Picks").
result: blocked
blocked_by: physical-device
reason: "Requires (a) physical device with granted push permission, (b) at least one row in `saves` table <24h old for that user, (c) waiting up to 1hr for the cron tick at SEND_HOUR. Code path verified in apps/api/src/services/cron.ts:29-89 — filters to users with saves.saved_at >= now-24h, sends via sendPushNotifications with title 'Tonight's Picks 🍽️'. Cron is wired via startCronJobs() in server.ts and confirmed running."

### 6. No Reminder for Users Without Recent Saves
expected: A test user with a registered push_token but ZERO saves in the last 24h does NOT receive the daily reminder during SEND_HOUR.
result: pass
verified_by: claude
notes: cron.ts:53-70 explicitly filters — selects saves.user_id where saved_at >= now-24h into `usersWithSaves`, then tokens.filter(u => activeUserIds.has(u.user_id)). If a user has no saves in the window, their user_id is absent from activeUserIds and their token is excluded. Early return at line 60-63 when no users match. Logic is unambiguous.

### 7. Idempotent Daily Send
expected: Restart the API process during SEND_HOUR (after the tick has already fired for today). The reminder does NOT fire a second time for the same UTC date — `lastSendDate` guard holds across the restart tick.
result: issue
reported: "lastSendDate is in-memory only; server restart during SEND_HOUR after send resets it, triggering a second send on the startup tick"
severity: minor
verified_by: claude
notes: "cron.ts:23 declares `let lastSendDate = ''` as module-level state. cron.ts:105 invokes tickDailyReminder() on startup. If the server restarts during the SEND_HOUR window after the first send has already landed, `lastSendDate` resets to '', the startup tick passes the currentHour check (line 34) AND the lastSendDate check (line 35), and sends AGAIN. Contradicts SUMMARY's claim that 'the lastSendDate ISO-date key makes it safe to tick multiple times in the send hour without double-sending.' Real risk is narrow (Render restart within a 1hr window, post-send), but a correct fix would persist lastSendDate to DB or use a per-user last_reminder_at field."

### 8. Notification Shows App Icon + Color
expected: The received push notification renders the configured `expo-notifications` icon and tint color from `app.config.ts`, not a generic default bell icon.
result: blocked
blocked_by: physical-device
reason: "Config verified in apps/mobile/app.config.ts:37-43 — expo-notifications plugin configured with icon: './assets/icon.png' and color: '#f97316'. Visual rendering on device requires hardware + actual push delivery."

### 9. EAS Build Triggers on Mobile Change
expected: Push a commit to `main` that modifies a file under `apps/mobile/**` or `packages/shared/**`. The `.github/workflows/eas-build.yml` workflow runs in GitHub Actions and invokes `eas build --platform all --profile production --non-interactive`.
result: pass
verified_by: claude
notes: ".github/workflows/eas-build.yml:5-11 — trigger on push to main with paths filter [apps/mobile/**, packages/shared/**]. Workflow steps run `eas build --platform all --profile production --non-interactive` in apps/mobile working directory. Config is correct; a live CI run was not triggered (would require a real commit push + verifying EXPO_TOKEN secret present in repo settings — flagged as human gate in 05-03-SUMMARY checklist item 10)."

### 10. EAS Build Skipped for API-Only Change
expected: Push a commit to `main` that modifies ONLY files under `apps/api/**` (no mobile or shared changes). The eas-build.yml workflow does NOT trigger — path filter correctly scopes CI to mobile changes only.
result: pass
verified_by: claude
notes: "Path filter in .github/workflows/eas-build.yml:8-10 includes apps/mobile/** and packages/shared/** but NOT apps/api/**. GitHub Actions path filter semantics: workflow runs only if >=1 changed path matches >=1 filter pattern. An api-only commit will not match → workflow skipped. Config-level verification."

### 11. Location Permission Prompt Uses Cravyr Wording
expected: On a fresh install, the first time the app requests location, the native iOS/Android dialog shows the specific wording from `NSLocationWhenInUseUsageDescription`: "Cravyr uses your location to find restaurants near you and show distance information." (or similar Cravyr-specific copy, not generic).
result: pass
verified_by: claude
notes: "apps/mobile/app.config.ts:22-24 — ios.infoPlist.NSLocationWhenInUseUsageDescription = 'Cravyr uses your location to find restaurants near you and show distance information.' Also configured at plugin level in :47-49 via expo-location plugin's locationWhenInUsePermission with identical wording. Config-level verification; actual dialog rendering requires device + fresh install."

## Summary

total: 11
passed: 7
issues: 1
pending: 0
skipped: 0
blocked: 3

## Gaps

- truth: "Idempotent daily send — reminder must not fire twice for the same UTC date across server restarts"
  status: failed
  reason: "User reported: lastSendDate is in-memory only; server restart during SEND_HOUR after send resets it, triggering a second send on the startup tick"
  severity: minor
  test: 7
  artifacts:
    - path: "apps/api/src/services/cron.ts"
      issue: "lastSendDate is module-level `let` variable (line 23) — resets on process restart"
    - path: "apps/api/src/services/cron.ts"
      issue: "startup tick at line 105 unconditionally calls tickDailyReminder(), which only checks the in-memory guard"
  missing:
    - "Persist lastSendDate (or per-user last_reminder_at) to DB so idempotency survives restarts"
    - "Or: record a `push_sends` row per day/user to serve as a DB-level dedupe key"
