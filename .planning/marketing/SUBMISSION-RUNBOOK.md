# Cravyr Production Submission Runbook

This is the only file you need to follow to get Cravyr from code-complete to live in the App Store and Google Play. It consolidates the 9 "Human Actions Required" tasks from `.planning/STATE.md` into an ordered, copy-pasteable checklist covering credentials, migrations, API deploy, config fixes, Apple Developer portal setup, App Store Connect, EAS credentials, GitHub secrets, production build, screenshots, TestFlight, Google Play Console, and final submission. Open this file, work top to bottom, and do not skip a section — each step has acceptance criteria so you know when it is done. Config validation findings are embedded below so you never have to open `apps/mobile/app.config.ts` blind — every issue is listed with file, line, current text, problem, and exact replacement. When in doubt, run the Quick Sanity Command at the top of this file.

## Quick Sanity Command

Run this after every config change to confirm Expo's effective config matches what you expect:

```bash
cd apps/mobile && npx expo config --type public | jq '{version, ios, android}'
```

Expected after all fixes in section 4: `version` is `"1.0.0"`; `ios.buildNumber` is `"1"`; `android.versionCode` is `1`; `ios.infoPlist.ITSAppUsesNonExemptEncryption` is `false`; `ios.infoPlist.NSLocationWhenInUseUsageDescription` references "restaurants near you and show distance information."

## Config Validation Findings

Pre-computed read-only validation pass against `apps/mobile/app.config.ts` and `apps/mobile/eas.json`. This section is informational — you apply these fixes at step 4 below, not here.

### PASS — Verified OK (no action required)

- `ios.bundleIdentifier` = `'com.cravyr.app'` (apps/mobile/app.config.ts:19) — not default
- `android.package` = `'com.cravyr.app'` (apps/mobile/app.config.ts:31) — matches iOS naming
- `NSLocationWhenInUseUsageDescription` (apps/mobile/app.config.ts:22-23) — specific, mentions "restaurants near you and show distance"
- `expo-location` `locationWhenInUsePermission` (apps/mobile/app.config.ts:47-48) — matches iOS string
- `scheme` = `'cravyr'` (apps/mobile/app.config.ts:58) — Expo Router deep links working
- `expo-notifications` plugin icon + color = `#f97316` (apps/mobile/app.config.ts:37-43) — verified
- `android.adaptiveIcon.backgroundColor` = `'#f97316'` (apps/mobile/app.config.ts:29) — set
- `android.permissions` (apps/mobile/app.config.ts:32) — only `ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION`; no unused CAMERA / READ_EXTERNAL_STORAGE

### FAIL / BLOCKER — ISSUE entries

```
ISSUE 1: version below 1.0.0
File: apps/mobile/app.config.ts:7
Current: version: '0.0.1'
Problem: Apple and Google expect a production submission to be >= 1.0.0. Reviewers occasionally question sub-1.0 versions as "unfinished" and it locks you out of marketing copy that references "v1.0".
Fix: version: '1.0.0'
```

```
ISSUE 2: ios.buildNumber missing
File: apps/mobile/app.config.ts (inside `ios: { ... }`, after bundleIdentifier around line 19-20)
Current: (absent)
Problem: EAS `autoIncrement: true` handles this for subsequent builds, but the first build needs an explicit baseline. Without it some CI paths log warnings.
Fix: Add inside `ios: { ... }`:
    buildNumber: '1',
```

```
ISSUE 3: android.versionCode missing
File: apps/mobile/app.config.ts (inside `android: { ... }`, after package around line 31-32)
Current: (absent)
Problem: Same as ISSUE 2 — explicit baseline needed before autoIncrement takes over.
Fix: Add inside `android: { ... }`:
    versionCode: 1,
```

```
ISSUE 4: ITSAppUsesNonExemptEncryption missing (export compliance)
File: apps/mobile/app.config.ts:21-24 (inside ios.infoPlist)
Current: Only NSLocationWhenInUseUsageDescription declared
Problem: Every App Store submission otherwise prompts "Does your app use encryption?" and blocks the build until answered. Declaring `false` (Cravyr only uses HTTPS, which is exempt) avoids the prompt on every submission.
Fix: Add inside `ios.infoPlist`:
    ITSAppUsesNonExemptEncryption: false,
```

