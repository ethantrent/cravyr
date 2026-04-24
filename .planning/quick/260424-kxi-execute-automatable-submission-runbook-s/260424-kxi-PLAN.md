---
phase: 260424-kxi
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/mobile/app.config.ts
  - apps/mobile/.gitignore
autonomous: true
requirements:
  - SUBMISSION-RUNBOOK §2 (Supabase migrations)
  - SUBMISSION-RUNBOOK §3 (Render deploy verification — read-only)
  - SUBMISSION-RUNBOOK §4 ISSUE 1 (version 0.0.1 → 1.0.0)
  - SUBMISSION-RUNBOOK §4 ISSUE 2 (ios.buildNumber '1')
  - SUBMISSION-RUNBOOK §4 ISSUE 3 (android.versionCode 1)
  - SUBMISSION-RUNBOOK §4 ISSUE 4 (ITSAppUsesNonExemptEncryption false)
  - SUBMISSION-RUNBOOK §4 ISSUE 7 (google-sa.json in .gitignore)

must_haves:
  truths:
    - "Supabase production DB has push_tokens table and restaurants.lat/lng columns (migrations applied)"
    - "https://cravyr-api.onrender.com/health returns HTTP 200"
    - "https://cravyr-api.onrender.com/privacy returns HTTP 200 and contains 'Privacy Policy'"
    - "apps/mobile/app.config.ts version is '1.0.0' (not '0.0.1')"
    - "apps/mobile/app.config.ts declares ios.buildNumber '1' and android.versionCode 1"
    - "apps/mobile/app.config.ts declares ios.infoPlist.ITSAppUsesNonExemptEncryption: false"
    - "apps/mobile/.gitignore contains 'google-sa.json' so the key is never committed if generated later"
    - "`npx expo config --type public` output reflects all edits correctly"
  artifacts:
    - path: "apps/mobile/app.config.ts"
      provides: "Expo app config with production-ready version/build numbers and export compliance flag"
      contains: "version: '1.0.0'"
    - path: "apps/mobile/.gitignore"
      provides: ".gitignore entry for Google Play service account key"
      contains: "google-sa.json"
  key_links:
    - from: "apps/mobile/app.config.ts"
      to: "Expo build pipeline (eas build)"
      via: "version / buildNumber / versionCode read during build"
      pattern: "version.*1\\.0\\.0"
    - from: "supabase/migrations/*.sql"
      to: "Supabase production database"
      via: "supabase db push CLI"
      pattern: "supabase db push"
---

<objective>
Execute the automatable subset of the production submission runbook: apply pending Supabase migrations, verify the Render-hosted API is reachable (for privacy policy URL), fix 4 mobile config blockers (ISSUES 1-4) in `app.config.ts`, ensure `google-sa.json` is gitignored (ISSUE 7), and validate the effective Expo config.

Purpose: Unblock the remaining human-only steps (Apple Developer portal, EAS build, App Store submit) by completing every task that does not require external account access. The human-required steps (ISSUE 5 AASA, ISSUE 6 ascAppId, ISSUES involving Apple/Google/GitHub credentials) are explicitly deferred — see "Explicitly out of scope" below.

Output:
- Updated `apps/mobile/app.config.ts` (version, ios.buildNumber, android.versionCode, ios.infoPlist.ITSAppUsesNonExemptEncryption)
- `google-sa.json` entry in `apps/mobile/.gitignore`
- Verified migration + Render health results recorded in the quick task SUMMARY
- `npx expo config --type public` output snippet confirming correctness
</objective>

<execution_context>
@C:/Users/ethan/foodies/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/ethan/foodies/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/marketing/SUBMISSION-RUNBOOK.md
@apps/mobile/app.config.ts
@apps/mobile/eas.json
@apps/mobile/.gitignore
@supabase/config.toml

<codebase_facts>
<!-- These are LOAD-BEARING facts the executor must not re-derive. -->

