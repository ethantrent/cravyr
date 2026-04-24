---
status: partial
phase: 05-push-notifications-app-store
source: [05-VERIFICATION.md]
started: 2026-04-24T18:10:00Z
updated: 2026-04-24T18:10:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Daily reminder delivery at SEND_HOUR on a physical device
expected: Physical device with granted push permission and a recent save receives 'Tonight's Picks 🍽️' push within ~1h of CRON_SEND_HOUR
result: [pending]

### 2. Push token appears in push_tokens after sign-in on a physical device
expected: Signing in on iOS or Android inserts a row in push_tokens with ExponentPushToken[...] and correct platform
result: [pending]

### 3. Notification renders app icon + tint color
expected: Delivered push shows ./assets/icon.png and #f97316 (orange) tint, not the generic bell
result: [pending]

### 4. Test 7 regression — restart-proof daily reminder
expected: With CRON_SEND_HOUR set to current hour, one user with a push token and save <24h old, start API → observe '[cron] Sending to N token(s)... for YYYY-MM-DD'. Verify push_sends row exists. Kill and restart the process during the same UTC hour → observe '[cron] All eligible users already notified for YYYY-MM-DD' and NO second device notification.
result: [pending]

### 5. EAS production build completes for iOS + Android
expected: eas build --platform all --profile production exits 0 for both platforms; artifacts produced
result: [pending]

### 6. TestFlight external-tester completes full core loop unattended
expected: A non-developer tester installs via TestFlight link, onboards, swipes, saves at least one pick — without guidance
result: [pending]

### 7. App Store submission passes initial review
expected: Apple review accepts the submission — no rejection for skeleton MVP, missing Apple Sign-In, missing delete-account, or generic location string
result: [pending]

### 8. ascAppId populated in eas.json with real App Store Connect app ID
expected: apps/mobile/eas.json submit.production.ios.ascAppId is the real numeric ID, not the placeholder 'YOUR_APP_STORE_CONNECT_ID'
result: [pending]

### 9. Privacy policy URL hosted and referenced in App Store listing
expected: App Store metadata points to a live privacy policy URL (Cravyr /privacy endpoint exists in server.ts at line 58–60 serving public/privacy.html — verify actual content is production-ready)
result: [pending]

### 10. Apple APNs + Firebase FCM credentials provisioned
expected: eas credentials shows APNs key configured for iOS and FCM server key configured for Android — required for push delivery on release builds
result: [pending]

### 11. EXPO_TOKEN GitHub repo secret set
expected: Settings → Secrets and variables → Actions has EXPO_TOKEN — without it eas-build.yml will fail on first real run
result: [pending]

### 12. App icon + 1024x1024 asset verified
expected: ./assets/icon.png exists at 1024x1024 per Apple spec
result: [pending]

### 13. App Store screenshots captured
expected: Screenshots for iPhone 6.7" + 5.5" (and iPad if supported) uploaded to App Store Connect
result: [pending]

## Summary

total: 13
passed: 0
issues: 0
pending: 13
skipped: 0
blocked: 0

## Gaps