```
ISSUE 5: associatedDomains missing (deep links / AASA)
File: apps/mobile/app.config.ts (inside `ios: { ... }`)
Current: (absent)
Problem: Privacy policy and future marketing links will deep-link into the app. Without `associatedDomains`, iOS cannot resolve universal links from a hosted `apple-app-site-association` file.
Fix: Add inside `ios: { ... }` — ONLY if a hosted AASA file at the domain is planned; otherwise note as "deferred to post-launch" and skip this ISSUE:
    associatedDomains: ['applinks:cravyr.app'],
Note: gated on actually publishing an AASA file at https://cravyr.app/.well-known/apple-app-site-association. If deferred, do NOT add this entry — an unmatched associatedDomain emits a build warning.
```

```
ISSUE 6: eas.json ascAppId placeholder
File: apps/mobile/eas.json:29
Current: "ascAppId": "YOUR_APP_STORE_CONNECT_ID"
Problem: `eas submit` will fail. The real ID is the 10-digit numeric App Store Connect App ID from the app record.
Fix: Replace with the numeric ID from App Store Connect -> My Apps -> Cravyr -> App Information -> Apple ID. Example: "ascAppId": "6741234567"
```

```
ISSUE 7: google-sa.json referenced but not present
File: apps/mobile/eas.json:33
Current: "serviceAccountKeyPath": "./google-sa.json"
Problem: `eas submit --platform android` will fail until a Google Play service account JSON key is placed at `apps/mobile/google-sa.json` (and added to .gitignore). Generated from Google Cloud IAM with "Service Account User" role on the Play Console.
Fix: Generate JSON key, save to `apps/mobile/google-sa.json`, confirm `apps/mobile/.gitignore` contains `google-sa.json`.
```

**Apply ISSUES 1–5 to `apps/mobile/app.config.ts` and ISSUE 6–7 to `apps/mobile/eas.json` at step 4 below. Re-run the Quick Sanity Command after each edit.**

## 1. Pre-flight — Credentials & Accounts

Why this step exists: none of the sections after this can start without these accounts provisioned. Start step 1 first; Apple Developer verification takes 24–48 hours and will otherwise be your bottleneck.

- **Apple Developer Program** ($99/year) — https://developer.apple.com/programs/ — takes 24–48h for verification
- **Google Play Console** ($25 one-time) — https://play.google.com/console/signup
- **Render paid tier** ($7/month Starter) — required so the `/privacy` URL stays reachable without 25–60s cold starts during App Store review
- **Supabase project** — already provisioned (see `.planning/STATE.md`)
- **Google Cloud project with Places API enabled** — already provisioned (Phase 02)
- **Expo account** — https://expo.dev signup, then log in from the CLI:

```bash
npx expo login
```

Acceptance:
- `eas whoami` prints your Expo username
- Apple Developer membership shows "Active" at https://developer.apple.com/account
- Google Play Console shows developer account active
- Render dashboard shows the `cravyr-api` service on the Starter plan (not Free)

## 2. Apply Supabase Migrations

Why this step exists: migrations `20260415000000_add_lat_lng_columns.sql` and `20260415100000_push_tokens.sql` were authored during Phase 5 but still need to run against the production Supabase database. Without `push_tokens`, push registration writes will fail silently in production.

Commands (from repo root):

```bash
# Find migration files
ls apps/api/supabase/migrations/

# Apply via Supabase CLI (preferred)
cd apps/api && npx supabase db push

# OR via psql directly (fallback)
# SUPABASE_DB_URL is in .env.local or Supabase Dashboard -> Project Settings -> Database -> Connection string (URI)
psql "$SUPABASE_DB_URL" -f apps/api/supabase/migrations/20260415000000_add_lat_lng_columns.sql
psql "$SUPABASE_DB_URL" -f apps/api/supabase/migrations/20260415100000_push_tokens.sql
```

