---
phase: 05-push-notifications-app-store
plan: 04
subsystem: notifications
tags: [cron, supabase, postgres, dedupe, idempotency, push-notifications, rls]

requires:
  - phase: 05-push-notifications-app-store
    provides: "push_tokens table, expo-server-sdk wiring, hourly tickDailyReminder cron"
provides:
  - "push_sends (user_id, sent_on) dedupe table — restart-proof per-user per-UTC-day idempotency key"
  - "cron.ts that inserts-then-sends: DB-level conflict handling is the atomic arbiter, no in-memory state"
  - "Observable 'All eligible users already notified' log signal that proves Test 7 passes"
affects: [push-notifications, per-user-timezone-support, future-notification-types]

tech-stack:
  added: []
  patterns:
    - "Insert-before-send idempotency: upsert with ignoreDuplicates:true and return only newly-inserted rows"
    - "Service-role-only tables: RLS enabled with NO policies — admin writes, authed reads/writes blocked by default"

key-files:
  created:
    - "supabase/migrations/20260424120000_push_sends.sql"
  modified:
    - "apps/api/src/services/cron.ts"

key-decisions:
  - "Per-user DB dedupe (Option 2) chosen over a single lastSendDate row (Option 1) — restart-proof AND extends cleanly to the per-user-timezone Open Research Gap without migration"
  - "Insert precedes send: a crash after insert-success/before-send-complete loses at most one notification (safe-miss); the inverted ordering would re-send on restart (the Test 7 failure)"
  - "Upsert with ignoreDuplicates:true rather than insert-then-check — Postgres' conflict handling is atomic, a pre-select introduces the same TOCTOU race as the broken in-memory guard"
  - "Startup tick in startCronJobs() preserved — with DB-level dedupe it is now genuinely safe, and it remains the safety net for the case where the server restarts DURING the send hour before any send has landed"

patterns-established:
  - "Pattern: cron idempotency via (entity_id, date) upsert — next notification type (e.g. 'closing soon') should reuse the same shape with its own dedupe table"
  - "Pattern: service-role-only tables enable RLS but omit policies; no CREATE POLICY line is the signal that only the admin client writes"

requirements-completed: [NOTIF-01]

duration: 16min
completed: 2026-04-24
---

# Phase 05 Plan 04: Restart-Proof Daily Reminder Dedupe Summary

**Moved daily-reminder idempotency out of the `lastSendDate` module variable and into a Postgres `push_sends (user_id, sent_on)` primary-key row, closing the Test 7 gap where a server restart during SEND_HOUR re-fired reminders.**

## Performance

