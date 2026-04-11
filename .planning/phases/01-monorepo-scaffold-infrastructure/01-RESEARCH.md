# Phase 1: Monorepo Scaffold + Infrastructure - Research

**Researched:** 2026-04-10
**Domain:** Monorepo scaffold verification, Supabase CLI migrations, Render deployment, Express security middleware, GitHub Actions keep-alive
**Confidence:** HIGH

## Summary

Phase 1 is primarily an **infrastructure hardening and formalization** phase, not a greenfield build. The monorepo scaffold (Turborepo, pnpm workspaces, apps/mobile, apps/api, packages/shared) already exists from Phase 4 development. The Supabase database is live with PostGIS, all 5 tables, RLS policies, triggers, and the recommendation function already applied via MCP. What remains is: (1) capturing the existing remote schema as a tracked migration file via `supabase db pull`, (2) adding the `dev` script to mobile so `pnpm dev` starts both apps, (3) adding security middleware (helmet, cors, express-rate-limit) to the Express API, (4) creating the render.yaml deployment blueprint, (5) setting up the GitHub Actions keep-alive cron, and (6) creating `.env.example` files for documentation.

The biggest risk in this phase is not complexity but **breaking what already works**. The mobile app loads on Android emulator, the API serves routes, and the database schema is live. Any changes must preserve this working state while formalizing the infrastructure.

**Primary recommendation:** Treat this as a "formalize and harden" phase. Pull existing schema into migration files, add the missing `dev` script, wire security middleware, create deployment config, and verify all success criteria pass.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Use Supabase CLI migrations -- SQL migration files tracked in the repo under `supabase/migrations/`. Apply with `supabase db push` to the remote project.
- **D-02:** Supabase CLI config (`supabase/`) lives at the monorepo root, not inside apps/api. Migrations are shared infrastructure referenced by both mobile and API.
- **D-03:** Full schema upfront in the initial migration -- all 5 tables (restaurants, swipes, saves, preferences, users-related), PostGIS extension, RLS policies, and triggers. Later phases just use them with no migration coordination overhead.
- **D-04:** No seed data. The database starts empty. Google Places API integration (Phase 2) populates restaurant data.
- **D-05:** GitHub Actions cron job that runs `SELECT 1` against Supabase every 3 days to prevent the free-tier 7-day auto-pause. No UptimeRobot needed at this stage.
- **D-06:** Remote-only Supabase development -- always develop against the hosted project. No local Docker-based Supabase. Supabase CLI manages migrations but pushes directly to remote.
- **D-07:** Per-app .env files -- `apps/api/.env` and `apps/mobile/.env` with app-specific variables. Each app loads its own. A `.env.example` in each directory documents required variables.
- **D-08:** Start on Render free tier (512MB RAM, auto-sleep after 15 min idle). Upgrade to Starter ($7/mo) before real user testing.
- **D-09:** Commit `render.yaml` blueprint to the repo (in apps/api/) for infrastructure-as-code deployment. Render auto-detects it.
- **D-10:** Include basic security middleware in Phase 1 -- helmet (security headers), cors (allow mobile app origin), and express-rate-limit. Small effort now avoids retrofitting later.

### Claude's Discretion
- Exact render.yaml field values (build/start commands, env var names)
- .env.example contents and documentation format
- GitHub Actions cron workflow file structure
- Supabase CLI project linking configuration
- PostGIS extension setup and exact RLS policy SQL

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INFRA-01 | Monorepo scaffold (Turborepo + pnpm, apps/mobile + apps/api + packages/shared) | Scaffold exists; research identifies gaps: missing `dev` script in mobile, no `.env.example` files, no render.yaml, no supabase/ directory with migration files |
| API-02 | Supabase backend with PostGIS spatial index and recommendation SQL function | Schema already applied to remote DB via MCP; research documents `supabase db pull` workflow to capture as tracked migrations, plus RLS policy patterns |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Tech Stack**: Turborepo + pnpm monorepo, Expo SDK 55, Reanimated v4, Supabase + PostGIS, Express.js v5, Google Places API (New), Expo Router, Zustand
- **Budget**: Free/starter tier infrastructure
- **.npmrc**: `node-linker=hoisted` is required for EAS Build compatibility
- **Shared types**: Must come from `@cravyr/shared` -- never duplicate
- **Supabase RLS**: Use `(SELECT auth.uid())` pattern to cache per-statement
- **Express 5**: Async route handlers propagate errors automatically -- no try/catch needed
- **Supabase client**: Must use `detectSessionInUrl: false` for React Native

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| turbo | 2.9.4 | Task orchestration | Installed at root [VERIFIED: package.json] |
| pnpm | 10.17.0 | Package manager with workspace protocol | Installed globally [VERIFIED: CLI check] |
| express | ^5.2.1 | API server | Installed in apps/api [VERIFIED: package.json] |
| @supabase/supabase-js | ^2.101.1 | DB client, Auth, RLS | Installed in both apps [VERIFIED: package.json] |
| node-cache | ^5.1.2 | In-memory TTL cache | Installed in apps/api [VERIFIED: package.json] |
| dotenv | ^17.4.1 | Environment variable loading | Installed in apps/api [VERIFIED: package.json] |

