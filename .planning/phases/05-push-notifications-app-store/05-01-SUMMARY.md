---
phase: 05-push-notifications-app-store
plan: 01
subsystem: infra, api, mobile, database
tags: [expo-notifications, supabase, postgis, rls, jwt-auth, push-tokens]

requires:
  - phase: 03-03
    provides: "Authenticated Supabase session in apps/mobile with JWT access token"
  - phase: 02-03
    provides: "Express requireAuth middleware extracting user_id from Bearer JWT"
provides:
  - "push_tokens table with RLS, UNIQUE(user_id, platform) constraint, CASCADE delete on auth.users"
  - "POST /api/v1/notifications/register endpoint with Zod validation and admin-key upsert"
  - "Mobile auto-registration on session establishment and every foreground transition"
  - "PushToken + RegisterPushTokenSchema exported from @cravyr/shared"
affects: [05-02-push-send-cron]

tech-stack:
  added: [expo-notifications@~55.0.19]
  patterns: [rls-owner-only, idempotent-upsert-on-composite-unique, fire-and-forget-registration, soft-prompt-permission]

key-files:
  created:
    - supabase/migrations/20260415100000_push_tokens.sql
    - apps/api/src/routes/notifications.ts
    - packages/shared/src/types/push-token.ts
  modified:
    - apps/api/src/server.ts
    - apps/mobile/app/_layout.tsx
    - apps/mobile/app.config.ts
    - apps/mobile/package.json
    - packages/shared/src/index.ts
    - packages/shared/src/validation/schemas.ts

key-decisions:
  - "UNIQUE(user_id, platform) over UNIQUE(expo_push_token) — reinstall overwrites rather than leaking rows"
  - "Registration is fire-and-forget; failures must never block app startup"
  - "Permission request deferred — getPermissionsAsync check only, no soft prompt UI in scope for this plan"
  - "push_tokens_user_idx added (not in plan) — speeds up cron-side token lookups"
  - "Zod RegisterPushTokenSchema moved into @cravyr/shared to keep validation DRY across API boundary"

patterns-established:
  - "Mobile-to-API: fetch with Authorization: Bearer ${session.access_token} and Platform.OS"
  - "Re-register on AppState 'active' transition, not just session change"

requirements-completed: [NOTIF-01]

duration: retroactive
completed: 2026-04-15
reconciled: 2026-04-24
---

# Plan 05-01: Push Token Infrastructure Summary

**Push token pipeline live: Supabase-backed storage with owner-only RLS, Zod-validated registration endpoint, and fire-and-forget mobile registration on session change + every foreground.**

## Performance

- **Duration:** retroactive (work committed in bundled sync commit `ecc981c`)
- **Completed:** 2026-04-15
- **Reconciled to GSD:** 2026-04-24
- **Tasks:** 4 of 4
- **Files created:** 3
- **Files modified:** 6

## Accomplishments

- `push_tokens` table with RLS `push_tokens_owner` scoped to `auth.uid()`, CASCADE delete, and `UNIQUE(user_id, platform)` preventing stale-token accumulation on reinstall
- `POST /api/v1/notifications/register` mounted at `apps/api/src/server.ts:95`, gated by `requireAuth`, validated with `RegisterPushTokenSchema` from `@cravyr/shared`
- Mobile `registerPushToken()` in `apps/mobile/app/_layout.tsx:26` fires on (a) initial session restore, (b) `onAuthStateChange`, and (c) every `AppState` inactive→active transition
- `PushToken` type and `RegisterPushTokenSchema` exported from `@cravyr/shared` for type-safe API contract

## Task Commits

Work was committed in a single bundled sync commit rather than per-task:

1. **Task 1 — push_tokens migration** — part of `ecc981c` (sync)
2. **Task 2 — PushToken shared type** — part of `ecc981c` (sync)
3. **Task 3 — notifications router + server mount** — part of `ecc981c` (sync)
4. **Task 4 — expo-notifications install + _layout.tsx registration** — part of `ecc981c` (sync)

