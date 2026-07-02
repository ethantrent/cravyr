---
phase: quick-260702-dpv
plan: 01
subsystem: infra
tags: [supabase, github-actions, postgis, rpc, ci, cost-guard]

# Dependency graph
requires:
  - phase: quick-260424-kxi
    provides: supabase-keepalive workflow + applied migrations baseline
provides:
  - database_size_bytes() RPC exposing aggregate DB byte count to anon/authenticated
  - CI DB-size guard that fails the keep-alive workflow above ~400MB (Pitfall 8)
  - STATE.md records the Google Cloud billing-alert human action (Pitfall 2)
  - STATE.md records Render free-tier cold-start as an accepted known limitation
affects: [supabase-keepalive, cost-monitoring, submission-runbook]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SECURITY DEFINER SQL RPC exposing only aggregate metadata (no row data) for CI to poll via anon key"
    - "Keep-alive workflow doubles as a threshold alarm — non-zero exit triggers GitHub failure email"

key-files:
  created:
    - supabase/migrations/20260702000000_database_size_rpc.sql
  modified:
    - .github/workflows/supabase-keepalive.yml
    - .planning/STATE.md

key-decisions:
  - "DB-size guard threshold set at 400 MiB (419430400 bytes) = ~80% of the 500MB free-tier cap, leaving headroom to react before read-only mode"
  - "Workflow exits 0 with a warning (not 1) when the RPC is absent, so the keep-alive stays green until the migration is applied via supabase db push"
  - "Render cold-start (25-60s) accepted as-is; render.yaml plan:free and 800px photo widths deliberately untouched per user decision"

patterns-established:
  - "Aggregate-only SECURITY DEFINER RPC for anon CI polling: no args, no dynamic SQL, no injection surface"

requirements-completed: []

coverage:
  - id: D1
    description: "database_size_bytes() RPC returns pg_database_size(current_database()) with EXECUTE granted to anon/authenticated"
    verification:
      - kind: automated
        ref: "test -f supabase/migrations/20260702000000_database_size_rpc.sql && grep pg_database_size && grep 'GRANT EXECUTE'"
        status: pass
    human_judgment: false
  - id: D2
    description: "Keep-alive workflow fails (exit 1) above 400MiB, exits 0 with warning if RPC absent; YAML parses; ping step/schedule unchanged"
    verification:
      - kind: automated
        ref: "grep database_size_bytes && grep 419430400 && js-yaml parse of supabase-keepalive.yml"
        status: pass
    human_judgment: false
  - id: D3
    description: "STATE.md lists the Google Cloud billing-alert human action and records the Render cold-start accepted limitation + DB-size guard note"
    verification:
      - kind: automated
        ref: "grep 'billing alert' && grep -i 'cold-start' && grep '~400' .planning/STATE.md"
        status: pass
    human_judgment: false
  - id: D4
    description: "RPC migration must be applied to remote via `supabase db push` before the CI size-check becomes active on real DB size"
    verification: []
    human_judgment: true
    rationale: "Applying the migration to the remote Supabase project is a human-only action; until then the workflow warns-and-passes rather than measuring true size."

# Metrics
duration: 2min
completed: 2026-07-02
status: complete
---

# Quick 260702-dpv: PITFALLS.md open-items closeout Summary

**Added a database_size_bytes() SECURITY DEFINER RPC and a CI DB-size guard that fails the Supabase keep-alive workflow above ~400MB, plus recorded the Google Cloud billing alert and Render cold-start as accepted-risk/human-action items in STATE.md.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-07-02T19:03:20Z
- **Completed:** 2026-07-02T19:05:06Z
- **Tasks:** 3
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- New `database_size_bytes()` RPC (SECURITY DEFINER, SET search_path, aggregate-only) callable via anon-key REST, guarding Pitfall 8 (silent 500MB read-only mode).
- Extended the existing `supabase-keepalive.yml` with a "Check database size" step that exits 1 above 400 MiB (GitHub failure email) and exits 0 with a warning when the RPC is not yet applied.
- Recorded the Google Cloud billing alert ($50/day) as Human Action #10 (Pitfall 2 field-mask cost guard) and documented the Render cold-start as an accepted limitation in STATE.md Key Decisions.

## Task Commits

Each code task was committed atomically:

1. **Task 1: Add database_size_bytes RPC migration** - `b77b081` (feat)
2. **Task 2: Add DB-size guard step to keep-alive workflow** - `59523e9` (feat)
3. **Task 3: STATE.md edits** - not committed here; docs commit handled by the orchestrator (Step 8) per task constraints.

## Files Created/Modified
- `supabase/migrations/20260702000000_database_size_rpc.sql` - New RPC returning `pg_database_size(current_database())`, EXECUTE granted to anon/authenticated. Sorts lexically after 20260621 and before 20260710 (verified); additive/idempotent so ordering is not a correctness concern.
- `.github/workflows/supabase-keepalive.yml` - Added "Check database size" step (threshold 419430400 bytes / 400 MiB); POSIX-sh, non-numeric-safe (warn+exit 0 when RPC absent). Existing ping step and cron schedule unchanged.
- `.planning/STATE.md` - Human Action #10 (Google Cloud billing alert); Key Decisions entries for Render cold-start accepted risk and the DB-size CI guard.

## Decisions Made
- Threshold at 400 MiB (~80% of 500MB) to leave reaction headroom before read-only mode.
- Absent-RPC path warns and passes (exit 0) so the keep-alive does not go red before the migration is applied to remote.
- render.yaml (`plan: free`) and 800px `maxWidthPx` photo widths deliberately left untouched — explicitly out of scope per user decision.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- The plan's Task 2 verify command used `python3 -c "import yaml..."` but PyYAML is not installed in this environment. Substituted an equivalent YAML validation via Node's `js-yaml` (available in the monorepo), which parsed the file cleanly. Both grep assertions (`database_size_bytes`, `419430400`) passed. No change to the deliverable — only the verification tool differed.

## User Setup Required
- **Apply the migration to remote before the guard goes live:** run `supabase db push` so `20260702000000_database_size_rpc.sql` reaches the remote Supabase project. Until then the workflow warns-and-passes (the RPC returns a non-numeric error body).
- **Google Cloud billing alert:** set up a $50/day budget alert on the Places API project (Cloud Console → Billing → Budgets & alerts) — now tracked as Human Action #10 in STATE.md.

## Next Phase Readiness
- All three PITFALLS.md open items (DB-size guard, billing alert, cold-start acceptance) are closed in-repo. The only remaining live-activation step is the human `supabase db push` for the new migration.

## Known Stubs
None.

## Self-Check: PASSED

- FOUND: supabase/migrations/20260702000000_database_size_rpc.sql
- FOUND: .github/workflows/supabase-keepalive.yml
- FOUND: .planning/quick/260702-dpv-address-pitfalls-md-open-items-db-size-c/260702-dpv-SUMMARY.md
- FOUND commit: b77b081 (Task 1)
- FOUND commit: 59523e9 (Task 2)

---
*Phase: quick-260702-dpv*
*Completed: 2026-07-02*