- **Supabase CLI workspace location.** The Supabase workspace is at repo root: `C:/Users/ethan/foodies/supabase/` (confirmed via `supabase/config.toml` with `project_id = "foodies"`). The runbook §2 says `cd apps/api && npx supabase db push`, but `apps/api/supabase/` does NOT exist. **Correct command is `npx supabase db push` from the repo root.** Do not `cd apps/api` — it has no supabase workspace.

- **Migrations present on disk** (under `supabase/migrations/`):
  - `20260411000000_remote_schema.sql`
  - `20260411100000_geo_cache.sql`
  - `20260415000000_add_lat_lng_columns.sql` (the one the runbook calls out)
  - `20260415100000_push_tokens.sql` (the one the runbook calls out)
  - `20260424120000_push_sends.sql`
  `supabase db push` applies anything not already on remote — already-applied migrations are skipped. Expect the CLI to list pending ones and prompt `[Y/n]` for confirmation.

- **Render service URL**: `https://cravyr-api.onrender.com` (confirmed in `apps/mobile/eas.json:22` as `EXPO_PUBLIC_API_URL`). The `/privacy` route is served from `apps/api/src/public/privacy.html`.

- **Current app.config.ts state** (verified by reading file):
  - Line 7: `version: '0.0.1'` — needs 1.0.0 (ISSUE 1)
  - Lines 17-25 (`ios: { ... }`) — no `buildNumber` field (ISSUE 2)
  - Lines 21-24 (`ios.infoPlist`) — only has `NSLocationWhenInUseUsageDescription`; missing `ITSAppUsesNonExemptEncryption` (ISSUE 4)
  - Lines 26-33 (`android: { ... }`) — no `versionCode` field (ISSUE 3)
  - ISSUE 5 (associatedDomains) is EXPLICITLY SKIPPED per planning scope: no AASA file is hosted, and adding the entry would emit a build warning.

- **Current `apps/mobile/.gitignore` contents** (13 lines, verified):
  ```
  # @generated expo-cli sync-2b81b286409207a5da26e14c78851eb30d8ccbdb
  # The following patterns were generated by expo-cli

  expo-env.d.ts
  # @end expo-cli

  # Native build directories (generated by expo prebuild / expo run:android)
  android/
  ios/

  # Throwaway icon preview candidates (produced by scripts/generate-app-icons.mjs --preview)
  assets/_preview/
  ```
  `google-sa.json` is NOT currently listed. Must be added (ISSUE 7).

- **Supabase CLI install status**: CLI is installed on the developer machine per the planning context description ("the CLI is installed on this machine").

- **`apps/mobile/eas.json:29`** still has `"ascAppId": "YOUR_APP_STORE_CONNECT_ID"`. ISSUE 6 is OUT OF SCOPE for this plan (requires App Store Connect numeric ID).
</codebase_facts>

<explicitly_out_of_scope>
Do NOT attempt (these are human-action-required and live in follow-up tasks):
- ISSUE 5: Adding `associatedDomains` to `ios` block. No AASA file is hosted; runbook explicitly says "do NOT add this entry — an unmatched associatedDomain emits a build warning."
- ISSUE 6: Replacing `ascAppId` in `eas.json`. Requires the numeric App Store Connect App ID (only available after App Store Connect app record creation — runbook §6 step 2).
- Generating `apps/mobile/google-sa.json` itself. Only the `.gitignore` entry is in scope — the JSON key file is generated by a human in Google Cloud IAM.
- Apple Developer portal setup (runbook §5)
- App Store Connect record (runbook §6)
- EAS credentials (runbook §7)
- GitHub secret `EXPO_TOKEN` (runbook §8)
- `eas build` / `eas submit` (runbook §9, §11, §12)
- Screenshot capture (runbook §10)
- Final submission (runbook §13)
</explicitly_out_of_scope>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Apply Supabase migrations and verify Render API reachability</name>
  <files>
    <!-- Read-only; no files modified. Results recorded in SUMMARY. -->
  </files>
  <action>
Execute two read-only verification steps from the runbook. No code changes.

**Step 1.1 — Apply pending Supabase migrations.**

From repo root (NOT `apps/api`; see codebase_facts — the supabase workspace is at repo root):

