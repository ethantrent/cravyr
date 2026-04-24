# Cravyr — App Store Listing Copy

> v1.0 submission copy. Paste into App Store Connect / Google Play Console.
> Every section annotated with platform character limit and current count.
> All feature claims trace to Phases 1–5 shipped in ROADMAP.md.

---

## iOS App Store

### App Name (30 chars max)

`Cravyr` (6/30 chars)

<!-- Must match apps/mobile/app.config.ts `name: 'Cravyr'` exactly. -->

### Subtitle (30 chars max) — primary

`Swipe to find tonight's spot` (28/30 chars)

<!--
  Why this one: leads with the mechanic (swipe) AND the benefit (tonight's spot)
  in a single breath. Mechanic-first framing matches PROJECT.md's core ethos
  ("the swipe feels right"). See A/B Alternates below for mechanic-only and
  benefit-only variants.
-->

### Promotional Text (170 chars max) — primary

Welcome to Cravyr. Swipe right to save restaurants near you. Left to skip. Up to superlike. Tonight's Picks fills itself as you go. (131/170 chars)

<!--
  Promotional Text is editable post-launch without re-review. Use this slot
  to A/B test hooks and seasonal angles (Friday night, weekend dinner, etc.)
  after launch. Two alternate angles are listed in A/B Alternates.
-->

### Description (4000 chars max)

```
Cravyr turns restaurant discovery into a swipe. Right to save, left to skip, up to superlike. Find tonight's dinner in under two minutes.

Open Cravyr, and a deck of restaurants near you loads — ranked by your cuisine, price, and distance preferences. Swipe right on anything that looks good. It lands in Tonight's Picks automatically. Change your mind? Swipe up for a superlike, or tap Undo to bring the last card back.

Tap a card to see the full detail view: photos, opening hours, price level, rating, and a one-tap Directions link straight to Apple Maps or Google Maps.

Features:
- Swipe right to save, left to skip, up to superlike
- Undo your last swipe if you change your mind
- Tonight's Picks — your saved list, persistent across restarts
- Restaurant detail with photos, hours, rating, price, and directions
- Preferences: pick your cuisines, price range, and max distance
- Daily 6PM reminder when you have unseen picks waiting
- Sign in with email, Google, or Apple — your session stays logged in
- Delete your account and all data any time from Settings

Privacy:
No ads. No cross-app tracking. No data brokers. Your location is only used while the app is open, and your swipes stay on your account.

Pick tonight's dinner in under two minutes.
```

(1259/4000 chars)

<!--
  Structure notes:
    - First paragraph (~140 chars) fits above Apple's mobile-listing fold.
      It names the product, the core loop, and the time-to-value in one breath.
    - No emojis in iOS description — Apple review has flagged gimmicky emoji use.
    - Privacy line echoes apps/api/src/public/privacy.html section 7 verbatim in spirit.
    - Closing line is the single most important CTA and restates the hook.
  Target density: 1,200–1,800 chars. Longer is weaker — Apple reviewers and
  users both skim. All claims trace to shipped_features_v1.0 in the plan.
-->

### Keywords (100 chars max, comma-separated, no spaces after commas)

`restaurants,dining,food,swipe,nearby,foodie,cuisine,picks,hungry,local,discovery,takeout,eats,meals` (99/100 chars)

<!--
  No spaces after commas: every space is a wasted char of the 100-char budget.
  "cravyr" is deliberately omitted — App Name is already indexed for search,
  so duplicating it here would waste 7 chars. Same reason "tonight" is omitted
  (it lives in Subtitle, which is also indexed). See Keyword Strategy section
  at the bottom for per-term rationale and exclusions.
-->

### What's New — v1.0 release notes (4000 chars max)

```
Welcome to Cravyr — restaurant discovery by swipe.
- Swipe right to save, left to skip, up to superlike
- Undo your last swipe any time
- Tonight's Picks auto-saves every right-swipe
- Detail view with photos, hours, rating, price, directions
- Set your cuisine, price, and distance preferences
- Daily 6PM reminder for unseen picks
- Sign in with email, Google, or Apple
- Delete your account any time from Settings

Pick tonight's dinner in under two minutes.
```

(461/4000 chars)

<!--
  This is the FIRST release. Framed as "what the app does" rather than
  "what changed" — there is no prior version. Short + bulleted so a reviewer
  can scan the feature set against App Store minimum functionality bar
  (photos/hours/directions/saved list/preferences/delete account all covered).
-->

---

## Google Play Store

### Title (30 chars max)

`Cravyr` (6/30 chars)

### Short Description (80 chars max)

`Swipe through restaurants near you. Save the ones that look good.` (65/80 chars)

<!--
  Play Store shows Short Description in search results and at the top of
  the listing page. Must hook instantly. Mechanic + benefit in one sentence.
-->

### Full Description (4000 chars max)

```
Swipe through restaurants near you. Save the ones that look good. Pick tonight's dinner in under two minutes.

🍽️ Here's how it works
1. Set your cuisines, price range, and max distance when you first open the app.
2. A deck of restaurants near you loads, ranked by what you like and how close it is.
3. Swipe right to save to Tonight's Picks. Left to skip. Up to superlike. Hit Undo if you change your mind.

Tap any card to see photos, opening hours, price level, rating, and a one-tap Directions link to Apple Maps or Google Maps.

✨ Features
- Four-way swipe: right = save, left = skip, up = superlike, undo for the last card
- Tonight's Picks — your saved list, auto-populated on right-swipe and persistent across restarts
- Restaurant detail with photos, hours, rating, price level, and directions
- Preferences: cuisines, price range, max distance
- Daily 6PM reminder when you have unseen picks waiting
- Email, Google, and Apple sign-in — your session persists across app restarts
- Delete Account — remove your data any time from Settings

🔒 Privacy
No ads. No cross-app tracking. No data brokers. Your location is only used while the app is open. Your swipes stay on your account. Delete everything at any time from Settings.

Open Cravyr. Pick tonight's dinner in under two minutes.
```

(1296/4000 chars)

<!--
  Play Store indexes Full Description for search, so keyword density matters
  more than it does on iOS. Emojis ARE allowed on Play and aid scanning;
  three used here as section markers (🍽️, ✨, 🔒), not decoration.
  Structure: hook → 3-step walkthrough → feature bullets → privacy → CTA.
-->

---

## A/B Alternates

### Subtitle alternates

1. `Swipe. Save. Eat.` (17/30 chars) — angle: action-first, punchy, implies zero-friction loop. Budget leftover could be used later to add a qualifier.
2. `Dinner picks, one swipe away` (28/30 chars) — angle: benefit-first, emphasizes the saved-list payoff over the mechanic. Try if launch metrics show users bouncing before their first swipe.

### Promotional Text alternates

1. Friday night, no plans? Open Cravyr. Swipe through restaurants near you. Save the ones that look good. Pick tonight in under two minutes. (137/170 chars) — angle: use-case-focused, concrete moment. Swap in on weekends or during launch push.
2. New to Cravyr? Set your cuisines, price, and distance once. Then just swipe. Tonight's Picks fills as you go. A daily 6PM nudge reminds you. (140/170 chars) — angle: onboarding-focused, demystifies the loop for users who bounce on the App Store page without installing.

---

## Keyword Strategy

<!--
  Keywords are the single highest-leverage ASO input on iOS. The 100-char
  budget is tight — treat it like a 100-char haiku.

  Per-term rationale (iOS Keywords field):
    - restaurants  (11)  Highest intent term for this app's category. Non-negotiable.
    - dining       (+7)  Broader search intent than "restaurants"; captures
                         users searching for meal occasions, not just places.
    - food         (+5)  Massive search volume; high competition but necessary
                         as a catch-all for category browsing.
    - swipe        (+6)  The mechanic. Differentiator vs filter-and-scroll apps.
                         Low competition, high relevance.
    - nearby       (+7)  Location-intent modifier that pairs with "restaurants"
                         via iOS's keyword-recombination indexing.
    - foodie       (+7)  Self-identified lifestyle term; strong in discovery
                         searches, low direct competition from utility apps.
    - cuisine      (+8)  Matches users filtering by food type (pairs with
                         the cuisine-preferences feature).
    - picks        (+6)  Matches "Tonight's Picks" saved-list feature.
    - hungry       (+7)  Intent-state keyword; short-tail, high relevance to
                         the "I need to eat NOW" use case.
    - local        (+6)  Location intent; pairs with "food" and "restaurants".
    - discovery    (+10) Matches the product category directly.
    - takeout      (+8)  Adjacent intent; users searching takeout still want
                         a restaurant recommendation even if they stay in.
    - eats         (+5)  Short synonym for "food"; pairs via recombination
                         with "local," "nearby," "picks," etc.
    - meals        (+6)  Occasion-focused synonym (lunch/dinner); broadens
                         match surface vs "food" alone.
    Total: 99/100 chars.

  Excluded (and why):
    - "cravyr"          — App Name is already indexed; duplicating wastes 7 chars.
    - "tonight"         — Lives in Subtitle, which is also indexed; duplicating wastes 8 chars.
    - "save"            — Weak standalone term; generic save-for-later apps outrank us.
    - "find"            — Generic and outranked by utility apps; no differentiation value.
    - "tinder"          — Trademark. Never use. Rejection risk and brand confusion.
    - "yelp"            — Trademark; competitor name.
    - "doordash","ubereats","grubhub" — Trademarks; different product category (delivery).
    - "app","mobile"    — Implicit; never include in iOS Keywords.
    - "the","and","or"  — Stop words; iOS strips them. Wasted budget.

  Formatting rationale:
    - NO spaces after commas. Every space = 1 wasted char out of 100.
    - Lowercase only. iOS Keywords search is case-insensitive; uppercase
      wastes no chars but adds zero benefit.
    - Singular where the singular reads naturally; iOS keyword-stemming
      matches plurals automatically. Exception: "restaurants" is already
      the canonical search term users type, so we keep it plural.

  Interaction with App Name + Subtitle:
    - iOS indexes the App Name ("Cravyr") and Subtitle ("Swipe to find
      tonight's spot") alongside the Keywords field. The search engine
      recombines words across all three fields to match multi-word queries.
    - That means "tonight," "spot," and "cravyr" are effectively keywords
      without costing any of the 100-char Keywords budget. We avoid
      duplicating them in Keywords.

  Iteration plan post-launch:
    - Promotional Text is editable without review; use it to A/B test
      hooks post-launch (see A/B Alternates). Keywords require a new
      app-version submission to change, so plan changes in batches
      alongside version bumps (v1.0.1, v1.1).
-->
