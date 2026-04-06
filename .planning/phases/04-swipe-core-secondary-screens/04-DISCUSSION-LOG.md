# Phase 4: Swipe Core + Secondary Screens - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-06
**Phase:** 04-swipe-core-secondary-screens
**Areas discussed:** Swipe Card Design, Tonight's Picks Layout, Detail View Structure, Empty State & Deck Exhaustion

---

## Swipe Card Design

| Option | Description | Selected |
|--------|-------------|----------|
| Photo-first hero | Full-bleed photo, gradient overlay at bottom with name/distance/price | ✓ |
| Split card | Photo top 60%, info panel below with name, cuisine, rating, price, distance | |
| Minimal photo + name | Just photo and name, no data until detail view | |

**User's choice:** Photo-first hero layout

---

| Option | Description | Selected |
|--------|-------------|----------|
| Restaurant name | Always needed | ✓ |
| Distance from user | e.g., "0.4 mi away" | ✓ |
| Price level | $ / $$ / $$$ / $$$$ | ✓ |
| Cuisine type | e.g., "Italian", "Mexican" | ✓ |

**User's choice:** All four metadata fields visible on card face

---

| Option | Description | Selected |
|--------|-------------|----------|
| SAVE / SKIP / SUPERLIKE | Text labels with colored borders (green/red/gold) | ✓ |
| Icons only | Emoji or icon overlays during drag | |
| No overlay labels | Implicit gestures, no visual feedback during drag | |

**User's choice:** SAVE / SKIP / SUPERLIKE text labels with colored borders

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — X, Heart, Star buttons | Skip, save, superlike via tap buttons below deck | ✓ |
| Yes — just Skip and Save | Two buttons, superlike swipe-only | |
| No buttons | Swipe-only | |

**User's choice:** X, Heart, Star buttons (all three, for accessibility)

---

## Tonight's Picks Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Card list with photo | Photo thumbnail left, name/cuisine/distance right, vertical scroll | ✓ |
| 2-column photo grid | Instagram-style grid with name overlay | |
| Simple flat list | Text-only rows, no images | |

**User's choice:** Card list with photo thumbnail

---

| Option | Description | Selected |
|--------|-------------|----------|
| Star badge on the card | Gold star icon on photo thumbnail | ✓ |
| Separate Superlikes section at top | Own titled section before regular saves | |
| Gold border on the card | Gold/yellow border to distinguish | |

**User's choice:** Star badge on the card photo thumbnail

---

| Option | Description | Selected |
|--------|-------------|----------|
| Swipe-to-delete | Swipe left on list item to reveal Delete button | ✓ |
| Long-press context menu | Long-press for Remove, Share, Directions options | |
| Delete inside detail view only | No deletion from list view | |

**User's choice:** Swipe-to-delete

---

| Option | Description | Selected |
|--------|-------------|----------|
| Accumulate | Picks persist indefinitely — wishlist behavior | ✓ |
| Reset nightly at midnight | Cleared each day, matches "Tonight's" naming | |

**User's choice:** Accumulate indefinitely

---

## Detail View Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Full-screen photo header + scroll | Hero photo ~40% screen, scrollable info sheet below | ✓ |
| Modal bottom sheet | Slides up over deck, 50-80% screen height | |
| Tabbed view (Overview / Hours / Photos) | Full-screen with tabs | |

**User's choice:** Full-screen photo header + scrollable info sheet

---

| Option | Description | Selected |
|--------|-------------|----------|
| Get Directions | Deep link to Apple Maps / Google Maps | ✓ |
| Call restaurant | One-tap call via Places API phone number | ✓ |
| Share restaurant | Native share sheet | ✓ |
| Save / Remove from Picks | Toggle directly from detail view | ✓ |

**User's choice:** All four actions

---

| Option | Description | Selected |
|--------|-------------|----------|
| Single hero photo | First photo from Places API only | |
| Horizontal photo strip below hero | Hero + scrollable thumbnail strip | |
| Swipeable photo gallery in the hero | Left/right swipe to browse up to 5 photos | ✓ |

**User's choice:** Swipeable photo gallery in the hero

---

| Option | Description | Selected |
|--------|-------------|----------|
| Back button / swipe-back gesture | Expo Router stack navigation | ✓ |
| X dismiss button (modal style) | Modal with X in top-right | |
| Bottom nav tab | User manually switches tabs | |

**User's choice:** Back button / swipe-back gesture (Expo Router stack)

---

## Empty State & Deck Exhaustion

| Option | Description | Selected |
|--------|-------------|----------|
| Full-screen illustrated empty state | Illustration + "You've seen everything nearby" + CTA button | ✓ |
| Last card becomes the empty state | Inline empty message as final deck card | |
| Toast / snackbar notification | Brief dismissible toast message | |

**User's choice:** Full-screen illustrated empty state

---

| Option | Description | Selected |
|--------|-------------|----------|
| Go to Preferences | Button navigates to preferences screen | ✓ |
| Auto-expand radius + reload | Widens radius 50% and refetches automatically | |
| Retry with same filters | Refetches from API with same parameters | |

**User's choice:** Go to Preferences button (user-controlled reset)

---

## Claude's Discretion

- Loading skeleton design for cards while deck fetches
- Exact spring/damping parameters for swipe animation
- Typography, spacing, color palette
- Empty state illustration or icon
- Error state design (network failure, API errors)

## Deferred Ideas

None — discussion stayed within phase scope.
