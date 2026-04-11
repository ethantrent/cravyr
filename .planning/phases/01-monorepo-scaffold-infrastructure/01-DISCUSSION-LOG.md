# Phase 1: Monorepo Scaffold + Infrastructure - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-10
**Phase:** 01-monorepo-scaffold-infrastructure
**Areas discussed:** Schema migration approach, Keep-alive strategy, Local dev workflow, Render deployment config

---

## Schema Migration Approach

| Option | Description | Selected |
|--------|-------------|----------|
| Supabase CLI migrations | SQL migration files tracked in repo under supabase/migrations/. Run `supabase db push` to apply. Version-controlled, repeatable. | ✓ |
| Raw SQL scripts in repo | Manual .sql files in a /db folder. Copy-paste into dashboard or run via psql. | |
| Dashboard-only | Use Supabase Studio UI. Fastest for prototyping but no version control. | |

**User's choice:** Supabase CLI migrations
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Monorepo root | supabase/ directory at repo root. Migrations are shared infrastructure. | ✓ |
| Inside apps/api | Co-locate with the backend. Keeps API self-contained. | |

**User's choice:** Monorepo root
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Full schema upfront | Create all 5 tables + PostGIS + RLS + triggers in the initial migration. | ✓ |
| Incremental per phase | Phase 1 creates only restaurants table, later phases add more. | |

**User's choice:** Full schema upfront
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, seed file with test restaurants | ~10 hardcoded restaurant rows near a known location for testing. | |
| No seed data | Start empty. Rely on Google Places API integration (Phase 2). | ✓ |
| You decide | Claude picks the pragmatic approach. | |

**User's choice:** No seed data
**Notes:** None

---

## Keep-Alive Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| GitHub Actions cron | Scheduled workflow running `SELECT 1` every 3 days. Free, version-controlled. | ✓ |
| UptimeRobot pings | External service pinging /health every 5 min. Keeps Render warm indirectly. | |
| Both GitHub Actions + UptimeRobot | Belt and suspenders approach. | |
| You decide | Claude picks based on infrastructure setup. | |

**User's choice:** GitHub Actions cron
**Notes:** None

---

## Local Dev Workflow

| Option | Description | Selected |
|--------|-------------|----------|
| Remote-only | Always develop against hosted Supabase. No Docker needed. Solo dev, no conflict risk. | ✓ |
| Local Supabase via Docker | Run `supabase start` for local stack. Offline-capable but requires Docker Desktop. | |
| You decide | Claude picks based on solo-developer context. | |

**User's choice:** Remote-only
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Per-app .env files | apps/api/.env and apps/mobile/.env with app-specific vars. .env.example documents required vars. | ✓ |
| Single root .env | One .env at monorepo root. All apps read from same file. | |
| You decide | Claude picks the standard pattern. | |

**User's choice:** Per-app .env files
**Notes:** None

---

## Render Deployment Config

| Option | Description | Selected |
|--------|-------------|----------|
| Free tier for now | Start free (512MB, auto-sleep). Upgrade to Starter before real user testing. | ✓ |
| Starter tier from day one | $7/month, no cold-start. Better DX but costs money pre-users. | |
| You decide | Claude picks based on development stage. | |

**User's choice:** Free tier for now
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, commit render.yaml | Blueprint in apps/api/render.yaml. Version-controlled infrastructure. | ✓ |
| Manual Render dashboard setup | Configure via web UI. Not reproducible. | |

**User's choice:** Yes, commit render.yaml
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, basic security middleware | Add helmet, cors, express-rate-limit. Small effort now avoids retrofitting. | ✓ |
| Defer to Phase 2 | Add security when API routes are built. | |
| You decide | Claude picks based on what's pragmatic. | |

**User's choice:** Yes, basic security middleware
**Notes:** None

---

## Claude's Discretion

- Exact render.yaml field values
- .env.example contents
- GitHub Actions cron workflow structure
- Supabase CLI project linking
- PostGIS extension setup and RLS policy SQL

## Deferred Ideas

None — discussion stayed within phase scope.
