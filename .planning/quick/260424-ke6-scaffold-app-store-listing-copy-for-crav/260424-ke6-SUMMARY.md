---
phase: 260424-ke6
plan: 01
subsystem: marketing
tags: [app-store, google-play, aso, launch, copy]
status: complete
completed: 2026-04-24
duration_minutes: ~25
commit: 8c1a2a7
tasks_completed: 1
dependency_graph:
  requires:
    - .planning/ROADMAP.md (feature truth — Phases 1–5 shipped)
    - apps/mobile/app.config.ts (app name must match: `Cravyr`)
  provides:
    - App Store Connect + Google Play Console listing copy for v1.0 submission
  affects:
    - Human Action #8 (`eas submit --platform ios`) — unblocked
key-files:
  created:
    - .planning/marketing/app-store-listing.md
  modified: []
decisions:
  - Subtitle primary = `Swipe to find tonight's spot` (mechanic + benefit in one breath; uses 28/30 chars)
  - iOS Keywords deliberately omit `cravyr` and `tonight` — those words already index via App Name + Subtitle (free), so spending the 100-char budget on duplicates would be wasteful
  - No emojis in iOS Description (Apple review has flagged emoji-heavy descriptions as gimmicky); Google Play description uses three section-marker emojis (🍽️ ✨ 🔒) as scannable headers
  - "Tinder for X" framing explicitly rejected — product stands on its own; also trademark risk
---

# Phase 260424-ke6 Plan 01: App Store Listing Copy Scaffold Summary

Scaffolded a complete App Store Connect + Google Play Console listing copy sheet at `.planning/marketing/app-store-listing.md`, ready to paste directly at submission time, with every slot hand-counted against platform char limits.

## One-liner

Single-file, paste-ready listing copy for Cravyr v1.0 covering iOS (name/subtitle/promo/description/keywords/what's-new), Google Play (title/short/full), A/B alternates, and a keyword strategy rationale block — all within char limits and feature-accurate to ROADMAP Phases 1–5.

## Final Char Counts — Tight Slots

| Slot | Value | Count | Limit |
|------|-------|-------|-------|
| iOS App Name | `Cravyr` | 6 | 30 |
| iOS Subtitle (primary) | `Swipe to find tonight's spot` | 28 | 30 |
| iOS Promotional Text | `Welcome to Cravyr. Swipe right to save restaurants near you. Left to skip. Up to superlike. Tonight's Picks fills itself as you go.` | 131 | 170 |
| iOS Description | (prose, see file) | 1259 | 4000 |
| iOS Keywords | `restaurants,dining,food,swipe,nearby,foodie,cuisine,picks,hungry,local,discovery,takeout,eats,meals` | 99 | 100 |
| iOS What's New | (short bulleted list) | 461 | 4000 |
| Play Title | `Cravyr` | 6 | 30 |
| Play Short Description | `Swipe through restaurants near you. Save the ones that look good.` | 65 | 80 |
| Play Full Description | (prose with 3-step walkthrough) | 1296 | 4000 |

Every `(XX/YY chars)` annotation in the file was counted with `Buffer.byteLength`-equivalent JavaScript `.length` (UTF-16 code units), which matches how App Store Connect and Google Play Console count characters for these fields.

## Subtitle Decision — Why Primary

Three subtitles were drafted and evaluated against the PROJECT.md core ethos ("the swipe feels right"):

1. **`Swipe to find tonight's spot` (28/30) — PRIMARY**
   - Wins because it contains BOTH the mechanic (`Swipe`) AND the benefit (`tonight's spot`) in one phrase.
   - Also embeds the word `tonight` in a subtitle field that iOS indexes for search — effectively adding a free keyword without spending any of the 100-char Keywords budget.
2. `Swipe. Save. Eat.` (17/30) — action-first, punchy, but omits the time-to-value promise. Kept as Alt 1 for A/B testing.
3. `Dinner picks, one swipe away` (28/30) — benefit-first, emphasizes saved-list payoff. Kept as Alt 2; try if launch metrics show users bouncing on the App Store page before installing.

## Features Deliberately Omitted

- **`superlike` kept out of Subtitle** — the 30-char budget cannot fit all three swipe directions legibly. Superlike is a secondary interaction (users discover it after they understand left/right); it's covered in the Description, What's New, and Google Play Full Description.
- **`undo` kept out of Subtitle** — same budget reason. Appears in Description and What's New.
- **`6PM reminder` kept out of Subtitle and Short Description** — push notifications are a re-engagement feature, not a first-install hook. Covered in feature bullets.
- **`Apple/Google Sign-In` kept out of Subtitle and Promotional Text** — auth method is table stakes, not a differentiator. Covered in feature bullets.
- **No closing-soon alert claim anywhere** — deferred to v1.1 per ROADMAP Phase 5 scope. Claiming it in v1.0 copy would be a false feature claim and a review risk.
- **No AI/ML/recommendation-engine claim** — the PostGIS scoring function is SQL, not ML. Calling it "AI" would be a lie per CLAUDE.md banned language and App Store review risk.
- **No reservation/ordering/delivery claim** — out of scope for v1.0 per PROJECT.md.
- **No `curated` language** — banned unless describing the user's own saved list. Tonight's Picks is described as "auto-populated" / "auto-saves" instead.
- **Competitor trademarks (`tinder`, `yelp`, `doordash`, `ubereats`, `grubhub`) excluded from Keywords** — documented in the Keyword Strategy comment block with rationale.

## Deviations From Plan

None. Plan executed exactly as specified — one file created, every required structural section present, every char count under limit, no banned language, all feature claims trace to shipped_features_v1.0.

## Self-Check

- [x] `.planning/marketing/app-store-listing.md` exists (committed in `8c1a2a7`)
- [x] Plan's automated verify command exits 0 (`OK: all required sections present, no banned language`)
- [x] Every `(XX/YY chars)` annotation was measured, not placeheld
- [x] All tight slots manually spot-checked (Name, Subtitle x3, Short Description, Keywords, Promo Text x3)
- [x] All shipped features referenced at least once (swipe, superlike, undo, Tonight's Picks, photos, hours, Directions, rating, price, cuisine, distance, 6PM, Apple, Google, email, Delete)
- [x] No banned marketing fluff anywhere (revolutionary, seamless, game-changing, reimagine, AI-powered, Tinder for, elevate, unlock, empower, the future of, curated)
- [x] No aspirational features (closing-soon, social/friends, reservations, delivery, ordering, AI/ML)

## Recommended Next Step

Paste `.planning/marketing/app-store-listing.md` into App Store Connect and Google Play Console as the final pre-submission step, BEFORE running `eas submit --platform ios` (Human Action #8 in STATE.md). The subtitle + keywords are the two tightest ASO levers and must be set at first submission — iOS Keywords can only be changed via a new app-version bump, so getting the 99/100-char term list right now saves a resubmission cycle.

If a designer supplies final screenshots, hook them into the same App Store Connect submission at the same time. This plan delivered COPY only; screenshot capture is Human Action #9.

## Self-Check: PASSED
