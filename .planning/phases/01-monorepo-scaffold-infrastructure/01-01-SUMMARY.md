---
phase: 01-monorepo-scaffold-infrastructure
plan: 01
status: complete
started: 2026-04-11
completed: 2026-04-11
---

## Summary

Captured the existing Supabase remote database schema as a tracked CLI migration file, establishing the migration workflow for all future schema changes.

## What Was Built

- **supabase/config.toml** — Supabase CLI configuration initialized at monorepo root, linked to remote project `dxkvtcpgqkbkhjshvqji`
- **supabase/migrations/20260411000000_remote_schema.sql** — Complete public schema captured from live remote database:
  - 4 tables: `restaurants` (with geography(POINT) + GIST/GIN indexes), `swipes`, `saves`, `user_preferences`
  - PostGIS extension in extensions schema
  - 2 functions: `handle_swipe_save` (trigger, SECURITY DEFINER) and `get_restaurant_recommendations` (RPC, STABLE)
  - 1 trigger: `on_swipe_save` (auto-populates saves on right/superlike swipes)
  - 5 RLS policies using `(SELECT auth.uid())` optimization pattern
  - No internal Supabase schema pollution (no `auth.*`, `storage.*`, `realtime.*`)

## Deviations

- `supabase db pull` and `supabase db dump` both require Docker Desktop, which is not installed (per D-06: remote-only development). Schema was instead extracted via Supabase MCP tools (`execute_sql` with `pg_get_functiondef`, `pg_indexes`, `pg_policies`, `information_schema.triggers`) and written manually.
- 8 stale migration history entries from earlier MCP-based schema application were repaired as `reverted` before marking the new migration as `applied`.

## Verification

- `supabase migration list` shows local and remote in sync on `20260411000000`
- Migration file verified against live remote: all tables, columns, indexes, functions, triggers, and RLS policies match exactly
- No secrets in committed files (config.toml contains only project_id, not keys)