Acceptance:

```bash
psql "$SUPABASE_DB_URL" -c "\d push_tokens"
# -> shows the push_tokens table columns

psql "$SUPABASE_DB_URL" -c "SELECT lat, lng FROM restaurants LIMIT 1"
# -> does not error (columns exist)
```

## 3. Deploy API to Render

Why this step exists: the privacy policy is hosted by the API at `https://cravyr-api.onrender.com/privacy` (source: `apps/api/src/public/privacy.html`). App Store Connect requires a reachable Privacy Policy URL before submission, and the URL must remain reachable during review — which is why the Render Starter tier from step 1 is non-optional.

Commands:

```bash
# Render auto-deploys on push to main — trigger it:
git push origin main

# OR manually redeploy via Render dashboard -> cravyr-api -> Manual Deploy -> Deploy latest commit
```

Acceptance:

```bash
curl -sS -o /dev/null -w "%{http_code}\n" https://cravyr-api.onrender.com/health
# -> 200

curl -sS -o /dev/null -w "%{http_code}\n" https://cravyr-api.onrender.com/privacy
# -> 200

curl -sS https://cravyr-api.onrender.com/privacy | grep -c "Privacy Policy"
# -> >= 1
```

## 4. Fix Config Issues Flagged by Validation

Why this step exists: the Config Validation Findings above identified 7 blockers. Without these fixes, `eas submit` will fail, App Store export compliance will prompt on every build, and baseline version numbers are missing.

Open `apps/mobile/app.config.ts` and apply **ISSUES 1–5** from the Config Validation Findings section. Open `apps/mobile/eas.json` and apply **ISSUES 6–7** — defer ISSUE 6 (ascAppId) until step 6 below, when you have the real 10-digit ID.

After edits:

```bash
cd apps/mobile && npx expo config --type public | jq '{version, ios, android}'
```

Acceptance:
- `version` is `"1.0.0"`
- `ios.buildNumber` is `"1"`
- `android.versionCode` is `1`
- `ios.infoPlist.ITSAppUsesNonExemptEncryption` is `false`
- `ios.infoPlist.NSLocationWhenInUseUsageDescription` still matches the specific string ("Cravyr uses your location to find restaurants near you and show distance information.")
- `apps/mobile/eas.json:33` `serviceAccountKeyPath` points at `./google-sa.json` and the file exists (or will exist by step 12)

## 5. Apple Developer Portal Setup

Why this step exists: EAS cannot generate iOS build credentials (Distribution Certificate, Provisioning Profile, APNs key) without a registered Bundle ID on the developer portal. Apple Sign-In will also silently fail without the capability enabled.

Steps (Apple Developer -> Certificates, Identifiers & Profiles):

1. **Identifiers -> App IDs -> +** -> Bundle ID: `com.cravyr.app` (exact match to `apps/mobile/app.config.ts:19`)
2. Enable capabilities on that App ID:
   - Push Notifications
   - Sign in with Apple
   - Associated Domains (only if ISSUE 5 was applied in step 4)
3. **Keys -> +** -> Create an APNs Authentication Key (Apple Push Notification service). Download the `.p8` file immediately — Apple lets you download it exactly once. Save it locally as `AuthKey_<KEY_ID>.p8` and record the Key ID and Team ID somewhere safe.

Acceptance:
- Bundle ID `com.cravyr.app` appears in the Identifiers list with the three capabilities enabled
- The `.p8` key file exists locally
- Key ID and Team ID noted (both needed in step 7 when uploading to EAS)

## 6. App Store Connect — Create App Record

Why this step exists: the App Store Connect app record is required before EAS can submit a build, and the listing copy in `.planning/marketing/app-store-listing.md` needs to be pasted into the app record before review. This step also produces the real `ascAppId` that resolves ISSUE 6 from step 4.