### New Dependencies (Phase 1 Additions)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| helmet | 8.1.0 | HTTP security headers (X-Frame-Options, CSP, etc.) | [VERIFIED: npm registry] Standard Express security middleware; ships own TypeScript types |
| cors | 2.8.6 | CORS middleware for mobile app requests | [VERIFIED: npm registry] Required for cross-origin requests from Expo app |
| @types/cors | 2.8.19 | TypeScript type definitions for cors | [VERIFIED: npm registry] cors does not ship own types |
| express-rate-limit | 8.3.2 | IP-based rate limiting | [VERIFIED: npm registry] Ships own types; peer dep `express >= 4.11` (covers Express 5) |

### Dev Dependencies (Phase 1 Additions)
| Library | Version | Purpose |
|---------|---------|---------|
| supabase | 2.89.1 | Supabase CLI for migrations (npx or devDep) | [VERIFIED: npm registry] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| helmet | Manual header setting | helmet covers 15+ headers with sensible defaults; manual is error-prone |
| express-rate-limit | nginx rate limiting | Not available on Render free tier; express-rate-limit works at app level |
| GitHub Actions cron | Supabase Edge Function | Edge Functions work but add Supabase-specific complexity; GH Actions is simpler and repo-local |

**Installation (apps/api):**
```bash
cd apps/api
pnpm add helmet cors express-rate-limit
pnpm add -D @types/cors
```

## Architecture Patterns

### Current Project Structure (Verified)
```
cravyr/
├── CLAUDE.md                         # Project conventions
├── .npmrc                            # node-linker=hoisted
├── turbo.json                        # Task orchestration
├── pnpm-workspace.yaml               # apps/* + packages/*
├── package.json                      # Root scripts (build, dev, lint, typecheck, test)
├── tsconfig.json                     # Extends expo/tsconfig.base
├── .gitignore                        # node_modules, .expo, dist, .turbo, .env
├── apps/
│   ├── api/
│   │   ├── package.json              # Express 5 + Supabase + node-cache + dotenv
│   │   ├── tsconfig.json             # CommonJS target
│   │   ├── src/
│   │   │   ├── server.ts             # Express app with health check + route mounting
│   │   │   ├── routes/               # users, swipes, restaurants, recommendations, saves
│   │   │   └── middleware/auth.ts    # JWT verification via Supabase
│   │   └── .env                      # PORT, SUPABASE_URL, keys (NOT committed)
│   └── mobile/
│       ├── package.json              # Expo SDK 55, full dep tree, NO dev script
│       ├── tsconfig.json             # Extends expo/tsconfig.base, paths for @cravyr/shared
│       ├── app.config.ts             # Expo config with location permissions
│       ├── babel.config.js           # Reanimated plugin
│       ├── metro.config.js           # Monorepo support + worklets web stub
│       ├── polyfills/                # react-native-worklets web stub
│       ├── app/                      # Expo Router (tabs, restaurant detail, settings)
│       └── .env                      # EXPO_PUBLIC_* vars (NOT committed)
├── packages/
│   └── shared/
│       ├── package.json              # @cravyr/shared, workspace:*
│       ├── tsconfig.json             # ESNext, bundler resolution
│       └── src/
│           ├── index.ts              # Re-exports types
│           └── types/                # restaurant.ts, saves.ts, preferences.ts
├── .github/                          # TO BE CREATED - keep-alive workflow
└── supabase/                         # TO BE CREATED - CLI config + migrations
    ├── config.toml                   # Generated by supabase init
    └── migrations/
        └── <timestamp>_initial.sql   # Full schema pulled from remote
```

