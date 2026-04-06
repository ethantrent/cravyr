# Phase 4: Swipe Core + Secondary Screens - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the complete core product loop: a logged-in user can swipe through real restaurant cards at 60fps, save picks to Tonight's Picks, undo a swipe, view restaurant detail, manage preferences, and access settings (including account deletion). This phase must meet App Store minimum functionality requirements. Authentication, the API layer, and push notifications are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Swipe Card Design
- **D-01:** Photo-first hero layout — full-bleed photo fills the card, gradient overlay at the bottom shows restaurant name, distance, price level, and cuisine type.
- **D-02:** Drag overlay labels: "SAVE" (green), "SKIP" (red), "SUPERLIKE" (gold/yellow) — text labels with matching colored borders appear on the card during drag.
- **D-03:** Action buttons below the deck: X (skip), Heart (save), Star (superlike). All three required — needed for App Store accessibility compliance.
- **D-04:** Prerender 5–7 cards at a time (per CLAUDE.md memory management guidance); use expo-image prefetch for the next 2–3 cards.

### Tonight's Picks Layout
- **D-05:** Vertical scroll list with photo thumbnail on the left, restaurant name + cuisine + distance on the right side of each card row.
- **D-06:** Superlikes shown with a gold star badge on the photo thumbnail — no separate section; superlikes appear in chronological order with other saves.
- **D-07:** Swipe-to-delete on list items — swipe left on a pick to reveal a Delete button. No confirmation dialog needed.
- **D-08:** Picks accumulate indefinitely (wishlist behavior, not a daily reset). No cron job needed for clearing.

### Detail View Structure
- **D-09:** Full-screen photo header (~40% screen height) + scrollable info sheet below — shows name, rating, price level, cuisine, address, opening hours.
- **D-10:** Swipeable photo gallery in the hero — swipe left/right to browse up to 5 photos from Google Places API. Photo references are hotlinked (not downloaded, per Google Places ToS).
- **D-11:** Action buttons in the detail view: Get Directions (deep link to Apple Maps / Google Maps), Call restaurant (phone number from Places API), Share (native share sheet), Save/Remove from Picks (toggle).
- **D-12:** Navigation: push detail onto Expo Router stack, back button / swipe-back gesture returns to swipe deck.

### Empty State & Deck Exhaustion
- **D-13:** Full-screen illustrated empty state when deck runs out — centered illustration + message "You've seen everything nearby" + a "Go to Preferences" button.
- **D-14:** CTA navigates to the Preferences screen (not an auto-expand or silent refetch) — user controls what changes.

### Claude's Discretion
- Loading skeleton design for cards while deck is fetching
- Exact spring/damping parameters for swipe animation
- Typography, spacing, and color palette details
- Exact illustration or icon for the empty state
- Error state design (network failure, API error on deck load)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Scope & Success Criteria
- `.planning/ROADMAP.md` §Phase 4 — Success criteria (7 items), requirements CORE-01 through CORE-04, UX-02

### Project Constraints & Architecture
- `.planning/PROJECT.md` — Stack constraints, Google Places ToS (hotlink photos, no downloads), performance requirement (native thread animation), App Store compliance rules

### Technology Stack
- `.planning/research/STACK.md` — Confirmed versions: rn-swiper-list 3.0.0, Reanimated v4, expo-image 55.0.8, Expo Router 55, Zustand v5; open research gaps re: react-native-worklets peer dep package name and Reanimated v4 Babel plugin name (must resolve before implementing swipe animations)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- No existing codebase — this is a greenfield project. Phase 1 scaffolds the monorepo; Phase 4 will be the first significant UI code written.

### Established Patterns
- Zustand v5 for state management (confirmed stack choice) — swipe deck state, Tonight's Picks list, and preferences should use Zustand stores
- Expo Router file-based navigation — detail view at `app/restaurant/[id].tsx`, Tonight's Picks at `app/(tabs)/saved.tsx`, swipe deck at `app/(tabs)/discover.tsx`
- expo-image for all restaurant photo rendering (disk + memory caching, prefetch API)

### Integration Points
- Phase 2 provides `GET /restaurants/nearby` and `GET /recommendations` — swipe deck fetches from these
- Phase 2 `POST /swipes` — swipe recording endpoint (called on every card swipe)
- Phase 3 Supabase auth — user session required before SwipeDeck renders; Expo Router auth guard (from Phase 3) protects the tabs
- Supabase DB trigger from Phase 2 schema auto-inserts into `saves` table on right-swipe/superlike — Tonight's Picks reads from `saves` table directly

</code_context>

<specifics>
## Specific Ideas

No specific references — open to standard approaches for implementation details.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 04-swipe-core-secondary-screens*
*Context gathered: 2026-04-06*