```bash
npx supabase db push
```

Expected behaviour:
- The CLI lists any pending migrations from `supabase/migrations/` that are not yet applied on the linked production project.
- If prompted `Do you want to push these migrations to the remote database? [Y/n]`, answer `y` (or rerun with `--yes` if the CLI supports it non-interactively: `npx supabase db push --yes`).
- If the CLI reports "Remote database is up to date" / "No migrations to apply", that is a valid pass — the target migrations (`20260415000000_add_lat_lng_columns.sql`, `20260415100000_push_tokens.sql`, `20260424120000_push_sends.sql`) were likely already applied in a prior session.
- If the CLI errors with "Cannot find project ref" / "not linked", record the exact error in the SUMMARY and stop — this requires `npx supabase link --project-ref <ref>` which needs human credentials. Do NOT attempt to guess the project ref.

Capture the full CLI output (or the error) for the SUMMARY.

**Step 1.2 — Verify Render API reachability (READ-ONLY, no code change).**

```bash
curl -sS -o /dev/null -w "%{http_code}\n" https://cravyr-api.onrender.com/health
curl -sS -o /dev/null -w "%{http_code}\n" https://cravyr-api.onrender.com/privacy
curl -sS https://cravyr-api.onrender.com/privacy | grep -c "Privacy Policy"
```

Expected:
- `/health` → `200`
- `/privacy` → `200`
- `grep -c "Privacy Policy"` → >= `1`

If `/privacy` is not 200, the API may be on the Render Free tier cold-starting (25-60s first hit). If first curl returns a 5xx or times out, wait ~60s and retry once. If still failing after a retry, record the failure in the SUMMARY — this is a blocker for App Store submission (privacy URL required) but is not fixable from this task (requires Render dashboard access or upgrade to Starter).

Capture all three HTTP codes and the grep count for the SUMMARY.
  </action>
  <verify>
    <automated>
# Both commands must succeed end-to-end. Status codes recorded in task output.
npx supabase db push --help > /dev/null && echo "CLI present" || echo "CLI MISSING"
curl -sS -o /dev/null -w "health=%{http_code}\n" https://cravyr-api.onrender.com/health
curl -sS -o /dev/null -w "privacy=%{http_code}\n" https://cravyr-api.onrender.com/privacy
    </automated>
  </verify>
  <done>
- `npx supabase db push` ran; output captured (either "applied N migrations" or "up to date" or an error with exact text preserved)
- `/health` returns 200; `/privacy` returns 200 AND body contains "Privacy Policy"
- All results (migration output + three curl outputs) are copied verbatim into the task SUMMARY so a follow-up human runbook step can cross-reference them
- If any step failed in a way not fixable without credentials, the exact failure is recorded — do NOT mark the task blocked; record and move on to Task 2 (which is fully independent)
  </done>
</task>

<task type="auto">
  <name>Task 2: Apply config ISSUES 1-4 + ISSUE 7 and verify with expo config</name>
  <files>
    apps/mobile/app.config.ts
    apps/mobile/.gitignore
  </files>
  <action>
Apply four specific edits to `apps/mobile/app.config.ts` and one edit to `apps/mobile/.gitignore`. Then run `npx expo config --type public` and verify the effective config matches expectations.

**Step 2.1 — Edit `apps/mobile/app.config.ts`.**

Apply these four changes (exact text, no other edits):

1. **ISSUE 1** — Line 7: change `version: '0.0.1',` to `version: '1.0.0',`.

2. **ISSUE 2** — Inside the `ios: { ... }` block (currently lines 17-25), add `buildNumber: '1',` immediately after `bundleIdentifier: 'com.cravyr.app',` (line 19). Place it on its own line with 4-space indentation to match surrounding style. Final ios block shape:
   ```ts
   ios: {
     supportsTablet: false,
     bundleIdentifier: 'com.cravyr.app',
     buildNumber: '1',
     usesAppleSignIn: true,
     infoPlist: {
       NSLocationWhenInUseUsageDescription:
         'Cravyr uses your location to find restaurants near you and show distance information.',
       ITSAppUsesNonExemptEncryption: false,
     },
   },
   ```
   Note both ISSUE 2 (buildNumber) and ISSUE 4 (ITSAppUsesNonExemptEncryption) appear above — apply both in one pass.

