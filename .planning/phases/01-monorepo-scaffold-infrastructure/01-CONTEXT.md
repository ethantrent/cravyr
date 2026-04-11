# Phase 1: Monorepo Scaffold + Infrastructure - Context

**Gathered:** 2026-04-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Set up the monorepo foundation so developers can run `pnpm dev` without error, and the Supabase database is live with PostGIS, full schema migrations, RLS policies, and a keep-alive cron. Render is provisioned with a health endpoint. No subsequent phase inherits a broken foundation.

Note: The monorepo scaffold itself (Turborepo, pnpm workspaces, apps/mobile, apps/api, packages/shared) already exists from Phase 4 development. Phase 1's main remaining work is database infrastructure, deployment config, and verification that the existing scaffold is clean.

</domain>

<decisions>
## Implementation Decisions

### Schema Migration Approach
- **D-01:** Use Supabase CLI migrations — SQL migration files tracked in the repo under `supabase/migrations/`. Apply with `supabase db push` to the remote project.
- **D-02:** Supabase CLI config (`supabase/`) lives at the monorepo root, not inside apps/api. Migrations are shared infrastructure referenced by both mobile and API.
- **D-03:** Full schema upfront in the initial migration — all 5 tables (restaurants, swipes, saves, preferences, users-related), PostGIS extension, RLS policies, and triggers. Later phases just use them with no migration coordination overhead.
- **D-04:** No seed data. The database starts empty. Google Places API integration (Phase 2) populates restaurant data.

### Keep-Alive Strategy
- **D-05:** GitHub Actions cron job that runs `SELECT 1` against Supabase every 3 days to prevent the free-tier 7-day auto-pause. No UptimeRobot needed at this stage.

### Local Dev Workflow
- **D-06:** Remote-only Supabase development — always develop against the hosted project. No local Docker-based Supabase. Solo developer means no conflict risk. Supabase CLI manages migrations but pushes directly to remote.
- **D-07:** Per-app .env files — `apps/api/.env` and `apps/mobile/.env` with app-specific variables. Each app loads its own. A `.env.example` in each directory documents required variables.

### Render Deployment
- **D-08:** Start on Render free tier (512MB RAM, auto-sleep after 15 min idle). Upgrade to Starter ($7/mo) before real user testing.
- **D-09:** Commit `render.yaml` blueprint to the repo (in apps/api/) for infrastructure-as-code deployment. Render auto-detects it.
- **D-10:** Include basic security middleware in Phase 1 — helmet (security headers), cors (allow mobile app origin), and express-rate-limit. Small effort now avoids retrofitting later.

### Claude's Discretion
- Exact render.yaml field values (build/start commands, env var names)
- .env.example contents and documentation format
- GitHub Actions cron workflow file structure
- Supabase CLI project linking configuration
- PostGIS extension setup and exact RLS policy SQL

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Scope & Success Criteria
- `.planning/ROADMAP.md` §Phase 1 — Success criteria (5 items), requirements INFRA-01 and API-02

### Project Constraints & Architecture
- `.planning/PROJECT.md` — Stack constraints (Turborepo + pnpm, Supabase + PostGIS, Express.js, Render), budget constraints (free/starter tier), Supabase free-tier auto-pause warning, RLS `(SELECT auth.uid())` optimization

### Technology Stack
- `CLAUDE.md` §Supabase schema — Full table definitions (restaurants, swipes, saves), PostGIS setup, RLS patterns, auth configuration
- `CLAUDE.md` §Express.js on Render — API route structure, render.yaml blueprint, node-cache setup, middleware recommendations
- `CLAUDE.md` §Monorepo structure — Directory layout, pnpm workspace config, `.npmrc` settings, shared package structure

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `turbo.json` — Task orchestration already configured (build, dev, typecheck, lint, test)
- `pnpm-workspace.yaml` — Workspace packages defined (apps/*, packages/*)
- `apps/api/src/server.ts` — Express 5 server with health endpoint and route mounting already in place
- `apps/mobile/package.json` — Full Expo SDK 55 dependency tree installed (Reanimated v4, Gesture Handler, rn-swiper-list, Zustand v5, Supabase client)
- `packages/shared/` — Shared types package with workspace linking

### Established Patterns
- Express 5 async error handling — no try/catch needed in route handlers
- `@cravyr/shared` workspace protocol linking (`workspace:*`)
- Expo Router file-based navigation (app/ directory structure)
- dotenv for environment variable loading in API

### Integration Points
- `apps/api/src/server.ts` needs security middleware added (helmet, cors, rate-limit)
- `supabase/` directory to be created at monorepo root for CLI config and migrations
- `.github/workflows/` to be created for keep-alive cron
- `apps/api/render.yaml` to be created for deployment blueprint
- `.env.example` files to be created in apps/api/ and apps/mobile/

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for implementation details.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-monorepo-scaffold-infrastructure*
*Context gathered: 2026-04-10*
