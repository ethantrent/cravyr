# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-06)

**Core value:** 60fps swipe feel — because a janky swipe kills the product before the user finds a restaurant they love
**Current focus:** Phase 1

## Current Position

**Milestone:** 1 — MVP
**Phase:** 1 — Monorepo Scaffold + Infrastructure
**Status:** Not started
**Progress:** ░░░░░░░░░░ 0%

## Accumulated Context

### Key Decisions
- rn-swiper-list 3.0.0 requires react-native-worklets (exact package name TBD — verify from README before Phase 4)
- Use geography(Point) not geometry for PostGIS location column
- Expo SDK 55 (not 52 as originally researched)
- Reanimated v4 (not v3 as originally assumed)
- Express v5 (async error propagation — no try/catch needed in route handlers)
- Zustand v5

### Open Research Gaps
- rn-swiper-list 3.0.0 exact react-native-worklets peer dep package name (needed before Phase 4)
- Reanimated v4 Babel plugin name (needed before Phase 4)
- Push notification per-user timezone cron design (needed before Phase 5)

### Blockers
None

## Session Continuity

Last updated: 2026-04-06 after project initialization
Next action: /gsd-plan-phase 1