**Deviation from GSD convention:** commits are not atomic per task. Future phases must commit per task. See Issues Encountered.

## Files Created/Modified

- `supabase/migrations/20260415100000_push_tokens.sql` — table, UNIQUE constraint, RLS policy, user_id index
- `apps/api/src/routes/notifications.ts` — `notificationsRouter` with POST /register, JWT-scoped upsert via service role key
- `packages/shared/src/types/push-token.ts` — `PushToken` interface
- `apps/api/src/server.ts` — mounts `notificationsRouter` at `/api/v1/notifications`
- `apps/mobile/app/_layout.tsx` — `registerPushToken()` + AppState foreground listener + `Notifications.setNotificationHandler`
- `apps/mobile/app.config.ts` — `expo-notifications` plugin with icon + color
- `apps/mobile/package.json` — adds `expo-notifications@~55.0.19`
- `packages/shared/src/validation/schemas.ts` — `RegisterPushTokenSchema` (zod)
- `packages/shared/src/index.ts` — re-exports PushToken and RegisterPushTokenSchema

## Decisions Made

- `UNIQUE(user_id, platform)` instead of per-token uniqueness so a device reinstall **overwrites** the prior row via `onConflict: 'user_id,platform'` — directly satisfies SC-2's "no stale token accumulation"
- Registration is **fire-and-forget** — wrapped in a try-with-silent-catch so a network hiccup cannot break app foreground
- `getPermissionsAsync()` is the only permission call — no request prompt here; Apple/Google reviewers flag unexplained permission requests, so the prompt UI is deferred to a later flow
- Added `push_tokens_user_idx` on `user_id` beyond the plan — the cron-side send query filters by user_id first and this makes the hot path O(log n)

## Deviations from Plan

### Auto-fixed Issues

**1. [Missing validation] Plan used inline type-guards instead of Zod**
- **Found during:** Retroactive reconciliation
- **Issue:** Plan's Task 3 sample code used hand-rolled `typeof`/`includes` checks; the rest of the API validates via `@cravyr/shared` Zod schemas
- **Fix:** Added `RegisterPushTokenSchema` to `@cravyr/shared/validation/schemas.ts` and use `validate(RegisterPushTokenSchema, 'body')` middleware in `notifications.ts`
- **Impact:** Consistent validation pattern across all API routes; type inference flows from schema

**2. [Performance] Added `push_tokens_user_idx` index**
- **Found during:** Retroactive reconciliation
- **Issue:** Plan specified only the primary key and UNIQUE constraint; cron-side token lookup joins on `user_id`
- **Fix:** Added `CREATE INDEX push_tokens_user_idx ON public.push_tokens (user_id)` to the migration
- **Impact:** Sub-millisecond lookup during daily reminder; no cost since table is tiny

---

**Total deviations:** 2 auto-fixed (both are quality improvements, not scope creep)

## Issues Encountered

- **Work was not committed atomically per task.** All four tasks landed in `ecc981c sync:` — a bundled commit with no SUMMARY.md. This plan's reconciliation re-establishes GSD state but the atomic-commit audit trail for this work is permanently lost. **Recommendation for future phases:** execute via `/gsd-execute-phase` so each task gets its own commit.

## User Setup Required

None at the app-code layer. However, for push delivery to actually reach devices:
- EAS project must have APNs (Apple Push) and FCM (Firebase Cloud Messaging) credentials configured — handled by `eas credentials` during 05-03 setup
- `EAS_PROJECT_ID` constant in `_layout.tsx` (`e6d2a650-fd20-4092-a4a5-0f7a211e1e1a`) must match the live Expo project

## Next Phase Readiness

- 05-02 (push send + cron) has everything it needs: `push_tokens` table, service-role client pattern, and a `user_id`-indexed lookup path
- One open concern: `EAS_PROJECT_ID` is hard-coded rather than read from `expo-constants` — future refactor should pull it from `Constants.expoConfig?.extra?.eas?.projectId`

---
*Phase: 05-push-notifications-app-store*
*Completed: 2026-04-15 (reconciled 2026-04-24)*
