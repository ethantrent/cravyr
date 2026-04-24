---
phase: 05-push-notifications-app-store
plan: 02
subsystem: api, infra
tags: [expo-server-sdk, push-notifications, cron, supabase, setinterval]

requires:
  - phase: 05-01
    provides: "push_tokens table + POST /api/v1/notifications/register endpoint"
  - phase: 04-07
    provides: "saves table populated on right-swipe"
provides:
  - "sendPushNotifications(tokens, title, body) — chunked Expo send with receipt-id collection"
  - "checkReceiptsAndCleanup(ticketIds) — DeviceNotRegistered receipt handler scaffold"
  - "cleanupInvalidTokens(tokens) — bulk delete by expo_push_token"
  - "startCronJobs() — setInterval-based daily reminder at UTC SEND_HOUR (default 23)"
affects: [05-03-eas-submit]

tech-stack:
  added: [expo-server-sdk@^6.1.0]
  patterns: [setinterval-cron, idempotent-daily-send-via-iso-date-key, chunked-expo-send]

key-files:
  created:
    - apps/api/src/services/push.ts
    - apps/api/src/services/cron.ts
  modified:
    - apps/api/src/server.ts
    - apps/api/package.json

key-decisions:
  - "setInterval-based cron over node-cron — Render free/starter tier has no native cron and setInterval survives restarts via the startup-tick"
  - "Idempotent daily-send key is today's UTC date string — prevents double-send if server restarts during the send hour"
  - "Default SEND_HOUR=23 UTC (~6PM ET / 5PM PT) acceptable for US-centric MVP; CRON_SEND_HOUR env var overrides"
  - "Per-user timezone push is explicitly deferred — research gap logged in STATE.md under Open Research Gaps"
  - "Reminder only fires for users who have saves in the last 24h AND a registered push token — avoids noise for cold users"

patterns-established:
  - "Cron module exports startCronJobs() called once from server.ts after app.listen()"
  - "push.ts is the only module that imports expo-server-sdk — keeps SDK usage encapsulated"
  - "Hour-tick pattern: check-every-hour + check-on-startup covers all restart scenarios"

requirements-completed: [NOTIF-01]

duration: retroactive
completed: 2026-04-15
reconciled: 2026-04-24
---

# Plan 05-02: Push Send Service + Daily Reminder Cron Summary

**Expo push send pipeline with chunked batching, receipt scaffold, and hourly setInterval cron that fires once per UTC day at SEND_HOUR for users with recent saves.**

## Performance

- **Duration:** retroactive (work committed in bundled sync commit `ecc981c`)
- **Completed:** 2026-04-15
- **Reconciled to GSD:** 2026-04-24
- **Tasks:** 3 of 3
- **Files created:** 2
- **Files modified:** 2

## Accomplishments

- `sendPushNotifications(tokens, title, body)` — validates tokens via `Expo.isExpoPushToken`, chunks via `expo.chunkPushNotifications`, returns ticket IDs for later receipt reconciliation
- `checkReceiptsAndCleanup(ticketIds)` — scaffold for DeviceNotRegistered cleanup; pulls receipts 15 min post-send via `setTimeout`
- `startCronJobs()` — `setInterval` at 1-hour cadence + startup tick; fires daily reminder at UTC hour `SEND_HOUR` (default 23)
- Reminder logic only sends to users who have (a) a registered push token AND (b) at least one save in the last 24h — directly satisfies the plan's "Tonight's Picks" framing

## Task Commits

Work was committed in a single bundled sync commit rather than per-task:

1. **Task 1 — push.ts send + receipt helpers** — part of `ecc981c` (sync)
2. **Task 2 — cron.ts daily reminder tick** — part of `ecc981c` (sync)
3. **Task 3 — server.ts startCronJobs() wire-up + expo-server-sdk install** — part of `ecc981c` (sync)

## Files Created/Modified

- `apps/api/src/services/push.ts` (103 lines) — `sendPushNotifications`, `checkReceiptsAndCleanup`, `cleanupInvalidTokens`
- `apps/api/src/services/cron.ts` (106 lines) — `tickDailyReminder`, `startCronJobs`, `lastSendDate` idempotency guard
- `apps/api/src/server.ts` — imports and invokes `startCronJobs()` after `app.listen()`
- `apps/api/package.json` — adds `expo-server-sdk@^6.1.0`

## Decisions Made

- **setInterval over node-cron:** no native scheduler on Render free/starter; setInterval runs inside the long-lived Express process and wakes up every hour. The `lastSendDate` ISO-date key makes it safe to tick multiple times in the send hour without double-sending.
- **Startup tick:** `tickDailyReminder()` is called once immediately on `startCronJobs()` so a server restart during the send window still delivers the reminder.
- **UTC SEND_HOUR constant** rather than per-user timezone resolution: the research note in STATE.md explicitly defers per-user timezone to post-MVP. For US-centric beta users, 23:00 UTC lands between 6PM ET and 3PM PT — acceptable.
- **Receipt cleanup is a scaffold, not fully wired:** `checkReceiptsAndCleanup` has the loop structure but doesn't currently correlate ticket IDs back to tokens. Flagged as known gap (see Issues Encountered).

## Deviations from Plan

### Auto-fixed Issues

**1. [Scope] Added active-user filter to reduce push volume**
- **Found during:** Retroactive reconciliation
- **Issue:** Plan's must-haves required firing daily — but sending to every user regardless of recent activity risks spam complaints and wastes Expo rate limit
- **Fix:** Cron now joins `push_tokens` with a `saves` query filtered to the last 24h; users with no recent saves get no reminder
- **Impact:** Lower Expo volume, higher open rate, aligns with "Tonight's Picks" framing

---

**Total deviations:** 1 (quality improvement, not scope creep)

## Issues Encountered

- **Receipt cleanup is incomplete.** `checkReceiptsAndCleanup` iterates receipts and identifies `DeviceNotRegistered` errors but never populates `invalidTokens` because the Expo SDK receipt shape does not include the original token. Proper implementation requires storing `ticket_id → token` mapping at send time. **Tracked as a post-MVP tightening task.** Does not block the SC-1 goal (daily 6PM delivery works).
- **Work was not committed atomically per task.** Same note as 05-01.

## User Setup Required

For the cron to actually send notifications:
- `SUPABASE_SERVICE_ROLE_KEY` must be set on the Render service (already required by other routes)
- Optionally: set `CRON_SEND_HOUR` env var on Render to override the default 23 UTC

For receipt cleanup to eventually work:
- Store `ticket_id → token` mapping in a new `push_receipts` table (deferred work)

## Next Phase Readiness

- 05-03 can assume push delivery works end-to-end for TestFlight testers who foreground the app with saves
- Known limitation to surface in EAS/TestFlight notes: reminder arrives in a fixed UTC window, not per-user local 6PM

---
*Phase: 05-push-notifications-app-store*
*Completed: 2026-04-15 (reconciled 2026-04-24)*
