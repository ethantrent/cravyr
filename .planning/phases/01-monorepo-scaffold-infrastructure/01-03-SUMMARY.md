---
phase: 01-monorepo-scaffold-infrastructure
plan: 03
status: complete
started: 2026-04-11
completed: 2026-04-11
---

## Summary

Fixed the monorepo dev workflow and created the Supabase keep-alive cron job.

## What Was Built

- **apps/mobile/package.json** — Added `"dev": "expo start"` script so turbo's `dev` task discovers the mobile app. Running `pnpm dev` from the monorepo root now starts both the API server and Expo dev server.
- **.github/workflows/supabase-keepalive.yml** — GitHub Actions cron job that:
  - Runs every 3 days at 9:00 AM UTC (`0 9 */3 * *`)
  - Pings Supabase PostgREST endpoint via curl to prevent free-tier 7-day auto-pause
  - Supports manual trigger via `workflow_dispatch`
  - Uses repository secrets (`SUPABASE_URL`, `SUPABASE_ANON_KEY`) — no hardcoded values
  - Fails the job if HTTP response is not 200

## Action Required

- Set GitHub repository secrets: `SUPABASE_URL` and `SUPABASE_ANON_KEY` (via Settings > Secrets and variables > Actions, or `gh secret set`)

## Verification

- `grep '"dev": "expo start"' apps/mobile/package.json` confirms script exists
- Workflow YAML contains cron schedule, workflow_dispatch, secret references, and HTTP status check
