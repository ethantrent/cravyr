---
phase: quick-260702-dpv
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - supabase/migrations/20260702000000_database_size_rpc.sql
  - .github/workflows/supabase-keepalive.yml
  - .planning/STATE.md
autonomous: true
requirements: []
must_haves:
  truths:
    - "The supabase-keepalive workflow fails (non-zero exit) when DB size exceeds ~400MB, triggering GitHub's failure email"
    - "STATE.md Human Actions lists the Google Cloud billing alert ($50/day) setup task"
    - "STATE.md records Render free-tier cold-start as an accepted known limitation"
  artifacts:
    - "supabase/migrations/20260702000000_database_size_rpc.sql (database_size_bytes RPC)"
    - ".github/workflows/supabase-keepalive.yml (with size-check step)"
  key_links:
    - "Workflow REST call to /rest/v1/rpc/database_size_bytes using existing SUPABASE_URL + SUPABASE_ANON_KEY secrets"
    - "RPC GRANT EXECUTE to anon so the anon-key REST call can invoke it"
---

<objective>
Close the three remaining PITFALLS.md open items: (1) add a DB-size guard to the existing Supabase keep-alive workflow so it fails loudly (GitHub Actions failure → email) when the free-tier 500MB limit is approached; (2) record the Google Cloud billing-alert setup as a Human Action; (3) document Render free-tier cold-start as an accepted known limitation.

Purpose: Prevent silent DB read-only mode at 500MB (Pitfall 8) and runaway Places API spend, and formally accept the cold-start tradeoff the user chose.
Output: New RPC migration, extended workflow, two STATE.md edits.
</objective>

<execution_context>
@/Users/ethan/Desktop/cravyr/.claude/gsd-core/workflows/execute-plan.md
@/Users/ethan/Desktop/cravyr/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.github/workflows/supabase-keepalive.yml
@supabase/migrations/20260411100000_geo_cache.sql
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add database_size_bytes RPC migration</name>
  <files>supabase/migrations/20260702000000_database_size_rpc.sql</files>
  <action>Create a new migration following the existing convention (SECURITY DEFINER function, matching the style in 20260411100000_geo_cache.sql). Define public.database_size_bytes() RETURNS bigint, LANGUAGE sql, SECURITY DEFINER, SET search_path TO 'public', body returning pg_database_size(current_database()). GRANT EXECUTE ON FUNCTION public.database_size_bytes() TO anon, authenticated so the workflow's anon-key REST call can invoke it via POST /rest/v1/rpc/database_size_bytes. Add a leading comment noting this exposes only an aggregate byte count (no row data) and exists to power the CI size-guard. Timestamp 20260702000000 places it after the latest existing migration (20260720000000 is a future-dated logical name but this DHHMMSS prefix sorts correctly; use 20260702000000 to reflect actual authoring date and keep it lexically before the 2027-range — confirm it sorts after 20260621 and before 20260710; if lexical ordering with 20260710000000_multiplayer_matches.sql matters for a fresh `db push`, this migration is additive/idempotent and order-independent, so ordering is not a correctness concern).</action>
  <verify>
    <automated>test -f supabase/migrations/20260702000000_database_size_rpc.sql &amp;&amp; grep -q 'pg_database_size' supabase/migrations/20260702000000_database_size_rpc.sql &amp;&amp; grep -q 'GRANT EXECUTE' supabase/migrations/20260702000000_database_size_rpc.sql</automated>
  </verify>
  <done>Migration file exists defining database_size_bytes() as SECURITY DEFINER returning pg_database_size, with EXECUTE granted to anon/authenticated.</done>
</task>