3. **ISSUE 3** — Inside the `android: { ... }` block (currently lines 26-33), add `versionCode: 1,` immediately after `package: 'com.cravyr.app',` (line 31). Final android block shape:
   ```ts
   android: {
     adaptiveIcon: {
       foregroundImage: './assets/adaptive-icon.png',
       backgroundColor: '#f97316',
     },
     package: 'com.cravyr.app',
     versionCode: 1,
     permissions: ['ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION'],
   },
   ```

4. **ISSUE 4** — Inside `ios.infoPlist`, add `ITSAppUsesNonExemptEncryption: false,` after `NSLocationWhenInUseUsageDescription` (shown in the ios block above). The value is a boolean `false` (no quotes) — Expo passes this through to Info.plist where it serializes as `<false/>`.

**DO NOT** touch any other line. Specifically, do NOT add `associatedDomains` (ISSUE 5 is deferred — no AASA file hosted), do NOT touch `expo-location` / `expo-notifications` / `expo-apple-authentication` plugin config, do NOT change the `NSLocationWhenInUseUsageDescription` wording (App Store rejection risk).

**Step 2.2 — Edit `apps/mobile/.gitignore`.**

Append a new section to `apps/mobile/.gitignore` so that `google-sa.json` is never accidentally committed. Add these lines at the end of the file:

```

# Google Play service account key (generated at Google Cloud IAM; required by eas submit --platform android per eas.json:33)
google-sa.json
```

(Leading blank line preserves existing trailing style; do not remove existing entries.)

**Step 2.3 — Verify with `npx expo config --type public`.**

From `apps/mobile/`:

```bash
cd apps/mobile && npx expo config --type public
```

This prints the full effective Expo config as JSON. Filter or eyeball for these exact values:
- `"version": "1.0.0"`
- `"ios": { ..., "buildNumber": "1", ... }` (Expo stringifies to `"1"` even though the source is `'1'`)
- `"ios": { "infoPlist": { ..., "ITSAppUsesNonExemptEncryption": false, ... } }`
- `"android": { ..., "versionCode": 1, ... }`
- `"ios": { "infoPlist": { "NSLocationWhenInUseUsageDescription": "Cravyr uses your location to find restaurants near you and show distance information." } }` (must remain unchanged)

If `jq` is available on the machine, the runbook's shorthand is:
```bash
cd apps/mobile && npx expo config --type public | jq '{version, ios, android}'
```
(`jq` is not strictly required — grep or visual inspection of the JSON is sufficient.)

Capture the relevant fragment of the output in the task SUMMARY.

**Step 2.4 — Verify `.gitignore` entry is effective.**

```bash
cd apps/mobile && git check-ignore -v google-sa.json
```

Expected: output shows `.gitignore:N:google-sa.json  google-sa.json` (confirms the pattern matches). If `git check-ignore` exits non-zero with no output, the pattern did not register — re-check the `.gitignore` edit.
  </action>
  <verify>
    <automated>
cd apps/mobile && npx expo config --type public | grep -E '"version"|"buildNumber"|"versionCode"|"ITSAppUsesNonExemptEncryption"' && cd apps/mobile && git check-ignore -v google-sa.json 2>/dev/null || echo "gitignore check exit=$?"
    </automated>
  </verify>
  <done>
- `apps/mobile/app.config.ts` line with `version:` contains `'1.0.0'`
- The string `buildNumber: '1'` appears inside the `ios:` block
- The string `ITSAppUsesNonExemptEncryption: false` appears inside `ios.infoPlist`
- The string `versionCode: 1` appears inside the `android:` block
- No other fields in `app.config.ts` were modified (diff should show exactly 4 additions and 1 replacement)
- `apps/mobile/.gitignore` contains a `google-sa.json` line and `git check-ignore` confirms it matches
- `npx expo config --type public` output shows the expected values verbatim
- `NSLocationWhenInUseUsageDescription` string is UNCHANGED (word-for-word preservation is a submission-blocker if altered)
- `associatedDomains` is NOT added (ISSUE 5 is intentionally deferred)
- `eas.json:29` ascAppId is UNCHANGED (ISSUE 6 is out of scope)
  </done>