Steps (https://appstoreconnect.apple.com -> My Apps -> +):

1. Platform: iOS. Name: **Cravyr**. Primary Language: English (U.S.). Bundle ID: `com.cravyr.app`. SKU: `cravyr-ios-001`.
2. Open the app record -> App Information -> copy the **Apple ID** (numeric, ~10 digits). This is your `ascAppId`.
3. Update `apps/mobile/eas.json:29` by replacing `"YOUR_APP_STORE_CONNECT_ID"` with the real numeric ID (this completes ISSUE 6).
4. Paste listing copy from `.planning/marketing/app-store-listing.md` into the relevant App Store Connect fields:
   - **App Name** — from `## iOS App Store -> App Name`
   - **Subtitle** — from `## iOS App Store -> Subtitle (primary)`
   - **Promotional Text** — from `## iOS App Store -> Promotional Text (primary)`
   - **Description** — the 4000-char block inside `## iOS App Store -> Description`
   - **Keywords** — the comma-separated 99/100 char string in `## iOS App Store -> Keywords` (no spaces after commas)
   - **What's New (v1.0 release notes)** — from `## iOS App Store -> What's New`
   - **Privacy Policy URL**: `https://cravyr-api.onrender.com/privacy`
   - **Support URL**: same or a dedicated page
5. **App Privacy** section — declare data collected (matches `apps/api/src/public/privacy.html`, updated 2026-07-02 for social features):
   - Contact Info (email) — linked to identity
   - Contact Info (name / display name) — linked to identity, used for app functionality (shown to connected friends in the friends list)
   - Location (coarse) — not linked, used for app functionality
   - Identifiers (device push token) — not linked, used for app functionality
   - Identifiers (User ID) — linked, used for app functionality (friend connections store links between user accounts)
   - Usage Data (swipes, saves) — linked, used for app functionality (mutually saved restaurants are visible to connected friends as "matches")

Acceptance:
- App record visible in App Store Connect
- `apps/mobile/eas.json` diff shows the real 10-digit `ascAppId` (no `YOUR_APP_STORE_CONNECT_ID` placeholder)
- All listing fields populated
- App Privacy section shows "Complete"

## 7. EAS Credentials

Why this step exists: EAS needs the Distribution Certificate, Provisioning Profile, APNs key (iOS), and a Keystore (Android) before it can produce a signed release build. Doing this once up front avoids surprises at build-submit time.

Commands:

```bash
cd apps/mobile

# Interactive credentials flow (generates / uploads certificates & provisioning profiles)
eas credentials

# When prompted:
# - Platform: iOS
# - Profile: production
# - Let EAS generate Distribution Certificate and Provisioning Profile
# - Upload the APNs .p8 key from step 5 (Push Notifications -> Add a Key)
#   Provide the Key ID and Team ID recorded in step 5

# Repeat for Android:
eas credentials
# - Platform: Android
# - Profile: production
# - Let EAS generate a new Keystore (or upload existing) — SAVE THE BACKUP
#   Losing the Android keystore means you cannot ship updates to this listing.
```

Acceptance: `eas credentials` (non-interactive list mode) shows a Distribution Certificate, Provisioning Profile, and APNs Key for iOS, and a Keystore for Android — all under the `production` profile.

## 8. GitHub Secrets

Why this step exists: the CI workflow in `.github/workflows/` expects `EXPO_TOKEN` to be available as a repository secret so it can trigger builds without an interactive login. Without it, CI-triggered builds fail immediately at `eas whoami`.

Steps (GitHub repo -> Settings -> Secrets and variables -> Actions -> New repository secret):

- **Name**: `EXPO_TOKEN`
- **Value**: generate at https://expo.dev/settings/access-tokens and paste the value

Acceptance: the secret appears in the Actions secrets list (value hidden), and the next CI run references `secrets.EXPO_TOKEN` without a "secret not found" warning.

## 9. First Production Build

Why this step exists: this is the first real release build and catches every config or dependency issue before you waste a TestFlight slot on a broken binary. `expo-doctor` surfaces most problems before the build even starts.

Commands:

```bash
cd apps/mobile

# Check expo-doctor first — fix any red errors before building
npx expo-doctor

# Build both platforms in parallel
eas build --platform all --profile production
```

Wait 15–120 minutes (free tier queue; ~15 min on Priority). Monitor at https://expo.dev/accounts/<user>/projects/cravyr/builds.

Acceptance:
- Both iOS and Android builds show status "finished" in the EAS dashboard
- Download links produce a valid `.ipa` (iOS) and `.aab` (Android)
- Build logs contain no red errors and no "associatedDomains" warnings (unless ISSUE 5 was deliberately applied)

## 10. Screenshots

Why this step exists: App Store Connect will not accept a submission without at least 3 screenshots at the required sizes, and Apple reviewers use screenshots as the first pass at the "minimum functionality" bar. Capturing them before you submit also lets you re-record any that look weak.

Required sizes (App Store Connect uploads):

- **iPhone 6.7" (required)** — **1290 × 2796** px — e.g., iPhone 16 Pro Max simulator
- **iPhone 5.5" (required, legacy)** — **1242 × 2208** px — e.g., iPhone 8 Plus simulator
- **iPad 12.9" (optional)** — 2048 × 2732 px — skip unless `ios.supportsTablet` is true (currently `false` in `apps/mobile/app.config.ts:18`, so skip)

Minimum 3 screenshots per size, maximum 10. Recommended scenes:

1. Discover screen with a swipe in progress (overlay label visible — "SAVE" or "SKIP")
2. Tonight's Picks list with 3+ saves
3. Restaurant detail with photo, hours, directions button
4. Preferences screen (cuisines / price / distance set)
5. Auth screen (Apple Sign-In button visible)

Google Play also requires at least 2 screenshots, minimum 1080 × 1920 px. A subset of the iOS screenshots usually suffices; feature graphic is a separate 1024 × 500 asset required at step 12.

Commands to capture from iOS Simulator:

```bash
# Launch a specific simulator (e.g., iPhone 16 Pro Max or iPhone 8 Plus), boot the Cravyr dev build, then:
xcrun simctl io booted screenshot /tmp/cravyr-discover.png
```

Acceptance:
- 3+ PNGs per required size (6.7" 1290×2796, 5.5" 1242×2208)
- File dimensions verified with `file /tmp/cravyr-*.png` or `identify /tmp/cravyr-*.png`
- No personal data (real names, emails, real account data) visible in any screenshot

## 11. TestFlight Internal + External

Why this step exists: at least one non-developer tester must complete the full core loop before App Store submission — this is Phase 5 Success Criterion #4. External testers require Beta App Review (24–48 hours), which you want running in parallel with any final polish.

Steps:

1. After the iOS build finishes, submit to App Store Connect:

```bash
cd apps/mobile && eas submit --platform ios --profile production --latest
```

2. Wait ~15 minutes for Apple processing; the build appears in App Store Connect -> TestFlight.
3. Complete Export Compliance: answer "No" to "uses non-exempt encryption" (matches `ITSAppUsesNonExemptEncryption: false` from ISSUE 4).
4. Create an Internal Testing group -> add yourself -> install TestFlight on your device -> run through the full core loop (onboard -> swipe -> save a pick -> open detail view -> Delete Account from Settings).
5. Create an External Testing group -> add 1–2 real testers (email addresses) -> submit for Beta App Review (24–48h).

Acceptance:
- TestFlight shows the Cravyr app icon on your test device
- At least one external tester completes onboard -> swipe -> save without guidance (Phase 5 Success Criterion #4)

## 12. Google Play Console — Internal Track -> Production

Why this step exists: Google Play requires a graduated release path (Internal -> Closed -> Production), and Data Safety + Content Rating forms must be completed before the first production push. Running Internal in parallel with iOS review shortens total submission time.

Steps:

1. Google Play Console -> **Create app** -> Cravyr -> default language English (US) -> category: Food & Drink
2. Submit the Android build:

```bash
cd apps/mobile && eas submit --platform android --profile production --latest
```

(Requires `apps/mobile/google-sa.json` from ISSUE 7 in step 4. If you deferred it, create the service account JSON key now: Google Cloud -> IAM -> Service Accounts -> create with "Service Account User" role, grant access in Play Console -> Users and permissions.)

3. Fill **Store Listing**:
   - Title, Short Description, Full Description from `.planning/marketing/app-store-listing.md` (`## Google Play Store` section)
   - Screenshots from step 10 (1080 × 1920 px minimum)
   - Feature graphic 1024 × 500 px
4. Fill **Content Rating** questionnaire (no user-generated content, no ads -> likely Everyone / PEGI 3).
5. Fill **Data safety** section (match the App Privacy declarations from step 6).
6. **Policy** -> Privacy Policy URL: `https://cravyr-api.onrender.com/privacy`
7. Push the release from Internal testing -> Closed testing -> Production. Each promotion is a separate review cycle.

Acceptance:
- Internal testing release shows "Available on Play Store for testers"
- You install via the Internal opt-in link and complete the core loop
- Data safety and Content Rating show "Complete"

## 13. Submit for Review + Rejection Remediation

Why this step exists: the final submit is one click, but the rejection remediation table below is the cheat sheet that saves you days when (not if) a rejection arrives.

Submit:

- **iOS**: App Store Connect -> App Store tab -> Create version `1.0.0` -> attach the TestFlight build -> fill "Sign in info" in App Review Information with a demo Apple ID if Apple Sign-In testing requires one -> **Submit for Review**
- **Android**: Play Console -> Production -> **Review & Roll out to Production**

Common rejection reasons and fixes:

| Rejection | Cause | Fix |
|-----------|-------|-----|
| Guideline 4.2 — Minimum Functionality | App is "too simple" | Already mitigated: onboarding + detail view + saved list + preferences + settings all present (Phase 4) |
| Guideline 5.1.1(v) — Account Deletion | No in-app account deletion | Already mitigated: Settings -> Delete Account (Phase 4, plan 04-05) |
| Guideline 5.1.1 — Location permission string | Generic wording | Already mitigated: specific string "restaurants near you and show distance" (`apps/mobile/app.config.ts:23`) |
| Guideline 4.8 — Sign in with Apple | Offers Google sign-in but not Apple | Already mitigated: `usesAppleSignIn: true` + `expo-apple-authentication` plugin (`apps/mobile/app.config.ts:20, 36`) |
| Guideline 2.1 — App Completeness (crash on launch) | Build targets wrong architecture / missing env | Install the TestFlight build on a physical device before submitting; verify `EXPO_PUBLIC_API_URL` in `apps/mobile/eas.json:22` points to the production Render URL |
| Missing demo account | Auth-gated app | Add a test Apple ID credential in App Review Information -> Sign-in info |
| Export compliance repeatedly asked | Missing `ITSAppUsesNonExemptEncryption` | Already mitigated by ISSUE 4 fix in step 4 |

If rejected:

1. Read the full Resolution Center message — Apple cites the guideline number, which narrows the fix.
2. Fix the root cause (not just the symptom).
3. Reply to the reviewer in the Resolution Center with a changelog of what changed.
4. Resubmit the existing version — do NOT withdraw and re-create the version; it preserves review history.

Acceptance:
- App Store Connect shows "In Review" then "Pending Developer Release" or "Ready for Sale"
- Google Play shows "Published"

## Appendix A — 9 Human Actions from STATE.md -> Runbook Step Mapping

| STATE.md Action | Runbook Step |
|-----------------|--------------|
| 1. Apply Supabase migrations | §2 |
| 2. Configure Apple Developer + Sign in with Apple | §5 |
| 3. Set `ascAppId` in `apps/mobile/eas.json` | §6 step 3 + ISSUE 6 |
| 4. Set `EXPO_TOKEN` GitHub secret | §8 |
| 5. Create and host privacy policy page | §3 (privacy copy already at `apps/api/src/public/privacy.html`; this step deploys and verifies it) |
| 6. App icon 1024×1024 | Already complete (quick `260424-jw8`); re-verify with `file apps/mobile/assets/icon.png` |
| 7. Run `eas build --platform all --profile production` | §9 |
| 8. Run `eas submit --platform ios` for TestFlight | §11 |
| 9. Capture App Store screenshots | §10 |

---

End of runbook.
