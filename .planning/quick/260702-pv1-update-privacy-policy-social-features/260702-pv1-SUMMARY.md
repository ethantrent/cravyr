---
phase: 260702-pv1
plan: 01
subsystem: api/public, planning/marketing
tags: [app-store, privacy, compliance, social-features]
status: complete
commit: d40ee42
requires:
  - apps/api/src/public/privacy.html (existing policy, last updated 2026-04-24)
  - supabase/migrations/20260720000000_connections.sql (source of truth for social data model)
  - apps/api/src/routes/connections.ts (display-name exposure to friends, DELETE endpoint)
provides:
  - Privacy policy covering friends/connections, invite codes, group-match visibility, and disconnect rights
  - SUBMISSION-RUNBOOK.md §6 App Privacy declarations matching the updated policy
affects:
  - App Store submission readiness (runbook §6 App Privacy + §12 Data safety, which references §6)
key-files:
  created: []
  modified:
    - apps/api/src/public/privacy.html
    - .planning/marketing/SUBMISSION-RUNBOOK.md
decisions:
  - "Added a dedicated 'What Friends Can See' section (new §5) rather than burying sharing scope in §4 — Apple reviewers and users both look for an explicit statement of user-to-user visibility"
  - "Declared friend connections under Identifiers (User ID, linked) and display name under Contact Info (Name, linked) in the App Privacy list — closest fit in Apple's taxonomy for a social graph without address-book access"
  - "Did not renumber runbook §12 Data safety — it references §6 declarations, so it inherits the update"
verification:
  - "grep -c 'riend' privacy.html → sections 1, 2, 5, 6, 7 all cover the social features"
  - "Policy states friends never see raw swipe history, skips, preferences, or location (matches get_group_matches RPC behavior: intersection of saves only)"
---

# Summary: Update privacy policy + App Privacy declarations for social features

The privacy policy (last updated April 24) and runbook App Privacy checklist predated
the friends/connections/group-matches features shipped June 28 (fd2a683, de2eca5).
Updated both so the App Store submission declares the social-graph data accurately:

- **§1 collection**: friend connections + 15-minute invite codes
- **§2 use**: group matches, display name shown to connected friends
- **§5 (new) What Friends Can See**: matches + display name visible; full saved list,
  swipe history, skips, preferences, location never visible; disconnect at any time
- **§6 retention**: connections/invite codes in cascade delete
- **§7 rights**: disconnect option
- **Runbook §6**: added Name (linked) and User ID (linked) declarations; annotated
  Usage Data with match visibility

Committed as d40ee42. Remaining related human steps unchanged: deploy to Render so
/privacy serves the new copy (runbook §3), and enter the declarations in App Store
Connect (§6) / Play Console Data safety (§12) when creating the store records.
