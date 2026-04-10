---
status: partial
phase: 04-swipe-core-secondary-screens
source: [04-VERIFICATION.md]
started: 2026-04-10T17:16:00Z
updated: 2026-04-10T17:16:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. 60fps Swipe Performance on Low-End Android
expected: Performance monitor shows no dropped frames during rapid continuous swiping (20+ cards). Frame time stays at or below 16ms.
result: [pending]

### 2. End-to-End Swipe to Picks Auto-Populate Flow
expected: Swiped restaurant appears immediately in Tonight's Picks (DB trigger fires on swipe insert). After app restart, the pick is still present.
result: [pending]

### 3. Delete Account End-to-End Flow
expected: Alert shows exact copy and button labels. After confirmation, DELETE /api/v1/users/me succeeds, signOut fires, user redirected to onboarding/login.
result: [pending]

### 4. Location-Aware Deck Loading
expected: expo-location obtains coordinates, lat/lng passed to GET /api/v1/recommendations, scored restaurants render as swipeable cards.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