</task>

</tasks>

<verification>
**Task 1 verification:**
- `npx supabase db push` executed; outcome recorded (applied / up-to-date / error).
- `curl https://cravyr-api.onrender.com/health` returns 200.
- `curl https://cravyr-api.onrender.com/privacy` returns 200 AND body contains "Privacy Policy".

**Task 2 verification:**
- `apps/mobile/app.config.ts` diff shows exactly: version '0.0.1' → '1.0.0', added `buildNumber: '1',`, added `ITSAppUsesNonExemptEncryption: false,`, added `versionCode: 1,`. No other changes.
- `apps/mobile/.gitignore` diff shows added `google-sa.json` entry; `git check-ignore` confirms pattern.
- `npx expo config --type public` output contains all four expected values.

**Overall:** STATE.md item #1 (Supabase migrations) is either complete or has a specific recorded blocker. Runbook §4 ISSUES 1-4 + ISSUE 7 gitignore are closed. Runbook §5-13 remain open and are documented in the SUMMARY as next human actions.
</verification>

<success_criteria>
- [ ] `npx supabase db push` was executed from repo root; output captured in SUMMARY
- [ ] `curl /health` = 200, `curl /privacy` = 200, `/privacy` body contains "Privacy Policy"
- [ ] `apps/mobile/app.config.ts` version is `'1.0.0'`
- [ ] `apps/mobile/app.config.ts` ios block contains `buildNumber: '1',`
- [ ] `apps/mobile/app.config.ts` ios.infoPlist contains `ITSAppUsesNonExemptEncryption: false,`
- [ ] `apps/mobile/app.config.ts` android block contains `versionCode: 1,`
- [ ] `apps/mobile/app.config.ts` NSLocationWhenInUseUsageDescription string is unchanged (word-for-word)
- [ ] `apps/mobile/app.config.ts` has NO `associatedDomains` entry (ISSUE 5 intentionally deferred)
- [ ] `apps/mobile/.gitignore` contains `google-sa.json`
- [ ] `apps/mobile/eas.json` `ascAppId` is UNCHANGED (still placeholder — ISSUE 6 out of scope)
- [ ] `npx expo config --type public` output reflects all four changes
- [ ] Commit created with scope `quick(260424-kxi)` touching only the two files above
- [ ] SUMMARY enumerates remaining human-required runbook sections (§5-13) as the next step
</success_criteria>

<output>
After completion, create `.planning/quick/260424-kxi-execute-automatable-submission-runbook-s/260424-kxi-SUMMARY.md`.

The SUMMARY must include:
1. **Migration outcome** — verbatim output (or error) from `npx supabase db push`
2. **Render health** — the three curl status codes and the grep count for "Privacy Policy"
3. **Config diff** — the 5 lines added/changed in `app.config.ts` + the `.gitignore` addition
4. **`npx expo config --type public` snippet** — the `version`/`ios`/`android` fragment proving the changes took effect
5. **Explicit list of what was NOT done** (human-required):
   - ISSUE 5 (associatedDomains — no AASA file planned)
   - ISSUE 6 (ascAppId — needs App Store Connect record)
   - `google-sa.json` contents (only the gitignore entry was added; the JSON key itself must be generated in Google Cloud IAM)
   - Runbook §1 (credentials), §5 (Apple Developer), §6 (App Store Connect), §7 (EAS credentials), §8 (GitHub secrets), §9 (EAS build), §10 (screenshots), §11 (TestFlight), §12 (Google Play), §13 (final submit)
6. **Next action** — "Execute runbook §5 (Apple Developer portal setup)" with a link to the runbook location
</output>