- **Duration:** ~16 min
- **Started:** 2026-04-24T17:31:50Z
- **Completed:** 2026-04-24T17:48:01Z
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- Replaced process-local `let lastSendDate = ''` (reset on every process start — the Test 7 failure mode) with Postgres-enforced per-user-per-UTC-day dedupe
- Added `public.push_sends` table with composite PK `(user_id, sent_on)`, `auth.users` FK cascade, RLS enabled with zero policies (service-role-only)
- Refactored `tickDailyReminder` to upsert one row per eligible user with `{ onConflict: 'user_id,sent_on', ignoreDuplicates: true }`, then restrict the token send list to the user_ids returned from `.select('user_id')` — only newly-inserted rows (users who have NOT already received today's reminder)
- Introduced the observable "All eligible users already notified for YYYY-MM-DD" log line: this is what a successful Test 7 restart now prints instead of re-sending

## Task Commits

Each task was committed atomically:

1. **Task 1: Create push_sends dedupe migration** — `0efa24f` (feat)
2. **Task 2: Replace in-memory lastSendDate with DB-level per-user dedupe** — `ad8e868` (fix)

## Files Created/Modified

- `supabase/migrations/20260424120000_push_sends.sql` — Created: `push_sends` table with (user_id, sent_on) PK, FK cascade to auth.users, RLS enabled with no policies, documenting comment
- `apps/api/src/services/cron.ts` — Modified: removed `lastSendDate` module variable and its check/assignment; rewrote eligibility block to (1) find users with push tokens, (2) filter by 24h saves, (3) upsert into `push_sends` and capture only newly-inserted user_ids, (4) send pushes only to that claimed subset. Preserved `currentHour !== SEND_HOUR` early return and the startup tick in `startCronJobs()`.

## Decisions Made

- **Per-user dedupe beats single-row dedupe.** A `push_sends` table with one row per user per day (Option 2) is restart-proof AND is the exact shape needed when per-user timezone support lands (the Open Research Gap in STATE.md). A single `last_sent_on` row (Option 1) would have required a schema change the moment any user shifted off the global SEND_HOUR.
- **Insert-first ordering.** The row is inserted BEFORE `sendPushNotifications` is called. Rationale: the failure direction matters. Insert-first means a crash after claim/before-send loses AT MOST one notification (rare, safe-miss). Send-first would re-send on restart — the exact Test 7 failure this plan closes.
- **Upsert + ignoreDuplicates, not pre-select.** Filtering the upsert input via "who is NOT yet in push_sends today" would reintroduce the TOCTOU race. Postgres' conflict handling is the atomic arbiter; the returned rows are the atomic claim result.
- **Startup tick stays.** With DB-level dedupe the startup tick is now genuinely safe: it either claims rows (no prior send today → send proceeds) or claims nothing (someone already sent → early-return logged). Removing it would drop the protection for the case where the server restarts DURING the send hour before any send has landed.

## Deviations from Plan

None — plan executed exactly as written.

The plan specified exact migration SQL and the full `tickDailyReminder` rewrite verbatim; no Rule 1/2/3 deviations required. A blocker was encountered during verification (worktree missing `node_modules`), which was resolved by running `pnpm install` followed by building the `@cravyr/shared` package — this is a verification-infrastructure issue unique to a fresh parallel worktree, not a plan deviation. `pnpm install` touches only gitignored paths, and `packages/shared/dist/` is gitignored, so nothing extraneous entered the commit stream.

## Issues Encountered

- **Worktree had no `node_modules`.** The parallel-execution worktree was freshly rebased against `origin/main` and had never had `pnpm install` run. `cd apps/api && pnpm build` failed with `'tsc' is not recognized`. Resolved by running `pnpm install --ignore-scripts` at the workspace root and `pnpm build` in `packages/shared` (the `@cravyr/shared` package needed to be built once so `apps/api`'s `tsc` could resolve its imports). After that, `cd apps/api && pnpm build` passed cleanly.
- **Verification check for Task 2 (`pnpm build`) was the `tsc && cp public` script.** The TypeScript compile completed with zero diagnostics — the new `supabase-js` `upsert().select()` chain types-check against `@supabase/supabase-js@2.101.1`.

## User Setup Required

**One human action required before the new cron code will do anything observable:**

1. **Apply the migration on Supabase.** The new `cron.ts` upserts into `public.push_sends`; until the table exists, the upsert returns an error, the cron logs `[cron] push_sends claim error:` and short-circuits without sending. The behavior is safe-fail (no duplicate sends, no crash), but no reminder goes out either. Apply via the Supabase SQL editor or CLI:
   ```bash
   supabase db push
   # or paste supabase/migrations/20260424120000_push_sends.sql into the SQL editor
   ```
2. STATE.md already lists this in the "Human Actions Required" list (item 1: "Apply Supabase migrations"); this plan adds `20260424120000_push_sends.sql` to that same batch.

No new environment variables. No new external services. No new API keys.

## Next Phase Readiness

- Test 7 gap closed. The manual reproduction path is in the plan's `<verification>` section: set `CRON_SEND_HOUR` to current hour, ensure one user has a push token + a recent save, start API, kill process after the first send, restart → expect `[cron] All eligible users already notified for YYYY-MM-DD` and no device notification.
- The dedupe pattern (per-entity row, upsert with ignoreDuplicates, return-only-newly-inserted) is the template for future notification types. The next notification (e.g. "closing soon" alerts, once the hours-comparison cron is built) should create its own `{notification_type}_sends` table with its own partition key.
- **Ready for the per-user-timezone Open Research Gap.** When user timezone support lands, `sent_on` stays the same (it's the user's local date, derivable from their IANA zone) and the (user_id, sent_on) PK still correctly dedupes — no migration needed to shard or extend the table.

## Self-Check: PASSED

- FOUND: supabase/migrations/20260424120000_push_sends.sql (1 file, 23 lines, contains `PRIMARY KEY (user_id, sent_on)` and `ENABLE ROW LEVEL SECURITY`)
- FOUND: apps/api/src/services/cron.ts (modified, `pnpm build` passes, no `lastSendDate` literal remains, contains `push_sends`, `ignoreDuplicates: true`, and `onConflict: 'user_id,sent_on'`)
- FOUND: commit 0efa24f (Task 1 migration)
- FOUND: commit ad8e868 (Task 2 cron refactor)

---
*Phase: 05-push-notifications-app-store*
*Completed: 2026-04-24*