<task type="auto">
  <name>Task 2: Add DB-size guard step to keep-alive workflow</name>
  <files>.github/workflows/supabase-keepalive.yml</files>
  <action>Append a second step (after the existing ping step, reusing the same SUPABASE_URL and SUPABASE_ANON_KEY env block) named "Check database size". Use curl to POST to ${SUPABASE_URL}/rest/v1/rpc/database_size_bytes with headers apikey: ${SUPABASE_ANON_KEY}, Authorization: Bearer ${SUPABASE_ANON_KEY}, and Content-Type: application/json (empty JSON body {}). The RPC returns a bare integer (bytes). Capture it, echo the size in MB for the run log. Set a threshold of 419430400 bytes (400 MiB). If the returned value is non-numeric (RPC not yet applied — migration is human-applied via supabase db push), echo a warning and exit 0 (do not fail the keep-alive on a missing RPC). If numeric and greater than the threshold, echo an ERROR line stating the DB is approaching the 500MB free-tier limit and exit 1 so GitHub sends a failure notification email. Keep it POSIX-sh compatible (default `run:` shell). Do not modify the existing ping step or the cron schedule.</action>
  <verify>
    <automated>grep -q 'database_size_bytes' .github/workflows/supabase-keepalive.yml &amp;&amp; grep -q '419430400' .github/workflows/supabase-keepalive.yml &amp;&amp; python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/supabase-keepalive.yml'))"</automated>
  </verify>
  <done>Workflow has a second step that queries database_size_bytes via REST, exits 1 above 400MiB, exits 0 (with warning) if the RPC is absent, and the YAML parses. Existing ping step and schedule unchanged.</done>
</task>

<task type="auto">
  <name>Task 3: Update STATE.md — billing alert Human Action + cold-start accepted risk</name>
  <files>.planning/STATE.md</files>
  <action>Two edits. (A) In "Human Actions Required" (numbered list near bottom), append a new item: "Set up a Google Cloud billing alert ($50/day) on the Places API project (Cloud Console → Billing → Budgets & alerts) — guards against Pitfall 2 field-mask cost blowout." (B) In "Accumulated Context > Key Decisions", append a bullet recording the accepted risk: note that Render free-tier cold-start (25–60s on the first request after 15 min idle) is an ACCEPTED known limitation — the user deliberately keeps render.yaml plan: free and 800px photo widths as-is; UptimeRobot/paid Starter upgrade explicitly deferred. Also note the DB-size CI guard (this task, quick 260702-dpv) now fails the keep-alive workflow above ~400MB (migration 20260702000000_database_size_rpc.sql requires `supabase db push`). Do not alter render.yaml or photo sizing anywhere. Update the front-matter last_updated only if trivially consistent; otherwise leave it.</action>
  <verify>
    <automated>grep -q 'billing alert' .planning/STATE.md &amp;&amp; grep -qi 'cold-start' .planning/STATE.md &amp;&amp; grep -q '400MB\|400 MB\|~400' .planning/STATE.md</automated>
  </verify>
  <done>STATE.md Human Actions lists the Google Cloud billing alert; Key Decisions records the Render cold-start accepted risk and the new DB-size guard. render.yaml and photo sizing untouched.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| GitHub Actions → Supabase REST | Anon-key request from CI crosses into the DB via a SECURITY DEFINER RPC |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-dpv-01 | Information Disclosure | database_size_bytes RPC exposed to anon | low | accept | RPC returns only an aggregate byte count (no row/user data); DB size is not sensitive. GRANT limited to anon/authenticated, no arguments accepted. |
| T-dpv-02 | Elevation of Privilege | SECURITY DEFINER function | low | mitigate | Function takes no parameters, contains no dynamic SQL, and only calls pg_database_size(current_database()) — no injection surface. |
| T-dpv-SC | Tampering | npm/pip/cargo installs | n/a | accept | No package installs in this plan (workflow + SQL + docs only). |
</threat_model>

<verification>
- Migration file present with pg_database_size + GRANT EXECUTE.
- Workflow YAML parses and contains the size-check step (threshold 419430400, RPC path).
- STATE.md contains billing-alert action and cold-start accepted-risk note.
- render.yaml and photo-width config unchanged (git diff shows no changes to render.yaml or photo sizing).
</verification>

<success_criteria>
- Keep-alive workflow fails loudly above ~400MB and stays green (with a warning) until the RPC migration is applied.
- Google Cloud billing alert recorded as a Human Action.
- Render cold-start documented as an accepted limitation.
</success_criteria>

<output>
Create `.planning/quick/260702-dpv-address-pitfalls-md-open-items-db-size-c/260702-dpv-SUMMARY.md` when done. Note in the summary that migration 20260702000000_database_size_rpc.sql must be applied to remote via `supabase db push` (human action) before the workflow size-check becomes active.
</output>