### Pattern 1: Supabase CLI Remote-Only Workflow
**What:** Use Supabase CLI to manage migrations against the remote project directly, with no local Docker Supabase instance.
**When to use:** Solo developer, no conflict risk, remote DB already provisioned.
**Workflow:** [CITED: https://supabase.com/docs/guides/deployment/database-migrations]
```bash
# One-time setup (at monorepo root)
npx supabase init                     # Creates supabase/ directory with config.toml
npx supabase login                    # Authenticates with Personal Access Token
npx supabase link --project-ref dxkvtcpgqkbkhjshvqji  # Links to remote project

# Capture existing remote schema as migration
npx supabase db pull                  # Generates supabase/migrations/<timestamp>_remote_schema.sql

# Future schema changes
npx supabase migration new <name>     # Creates timestamped migration file
# Edit the file with SQL
npx supabase db push                  # Applies to remote
```

**Critical detail:** Since the schema was already applied via MCP (not via CLI migrations), `supabase db pull` with an empty migration history will use `pg_dump` to capture the entire remote schema. This creates the initial migration file. [CITED: https://supabase.com/docs/reference/cli/supabase-db-pull]

### Pattern 2: Express 5 Security Middleware Stack
**What:** Layer helmet, cors, and express-rate-limit before route handlers.
**When to use:** Every Express API that accepts external requests.
**Example:** [ASSUMED -- standard Express middleware pattern]
```typescript
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

// Security headers
app.use(helmet());

// CORS - allow mobile app
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));

// Rate limiting - 100 requests per 15 minutes per IP
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
}));

// Body parsing (already present)
app.use(express.json());
```

**Middleware order matters:** helmet first (sets security headers), cors second (handles preflight), rate-limit third (blocks abuse before hitting routes), then body parsing.

### Pattern 3: Render Blueprint
**What:** Infrastructure-as-code YAML for Render deployment.
**Where:** `apps/api/render.yaml`
**Example:** [CITED: https://render.com/docs/blueprint-spec]
```yaml
services:
  - type: web
    name: cravyr-api
    runtime: node
    plan: free
    rootDir: apps/api
    buildCommand: pnpm install && pnpm run build
    startCommand: node dist/server.js
    healthCheckPath: /health
    envVars:
      - key: PORT
        value: "3000"
      - key: SUPABASE_URL
        sync: false
      - key: SUPABASE_ANON_KEY
        sync: false
      - key: SUPABASE_SERVICE_ROLE_KEY
        sync: false
      - key: GOOGLE_PLACES_API_KEY
        sync: false
      - key: CORS_ORIGIN
        sync: false
```

**Note:** `sync: false` means the value must be set manually in the Render dashboard (not committed to repo). The `plan: free` starts on free tier per D-08. `healthCheckPath: /health` enables zero-downtime deploys and the health check endpoint already exists in server.ts.

**Important:** The `rootDir` must be relative to the repo root, not absolute. Render auto-detects render.yaml at the repo root or in subdirectories.

### Pattern 4: GitHub Actions Keep-Alive Cron
**What:** Scheduled workflow that pings Supabase to prevent free-tier auto-pause.
**Where:** `.github/workflows/supabase-keepalive.yml`
**Example:** [CITED: https://dev.to/jps27cse/how-to-prevent-your-supabase-project-database-from-being-paused-using-github-actions-3hel]
```yaml
name: Supabase Keep-Alive

on:
  schedule:
    - cron: '0 9 */3 * *'   # Every 3 days at 9:00 AM UTC
  workflow_dispatch:          # Manual trigger for testing

jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ping Supabase
        uses: actions/github-script@v7
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
        with:
          script: |
            const { createClient } = require('@supabase/supabase-js');
            // Note: @supabase/supabase-js ships with github-script's Node runtime
            // If not available, use a fetch-based approach instead
```

**Simpler alternative (no npm install needed):**
```yaml
      - name: Ping Supabase
        run: |
          curl -s -o /dev/null -w "%{http_code}" \
            "${{ secrets.SUPABASE_URL }}/rest/v1/?apikey=${{ secrets.SUPABASE_ANON_KEY }}&limit=0" \
            | grep -q "200" && echo "Supabase is alive" || exit 1
```

**Repository secrets needed:** `SUPABASE_URL`, `SUPABASE_ANON_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`).

The curl approach is simpler and avoids needing Node.js setup or npm install steps. It hits the PostgREST endpoint which counts as database activity.

### Anti-Patterns to Avoid
- **Seeding the DB in Phase 1:** D-04 explicitly says no seed data. Phase 2 populates via Google Places API.
- **Running supabase start locally:** D-06 locks remote-only development. The Supabase CLI is only for migrations, not local Docker.
- **Putting supabase/ inside apps/api:** D-02 says it lives at monorepo root. Both apps reference the schema.
- **Committing .env files:** Already in .gitignore. Use .env.example for documentation only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP security headers | Manual `res.setHeader()` calls | helmet | Covers 15+ headers with sensible defaults; stays current with new browser security features |
| CORS handling | Custom preflight middleware | cors | Handles OPTIONS preflight, credential passing, origin validation edge cases |
| Rate limiting | Custom request counter | express-rate-limit | Handles IP extraction behind proxies, sliding windows, memory cleanup |
| Migration tracking | Manual SQL scripts run via psql | Supabase CLI migrations | Tracks applied/pending state, prevents double-application, generates timestamps |
| Keep-alive pinging | Manual cron on local machine | GitHub Actions scheduled workflow | Runs regardless of developer machine state; free; auditable in repo |

**Key insight:** Every item on this list has subtle edge cases (proxy IP extraction, migration idempotency, CORS credential handling) that are trivially solved by the standard tool but error-prone when hand-built.

## Existing State Inventory

This is not a rename/refactor phase, but the existing state matters because the database schema was applied outside the migration system.

| Category | Current State | Action Required |
|----------|---------------|-----------------|
| Remote DB schema | All 5 tables + PostGIS + RLS + triggers + RPC function applied via MCP | `supabase db pull` to capture as migration file |
| API .env | PORT, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY set | Create .env.example template |
| Mobile .env | EXPO_PUBLIC_API_URL, EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY set | Create .env.example template |
| Mobile dev script | Missing -- `pnpm dev` from root won't start mobile | Add `"dev": "expo start"` to mobile package.json |
| Security middleware | None on API server | Add helmet, cors, express-rate-limit |
| Deployment config | No render.yaml | Create apps/api/render.yaml |
| Supabase CLI config | No supabase/ directory | Run `supabase init` + `supabase link` |
| Keep-alive cron | No .github/ directory | Create workflow file |

## Common Pitfalls

### Pitfall 1: supabase db pull Captures Supabase Internal Schemas
**What goes wrong:** `supabase db pull` without the `-s` flag may include Supabase internal schemas (auth, storage, realtime) in the migration file, making it unusable for `db push` on a fresh project.
**Why it happens:** `pg_dump` captures everything unless filtered by schema.
**How to avoid:** After pulling, inspect the generated migration file. Remove any references to `auth.*`, `storage.*`, or `realtime.*` schemas. Only keep `public.*` and `extensions.*` SQL. Alternatively, use `-s public` flag to limit the pull.
**Warning signs:** Migration file is thousands of lines long with references to `auth.users` internal columns or `supabase_functions`.

### Pitfall 2: Missing dev Script Means pnpm dev Silently Skips Mobile
**What goes wrong:** Turbo's `dev` task only runs in packages that have a `"dev"` script. Mobile app has `"start"` but not `"dev"`, so `pnpm dev` from root only starts the API.
**Why it happens:** Phase 4 development used `npx expo start` directly, not through turbo.
**How to avoid:** Add `"dev": "expo start"` to apps/mobile/package.json.
**Warning signs:** Running `pnpm dev` only shows API output, no Expo output. [VERIFIED: mobile package.json has no dev script]

### Pitfall 3: render.yaml rootDir Must Be Relative to Repo Root
**What goes wrong:** Render can't find the app if rootDir is wrong or if buildCommand assumes wrong working directory.
**Why it happens:** In a monorepo, the build runs from the rootDir, not the repo root.
**How to avoid:** Set `rootDir: apps/api` and make buildCommand relative to that directory (e.g., `pnpm install && pnpm run build`, not `cd apps/api && ...`). [CITED: https://render.com/docs/blueprint-spec]
**Warning signs:** Build fails with "command not found" or "no package.json found."

### Pitfall 4: helmet Blocks Expo DevClient Connections
**What goes wrong:** helmet's default Content-Security-Policy can block WebSocket connections used by Expo's development tools during local development.
**Why it happens:** helmet sets restrictive CSP headers by default.
**How to avoid:** Either disable CSP in development (`helmet({ contentSecurityPolicy: false })` when `NODE_ENV !== 'production'`) or configure CSP to allow Expo origins. [ASSUMED]
**Warning signs:** Expo dev client can't connect to API; browser console shows CSP violations.

### Pitfall 5: GitHub Actions Cron Minimum Interval
**What goes wrong:** GitHub Actions cron jobs have a minimum granularity and may not fire at the exact scheduled time.
**Why it happens:** GitHub queues cron jobs and may delay them by minutes to hours during high-load periods.
**How to avoid:** Schedule every 3 days (D-05 requirement) which provides ample margin against the 7-day auto-pause. The `workflow_dispatch` trigger allows manual testing. [ASSUMED -- based on common GH Actions cron behavior]
**Warning signs:** Workflow history shows runs delayed beyond expected schedule.

### Pitfall 6: Express 5 + helmet Type Compatibility
**What goes wrong:** `@types/express@5` changed the `Request`/`Response` type signatures. Some middleware type definitions may lag behind.
**Why it happens:** Express 5 GA is recent; ecosystem types are catching up.
**How to avoid:** helmet ships its own types (no `@types/helmet` needed). cors needs `@types/cors`. express-rate-limit ships own types with `express >= 4.11` peer dep. [VERIFIED: npm registry checks]
**Warning signs:** TypeScript errors about incompatible `RequestHandler` signatures.

## Code Examples

### Express Security Middleware Integration
```typescript
// apps/api/src/server.ts — middleware additions
// Source: Standard Express middleware pattern [ASSUMED]

import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

const app = express();

// Security headers — disable CSP in development for Expo DevClient compat
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production',
}));

// CORS — allow requests from mobile app
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));

// Rate limiting — 100 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});
app.use(limiter);

// Body parsing
app.use(express.json());
```

### .env.example Template (apps/api)
```bash
# apps/api/.env.example
PORT=4000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
# GOOGLE_PLACES_API_KEY=your-key  # Added in Phase 2
# CORS_ORIGIN=*                   # Restrict in production
```

### .env.example Template (apps/mobile)
```bash
# apps/mobile/.env.example
EXPO_PUBLIC_API_URL=http://10.0.2.2:4000
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### Supabase CLI Setup Commands
```bash
# From monorepo root
npx supabase init                                           # Creates supabase/ with config.toml
npx supabase login                                          # Prompts for Personal Access Token
npx supabase link --project-ref dxkvtcpgqkbkhjshvqji        # Links to remote project

# Pull existing schema into migration file
npx supabase db pull                                        # Captures remote schema as migration
# Review generated file — remove auth/storage/realtime internal schema references
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Supabase CLI v1 `db remote commit` | Supabase CLI v2 `db pull` | 2024 | `db pull` replaces the old `db remote commit` command for capturing remote schema |
| Express 4 manual error handling | Express 5 async propagation | 2025 (Express 5 GA) | No try/catch needed in async route handlers |
| helmet@7 with separate CSP package | helmet@8 unified | 2024 | CSP configuration is now inline with helmet options |
| express-rate-limit@7 `max` option | express-rate-limit@8 `limit` option | 2024 | `max` renamed to `limit`; `standardHeaders` now supports `draft-8` [VERIFIED: npm registry] |

**Deprecated/outdated:**
- `supabase db remote commit` -- replaced by `supabase db pull`
- `express-rate-limit` `max` option -- renamed to `limit` in v8
- `@types/helmet` -- helmet now ships its own types

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | helmet's default CSP blocks Expo DevClient WebSocket connections in development | Pitfall 4 | Low -- worst case, dev experience is slightly degraded; fix is simple config change |
| A2 | `cors({ origin: '*' })` is sufficient for mobile app during development | Code Examples | Low -- mobile apps don't send Origin headers in the same way browsers do; may need adjustment |
| A3 | GitHub Actions cron `*/3` syntax runs every 3 days | Pattern 4 | Medium -- if it doesn't fire frequently enough, Supabase could pause; manual workflow_dispatch is fallback |
| A4 | The curl approach to the PostgREST endpoint counts as database activity for Supabase auto-pause prevention | Pattern 4 | Medium -- if it doesn't count, switch to a Node.js script that runs an actual SQL query |
| A5 | `supabase db pull -s public` correctly limits output to public schema only | Pitfall 1 | Low -- if flag doesn't work exactly as expected, manual editing of the generated file is the fallback |

## Open Questions

1. **Supabase db pull schema filtering**
   - What we know: `supabase db pull` captures the remote schema; `-s` flag exists for schema filtering
   - What's unclear: Whether the generated migration from the existing MCP-applied schema will be clean enough to re-apply on a fresh project without manual editing
   - Recommendation: Pull the schema, review the file, and manually clean if needed. This is a one-time operation.

2. **Render blueprint rootDir behavior with pnpm monorepo**
   - What we know: Render's rootDir sets the working directory for build/start commands
   - What's unclear: Whether Render correctly resolves pnpm workspace dependencies when rootDir is a subdirectory
   - Recommendation: Use `pnpm install` (not `npm install`) in the buildCommand. Test deployment after committing render.yaml.

3. **render.yaml location: repo root vs apps/api/**
   - What we know: D-09 says `apps/api/render.yaml`, Render docs say it auto-detects at repo root
   - What's unclear: Whether Render auto-detects render.yaml in subdirectories, or only at repo root
   - Recommendation: Place at repo root for reliable auto-detection. If D-09 strictly requires apps/api/, note that manual Render dashboard configuration may be needed as fallback. [ASSUMED]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Everything | Yes | v22.16.0 | -- |
| pnpm | Package management | Yes | 10.17.0 | -- |
| Turbo | Task orchestration | Yes | 2.9.4 | -- |
| Supabase CLI (npx) | Migration management | Yes | 2.89.1 | -- |
| GitHub CLI | Repo secret management | Yes | 2.86.0 | Manual GitHub UI |
| Git | Version control | Yes | (implicit) | -- |
| Render account | Deployment | Unknown | -- | Manual setup via Render dashboard |
| GitHub Actions | Keep-alive cron | Yes (repo is on GitHub) | -- | UptimeRobot or manual cron |

**Missing dependencies with no fallback:** None identified.

**Missing dependencies with fallback:**
- Render account provisioning must be done manually via the dashboard -- render.yaml is the config, not the account setup itself.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No (Phase 3) | -- |
| V3 Session Management | No (Phase 3) | -- |
| V4 Access Control | Partial | RLS policies already applied; `requireAuth` middleware exists |
| V5 Input Validation | Minimal | express.json() body parsing; Zod validation planned for shared package |
| V6 Cryptography | No | -- |
| V7 Error Handling | Yes | Express 5 async error propagation; need global error handler |
| V8 Data Protection | Yes | .env files excluded from git; secrets via Render env vars |
| V13 API Security | Yes | helmet (security headers), cors, express-rate-limit |
| V14 Configuration | Yes | .env.example docs; no secrets in code |

### Known Threat Patterns for Express + Supabase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Missing security headers | Information Disclosure | helmet middleware [VERIFIED: npm] |
| Unrestricted CORS | Spoofing | cors middleware with explicit origin list |
| API abuse / DDoS | Denial of Service | express-rate-limit with sensible defaults |
| Secrets in source control | Information Disclosure | .env in .gitignore; .env.example as template |
| Service role key exposure | Elevation of Privilege | Service role key only in server-side .env, never in mobile app |

## Sources

### Primary (HIGH confidence)
- [npm registry] -- helmet@8.1.0, cors@2.8.6, @types/cors@2.8.19, express-rate-limit@8.3.2 version verification
- [Codebase] -- All existing file contents verified via direct file reads
- [Supabase CLI reference: db push](https://supabase.com/docs/reference/cli/supabase-db-push) -- migration push workflow
- [Supabase CLI reference: db pull](https://supabase.com/docs/reference/cli/supabase-db-pull) -- schema capture workflow
- [Supabase Database Migrations](https://supabase.com/docs/guides/deployment/database-migrations) -- migration directory structure, workflow
- [Render Blueprint Spec](https://render.com/docs/blueprint-spec) -- render.yaml format and field definitions

### Secondary (MEDIUM confidence)
- [DEV Community: Supabase keep-alive](https://dev.to/jps27cse/how-to-prevent-your-supabase-project-database-from-being-paused-using-github-actions-3hel) -- GitHub Actions cron pattern
- [Supabase CLI Getting Started](https://supabase.com/docs/guides/local-development/cli/getting-started) -- supabase init behavior

### Tertiary (LOW confidence)
- helmet CSP behavior with Expo DevClient -- based on training knowledge, not verified in this session
- CORS behavior with React Native mobile requests -- training knowledge assumption

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all packages verified against npm registry; versions confirmed
- Architecture: HIGH -- existing codebase fully audited; gaps identified with certainty
- Supabase CLI workflow: MEDIUM -- official docs verified but `db pull` on this specific project not tested yet
- Pitfalls: MEDIUM -- mix of verified issues (missing dev script) and assumed issues (helmet CSP)
- Render deployment: MEDIUM -- blueprint spec verified but actual deployment not tested

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (stable infrastructure; no fast-moving APIs)
