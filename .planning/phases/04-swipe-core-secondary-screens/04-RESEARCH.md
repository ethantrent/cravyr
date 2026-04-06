# Phase 4: Swipe Core + Secondary Screens — Research

**Researched:** 2026-04-06
**Domain:** React Native swipe UI, Expo Router navigation, Supabase user data lifecycle
**Confidence:** MEDIUM (core API facts verified; spring physics parameters and precise RN Linking edge cases are ASSUMED)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Swipe Card Design**
- D-01: Photo-first hero layout — full-bleed photo fills the card, gradient overlay at the bottom shows restaurant name, distance, price level, and cuisine type.
- D-02: Drag overlay labels: "SAVE" (green), "SKIP" (red), "SUPERLIKE" (gold/yellow) — text labels with matching colored borders appear on the card during drag.
- D-03: Action buttons below the deck: X (skip), Heart (save), Star (superlike). All three required — needed for App Store accessibility compliance.
- D-04: Prerender 5–7 cards at a time (per CLAUDE.md memory management guidance); use expo-image prefetch for the next 2–3 cards.

**Tonight's Picks Layout**
- D-05: Vertical scroll list with photo thumbnail on the left, restaurant name + cuisine + distance on the right side of each card row.
- D-06: Superlikes shown with a gold star badge on the photo thumbnail — no separate section; superlikes appear in chronological order with other saves.
- D-07: Swipe-to-delete on list items — swipe left on a pick to reveal a Delete button. No confirmation dialog needed.
- D-08: Picks accumulate indefinitely (wishlist behavior, not a daily reset). No cron job needed for clearing.

**Detail View Structure**
- D-09: Full-screen photo header (~40% screen height) + scrollable info sheet below — shows name, rating, price level, cuisine, address, opening hours.
- D-10: Swipeable photo gallery in the hero — swipe left/right to browse up to 5 photos from Google Places API. Photo references are hotlinked (not downloaded, per Google Places ToS).
- D-11: Action buttons in the detail view: Get Directions (deep link to Apple Maps / Google Maps), Call restaurant (phone number from Places API), Share (native share sheet), Save/Remove from Picks (toggle).
- D-12: Navigation: push detail onto Expo Router stack, back button / swipe-back gesture returns to swipe deck.

**Empty State & Deck Exhaustion**
- D-13: Full-screen illustrated empty state when deck runs out — centered illustration + message "You've seen everything nearby" + a "Go to Preferences" button.
- D-14: CTA navigates to the Preferences screen (not an auto-expand or silent refetch) — user controls what changes.

### Claude's Discretion
- Loading skeleton design for cards while deck is fetching
- Exact spring/damping parameters for swipe animation
- Typography, spacing, and color palette details
- Exact illustration or icon for the empty state
- Error state design (network failure, API error on deck load)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CORE-01 | Swipe card deck with 60fps animation (right = save, left = skip, up = superlike, undo) | rn-swiper-list 3.0.0 API: `onSwipeRight/Left/Top`, `swipeBack()` ref method, Reanimated v4 native thread |
| CORE-02 | "Tonight's Picks" saved list (auto-populated on right-swipe via DB trigger) | Supabase `saves` table + DB trigger from Phase 2; FlatList + ReanimatedSwipeable for delete; `useLocalSearchParams` |
| CORE-03 | Restaurant detail view (photos, hours, directions, rating, price level) | Expo Router `router.push('/restaurant/[id]')`, `Linking.openURL` for maps, expo-image hotlinking |
| CORE-04 | User preferences (cuisines, price range, max distance) | Supabase `user_preferences` upsert; Zustand store for local state |
| UX-02 | Settings screen with account deletion (App Store guideline 5.1.1) | Supabase `auth.admin.deleteUser()` server-side via Express DELETE route; ON DELETE CASCADE for user data |
</phase_requirements>

---

## Summary

Phase 4 delivers the complete core product loop. The central technical challenge is the swipe deck: rn-swiper-list 3.0.0 built on Reanimated v4 and react-native-worklets provides all the primitives needed (callbacks, imperative ref, overlay labels, prerenderItems) — but it requires Expo SDK 55 with New Architecture, which is now mandatory and satisfies that requirement automatically.

Two previously flagged open research gaps from STATE.md are now resolved: the react-native-worklets peer dep package name is `react-native-worklets` (Software Mansion, v0.8.1), and the Babel plugin is `react-native-worklets/plugin` — but with Expo SDK 55, `babel-preset-expo` handles this plugin automatically, so no manual `babel.config.js` entry is needed.

The secondary screens (Tonight's Picks, detail view, preferences, settings) each use well-established patterns: `ReanimatedSwipeable` from gesture-handler for swipe-to-delete, a root Stack wrapping the tabs for detail screen navigation, platform-detected deep links for maps directions, and a server-side Express DELETE route for account deletion using the Supabase service-role key.

**Primary recommendation:** Use rn-swiper-list 3.0.0 as the swipe engine with `prerenderItems={7}`, install it alongside `react-native-worklets` via `npx expo install`, and let `babel-preset-expo` handle the Babel plugin automatically. Do not add `react-native-worklets/plugin` manually to `babel.config.js` — it is injected by the preset when the package is detected.

---

## Project Constraints (from CLAUDE.md)

| Directive | Category | Impact on Phase 4 |
|-----------|----------|-------------------|
| rn-swiper-list for 60fps card swiping | Required tool | Use as primary swipe component |
| Animations on native UI thread via Reanimated worklets | Performance | Confirmed: rn-swiper-list 3.0.0 + Reanimated v4 satisfies this |
| expo-image for all card photo rendering | Required tool | Use `Image` from `expo-image`; use `Image.prefetch()` for next 2–3 cards |
| Google Places photo URLs must be hotlinked — no downloading | ToS compliance | In detail view: `<Image source={{ uri: googlePhotoUrl }}>`; never store photo bytes |
| Photo references expire — cache references server-side, regenerate URLs | ToS compliance | Phase 2 stores `photo_reference` strings; Phase 4 calls API to get fresh URL at render time |
| Google Places `place_id` may be stored permanently | ToS compliance | Already handled: `external_id` column in `restaurants` table |
| Render 5–7 cards at a time via `prerenderItems` | Memory management | `prerenderItems={7}` on Swiper component |
| `pnpm why react-native` must show one instance | Monorepo hygiene | Verify before any new RN package addition |
| Named exports only | Code convention | No default exports from component files |
| Zustand for state management | Required tool | swipeDeckStore + picksStore + preferencesStore |
| Expo Router for navigation | Required tool | File-based routing; Stack + Tabs layout pattern |
| Zod for validation | Required tool | Validate API responses for restaurant shape |
| Shared types from `@cravyr/shared` — never duplicate | Monorepo convention | `Restaurant` type defined in `packages/shared` |
| App Store minimum functionality: detail view, saved list, preferences, settings, delete account | App Store compliance | All five screens required in this phase |

---

## Standard Stack

### Core (Phase 4)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| rn-swiper-list | 3.0.0 | Swipe card deck | Reanimated v4 native thread; 4-direction; imperative ref; overlay labels; prerenderItems |
| react-native-reanimated | 4.3.0 | Animation engine | Ships with Expo SDK 55 via `expo install`; native thread worklets |
| react-native-gesture-handler | 2.31.0 | Gesture recognition + Swipeable | Required peer of rn-swiper-list; also provides ReanimatedSwipeable for swipe-to-delete |
| react-native-worklets | 0.8.1 | Worklet runtime | Required peer of rn-swiper-list 3.0.0; install via `expo install` |
| expo-image | 55.0.8 | Restaurant photo rendering | Native disk+memory cache; `Image.prefetch()`; WebP; no flickering |
| Expo Router | 55.0.10 | File-based navigation | Stack + Tabs; `router.push('/restaurant/id')`; swipe-back built-in on iOS |
| Zustand | 5.0.12 | Global state | swipeDeckStore (deck queue, undo stack), picksStore, preferencesStore |
| @supabase/supabase-js | 2.101.1 | DB reads + auth admin delete | `supabase.from('saves').select()` for Picks; `auth.admin.deleteUser()` server-side |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-native-reanimated (ReanimatedSwipeable) | 2.31.0 | Swipe-to-delete in Picks list | Built into gesture-handler; no extra install |
| `Linking` (React Native built-in) | — | Maps deep links (Directions button) | `Linking.openURL()` with platform-detected URL |
| `Share` (React Native built-in) | — | Native share sheet | Detail view "Share" action |
| Linear gradient (expo-linear-gradient) | via expo install | Card gradient overlay (D-01) | Bottom gradient over photo to show text |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ReanimatedSwipeable for swipe-to-delete | Custom pan gesture | ReanimatedSwipeable is battle-tested and maintained by Software Mansion. Custom implementation adds ~150 lines for no gain |
| `Linking.openURL` for maps | react-native-open-maps / react-native-map-link | Extra dependency not justified; platform-detect pattern with bare Linking is 6 lines |
| Expo Router root Stack + Tabs | Deep stack inside each tab | Root Stack pattern is simpler for a single shared detail screen accessible from both Discover and Picks tabs |

### Installation

```bash
# From apps/mobile — always use expo install for Expo-managed packages
npx expo install react-native-reanimated react-native-worklets react-native-gesture-handler
npx expo install expo-image expo-linear-gradient

# Swipe library (not in Expo registry — use pnpm add)
pnpm add rn-swiper-list

# State (not Expo-managed)
pnpm add zustand
```

**Do NOT manually add `react-native-worklets/plugin` to `babel.config.js`.** `babel-preset-expo` injects it automatically when `react-native-worklets` is installed in an Expo SDK 50+ project. [VERIFIED: docs.swmansion.com + web search cross-reference]

---

## Architecture Patterns

### Recommended File Structure (Phase 4 additions)

```
apps/mobile/app/
├── _layout.tsx                     # Root Stack: wraps (tabs) + restaurant/[id]
├── (tabs)/
│   ├── _layout.tsx                 # Tabs navigator: discover + saved
│   ├── discover.tsx                # Swipe deck screen
│   └── saved.tsx                   # Tonight's Picks list
├── restaurant/
│   └── [id].tsx                    # Detail view (pushed from either tab)
├── preferences.tsx                 # Preferences screen (pushed from Discover empty state or Settings)
└── settings.tsx                    # Settings screen (pushed from tab header or Picks)

apps/mobile/stores/
├── swipeDeckStore.ts               # deck queue, undo stack, loading state
├── picksStore.ts                   # saves list, optimistic delete
└── preferencesStore.ts             # cuisines, price range, max distance

apps/mobile/components/
├── SwipeCard/
│   ├── SwipeCard.tsx               # Full-bleed card layout with gradient overlay
│   └── OverlayLabels.tsx           # SAVE / SKIP / SUPERLIKE label components
├── SwipeDeck/
│   └── SwipeDeck.tsx               # Swiper wrapper with action buttons + empty state
├── RestaurantRow/
│   └── RestaurantRow.tsx           # Picks list row (thumbnail + info)
└── PhotoGallery/
    └── PhotoGallery.tsx            # Horizontal swipeable gallery for detail view
```

### Pattern 1: Root Stack Wraps Tabs (Expo Router)

**What:** The `app/_layout.tsx` defines a Stack navigator containing both the `(tabs)` group and the `restaurant/[id]` screen. This lets any tab push the detail screen onto a stack that sits above the tab bar.

**When to use:** Any time a screen needs to be pushed from multiple tabs without duplicating routes.

```tsx
// app/_layout.tsx
// Source: https://docs.expo.dev/router/basics/common-navigation-patterns/
import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="restaurant/[id]"
        options={{ headerShown: true, title: '', presentation: 'card' }}
      />
      <Stack.Screen name="preferences" options={{ title: 'Preferences' }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
    </Stack>
  );
}
```

Navigating from Discover or Picks:
```tsx
import { useRouter } from 'expo-router';
const router = useRouter();
router.push(`/restaurant/${restaurant.id}`);
```

Back navigation (swipe-back gesture) is enabled by default on iOS when `gestureEnabled` is not explicitly set to false.

### Pattern 2: rn-swiper-list Swipe Deck

**What:** The `Swiper` component renders a stacked card deck. Callbacks fire after animation completes on the UI thread to prevent race conditions.

**Key props for Cravyr:**

```tsx
// Source: https://github.com/Skipperlla/rn-swiper-list (README)
import Swiper, { SwiperCardRefType } from 'rn-swiper-list';
import { useRef } from 'react';

const swiperRef = useRef<SwiperCardRefType>(null);

<Swiper
  ref={swiperRef}
  data={deck}
  renderCard={(restaurant, index) => <SwipeCard restaurant={restaurant} />}
  prerenderItems={7}                         // D-04: render 5-7 at a time
  onSwipeRight={(index) => handleSave(deck[index])}
  onSwipeLeft={(index) => handleSkip(deck[index])}
  onSwipeTop={(index) => handleSuperlike(deck[index])}
  onSwipedAll={handleDeckEmpty}              // triggers empty state (D-13)
  OverlayLabelRight={() => <SaveLabel />}    // D-02
  OverlayLabelLeft={() => <SkipLabel />}
  OverlayLabelTop={() => <SuperlikeLabel />}
  disableBottomSwipe                         // no down-swipe action
  swipeRightSpringConfig={{ damping: 18, stiffness: 120, mass: 1 }}  // Claude's discretion
  swipeLeftSpringConfig={{ damping: 18, stiffness: 120, mass: 1 }}
/>

// Action buttons (D-03)
<Button onPress={() => swiperRef.current?.swipeLeft()} />   // Skip
<Button onPress={() => swiperRef.current?.swipeRight()} />  // Save
<Button onPress={() => swiperRef.current?.swipeTop()} />    // Superlike
<Button onPress={() => swiperRef.current?.swipeBack()} />   // Undo
```

**Undo behavior:** `swipeBack()` is an imperative method that resets the last swiped card to center with animation. Combine with a Zustand undo stack: push to stack on each swipe, pop on undo.

### Pattern 3: expo-image Prefetch for Next Cards

**What:** Before the top card is swiped, preload the next 2–3 card images so they render instantly.

```tsx
// Source: https://docs.expo.dev/versions/latest/sdk/image/
import { Image } from 'expo-image';

// Call when deck index changes (e.g., onIndexChange callback)
const prefetchUpcoming = (deck: Restaurant[], currentIndex: number) => {
  const upcomingUrls = deck
    .slice(currentIndex + 1, currentIndex + 4)
    .map(r => r.photo_urls[0])
    .filter(Boolean);
  Image.prefetch(upcomingUrls, 'memory-disk');
};
```

`Image.prefetch()` returns `Promise<boolean>` — resolves `false` if any URL fails, `true` if all succeed. Failures are non-fatal; the image will attempt to load at render time.

### Pattern 4: Zustand v5 Swipe Deck Store

**What:** Central store managing deck queue, undo stack, and loading state.

```ts
// Source: https://github.com/pmndrs/zustand (v5 docs)
import { create } from 'zustand';
import type { Restaurant } from '@cravyr/shared';

interface SwipeDeckState {
  deck: Restaurant[];
  undoStack: Restaurant[];  // last swiped card(s) for undo
  isLoading: boolean;
  setDeck: (deck: Restaurant[]) => void;
  pushUndo: (restaurant: Restaurant) => void;
  popUndo: () => Restaurant | undefined;
  clearDeck: () => void;
}

export const useSwipeDeckStore = create<SwipeDeckState>()((set, get) => ({
  deck: [],
  undoStack: [],
  isLoading: false,
  setDeck: (deck) => set({ deck }),
  pushUndo: (restaurant) =>
    set((state) => ({ undoStack: [...state.undoStack, restaurant] })),
  popUndo: () => {
    const { undoStack } = get();
    const last = undoStack[undoStack.length - 1];
    if (last) set((state) => ({ undoStack: state.undoStack.slice(0, -1) }));
    return last;
  },
  clearDeck: () => set({ deck: [], undoStack: [] }),
}));
```

Undo does NOT call the backend to reverse the swipe record — it just re-inserts the restaurant at the front of the deck. The swipe record in the DB remains; the user gets to swipe again.

### Pattern 5: ReanimatedSwipeable Swipe-to-Delete (Tonight's Picks)

**What:** Each row in the Picks FlatList is wrapped in `ReanimatedSwipeable`, which reveals a Delete button on left-swipe (D-07).

```tsx
// Source: https://docs.swmansion.com/react-native-gesture-handler/docs/components/reanimated_swipeable/
import { ReanimatedSwipeable } from 'react-native-gesture-handler/ReanimatedSwipeable';

<FlatList
  data={picks}
  renderItem={({ item }) => (
    <ReanimatedSwipeable
      friction={2}
      overshootRight={false}
      rightThreshold={40}
      renderRightActions={() => (
        <DeleteAction onPress={() => handleDeletePick(item.id)} />
      )}
    >
      <RestaurantRow pick={item} />
    </ReanimatedSwipeable>
  )}
/>
```

No confirmation dialog is needed per D-07. Perform an optimistic UI delete (remove from Zustand store immediately) and then call `DELETE /api/v1/saves/:id` in the background.

### Pattern 6: Maps Deep Link (Directions Button)

**What:** Platform-detected URL opens Apple Maps on iOS, Google Maps on Android. Falls back to Google Maps web URL if the native app is not installed.

```tsx
// Source: https://reactnative.dev/docs/linking + Apple Maps URL scheme docs
import { Linking, Platform } from 'react-native';

const openDirections = async (lat: number, lng: number, name: string) => {
  const encodedName = encodeURIComponent(name);
  const url = Platform.select({
    ios: `https://maps.apple.com/?daddr=${lat},${lng}&q=${encodedName}`,
    android: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
  });
  if (url) {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    }
  }
};
```

**Why `https://` over `geo:` or `comgooglemaps://`:** HTTPS URLs work on both platforms without needing to declare URL schemes in app.json/Info.plist. `geo:` is Android-only. `comgooglemaps://` requires LSApplicationQueriesSchemes on iOS and may not be installed. The HTTPS approach is the lowest-friction path. [ASSUMED — confirmed pattern from community practice; Apple official docs also support `maps.apple.com` HTTPS links]

### Pattern 7: Supabase Delete Account (Settings Screen)

**What:** Account deletion must be server-side using the service role key. The Express API exposes a `DELETE /api/v1/users/me` route that:
1. Verifies the user's JWT (so only the authenticated user can delete themselves)
2. Calls `supabase.auth.admin.deleteUser(userId)` with the service-role client
3. Returns 204 on success

Foreign keys with `ON DELETE CASCADE` handle cascade-deleting application data (swipes, saves, preferences) automatically, as long as the schema was created with cascades (Phase 1/2 responsibility).

```ts
// apps/api/src/routes/users.ts
// Source: https://supabase.com/docs/reference/javascript/auth-admin-deleteuser
import { createClient } from '@supabase/supabase-js';

const adminSupabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // service role — never expose to client
);

app.delete('/api/v1/users/me', async (req, res) => {
  const userId = req.user.id;  // extracted from verified JWT middleware
  const { error } = await adminSupabase.auth.admin.deleteUser(userId);
  if (error) throw error;
  res.status(204).send();
});
```

**App Store requirement:** App Store guideline 5.1.1 (Data Collection and Storage) requires that apps with accounts must allow users to initiate deletion of their account. This route satisfies that requirement. [CITED: App Store Review Guidelines 5.1.1]

**Storage objects:** If the user has any objects in Supabase Storage, they must be deleted before `deleteUser()` is called — otherwise the call fails. For Phase 4, users have no storage objects (restaurant photos are hotlinked, not uploaded), so this is not a concern.

### Anti-Patterns to Avoid

- **Using `onSwipeLeft/Right` index to access deck directly:** `cardIndex` in callbacks is the position in the original `data` array, not relative to the current front card. Use the index to look up `data[cardIndex]`, not `deck[0]`.
- **Calling `swipeBack()` without checking the undo stack:** If the undo stack is empty, `swipeBack()` still fires but there is no card to return. Gate the Undo button on `undoStack.length > 0`.
- **Downloading Google Places photos to your own storage:** ToS violation. Always render via `<Image source={{ uri: photoUrl }}>` — hotlink only.
- **Caching Google Places photo URLs instead of photo references:** Photo URLs expire. Cache the `photo_reference` string; generate a fresh URL at render time by calling the Express `/restaurants/:id` endpoint.
- **Calling `auth.admin.deleteUser()` from the client app:** Requires service role key. Only ever call from the Express API server.
- **Showing a blank screen on `onSwipedAll`:** Handle in the `onSwipedAll` callback. Show the empty state with a "Go to Preferences" CTA (D-13/D-14).
- **Not persisting JWT cleanup after account deletion:** After server-side deletion, call `supabase.auth.signOut()` on the client to clear local session immediately (JWT remains valid until expiry otherwise).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Swipe gesture + animation + velocity detection | Custom pan gesture component | rn-swiper-list 3.0.0 | Velocity threshold, spring physics, overlay label interpolation, and undo are all built-in. Custom = 500+ lines with ongoing bugs |
| Swipe-to-delete in lists | Custom pan gesture row | ReanimatedSwipeable from react-native-gesture-handler | Built-in threshold, overshoot friction, ref methods (close/openRight). Already a peer dep |
| Maps deep link platform detection | Custom URL builder | 6-line `Platform.select` pattern with `Linking.openURL` | No dependency needed; `https://maps.apple.com` and `https://www.google.com/maps/dir` work without custom schemes |
| User delete cascade | Manual delete from each table | `ON DELETE CASCADE` on FK + single `auth.admin.deleteUser()` call | PostgreSQL cascades are atomic. Manual multi-table delete creates a partial-delete race condition if any step fails |
| Worklet Babel transform | Manual webpack plugin config | `babel-preset-expo` (automatic) | Preset auto-injects `react-native-worklets/plugin`; manual config risks double-registering the plugin |

---

## Common Pitfalls

### Pitfall 1: Wrong Babel Plugin Entry for Reanimated v4

**What goes wrong:** Developer adds `'react-native-reanimated/plugin'` to `babel.config.js` following outdated guides. Receives a warning: "Seems like you are using a Babel plugin `react-native-reanimated/plugin`. It was moved to `react-native-worklets` package."
**Why it happens:** Most online tutorials (pre-SDK 54) reference the old plugin name. The plugin was moved to `react-native-worklets/plugin` in Reanimated v4.
**How to avoid:** With Expo SDK 55 and `babel-preset-expo`, **add nothing manually**. `babel-preset-expo` injects `react-native-worklets/plugin` automatically when `react-native-worklets` is installed. If you see warnings about the plugin, the fix is to remove any manually-added Reanimated plugin entry from `babel.config.js`.
**Warning signs:** Build warning mentioning `react-native-reanimated/plugin` at startup.

### Pitfall 2: `react-native-worklets` Not Installed Explicitly

**What goes wrong:** pnpm resolves packages through hoisting and `rn-swiper-list` is installed, but `react-native-worklets` does not appear in `apps/mobile/package.json`. Worklet functions silently fall back to JS thread or throw a runtime error.
**Why it happens:** pnpm's strict isolation. The package may be hoisted to the root but not registered as a direct dep, causing issues after clean installs or on CI.
**How to avoid:** Run `npx expo install react-native-worklets` explicitly from `apps/mobile`. Verify it appears in `apps/mobile/package.json` dependencies.
**Warning signs:** `"worklet" keyword not found` runtime errors; animations run on JS thread (can detect via Reanimated strict mode).

### Pitfall 3: cardIndex Confusion in Swipe Callbacks

**What goes wrong:** Developer uses `onSwipeRight={(index) => handleSave(deck[index])}` expecting `index` to always be 0 (top card). After multiple swipes, index accumulates and points to the wrong card.
**Why it happens:** `cardIndex` in rn-swiper-list callbacks is the card's position in the **original data array**, not a relative index from the current front of deck.
**How to avoid:** Use `data[cardIndex]` where `data` is the original prop passed to `<Swiper>`, not a derived slice. Alternatively, store the restaurant ID on the card itself and use `onPress` or a closure.
**Warning signs:** Wrong restaurant gets saved; saves are off by N cards after several swipes.

### Pitfall 4: Google Places Photo URL Caching

**What goes wrong:** The detail view stores the full photo URL from the API response in state or DB. A week later, the URL returns 403 because photo names expire server-side.
**Why it happens:** Google Places API photo URLs contain a time-limited token embedded in the URL path.
**How to avoid:** Cache the `photo_reference` string (the opaque identifier) in the `restaurants` table. Call the Express `GET /restaurants/:id` endpoint to regenerate fresh photo URLs at render time, never store URLs. Render photos with `<Image source={{ uri: freshUrl }}>` from expo-image.
**Warning signs:** Detail view photos show broken image placeholders after 24–48 hours.

### Pitfall 5: Swipe-Back Without Reversing the API Call

**What goes wrong:** User taps Undo — `swipeBack()` re-shows the card — but the swipe record is still in the DB. The recommendation engine excludes the restaurant because it sees a `swipes` row for it.
**Why it happens:** Undo is a UI operation in rn-swiper-list; it does not call any backend.
**How to avoid:** When undo is triggered, also call `DELETE /api/v1/swipes/:restaurantId` on the backend to remove the swipe record. Use Zustand's undo stack to store the restaurant ID needed for this call.
**Warning signs:** Undone restaurant disappears from deck on next session; recommendation query excludes it.

### Pitfall 6: `auth.admin.deleteUser()` from the Client

**What goes wrong:** Developer initializes the admin client with `SUPABASE_SERVICE_ROLE_KEY` in the mobile app and calls `deleteUser()` directly. The service role key is exposed in the app bundle.
**Why it happens:** Convenience — the client already has a Supabase instance.
**How to avoid:** The Express API must expose a `DELETE /api/v1/users/me` route that verifies the user's JWT first, then calls `deleteUser()` server-side with the admin client. The mobile app calls this Express route, not Supabase directly.
**Warning signs:** Any use of `SUPABASE_SERVICE_ROLE_KEY` in `apps/mobile`.

### Pitfall 7: Memory Pressure from Rendering Full Deck

**What goes wrong:** Loading 50+ restaurant cards with high-resolution images simultaneously crashes low-end Android devices (OOM kill).
**Why it happens:** Each card renders an expo-image with a full-resolution photo. Without `prerenderItems` limits, all cards are in the React tree simultaneously.
**How to avoid:** Set `prerenderItems={7}` (confirmed CLAUDE.md guidance). Pair with `Image.prefetch()` to warm only the next 2–3 images. Do not set `prerenderItems` higher than 7.
**Warning signs:** OOM crashes on Pixel 4a or similar low-end Android; Expo performance monitor shows memory growing per swipe without release.

### Pitfall 8: Duplicate React Native Version

**What goes wrong:** Adding a new package pulls in a different React Native version as a transitive dep. Metro bundler crashes with "Cannot find module 'react-native/Libraries/...'" or unpredictable runtime errors.
**Why it happens:** npm/pnpm hoisting may not deduplicate properly in monorepo workspaces.
**How to avoid:** Run `pnpm why --recursive react-native` from the monorepo root after any new package install. If multiple versions appear, add a `resolutions` or `overrides` entry in the root `package.json` to pin to a single version.
**Warning signs:** Metro reset-cache warnings; import errors mentioning `react-native` paths.

---

## Code Examples

### Overlay Label (SAVE/SKIP/SUPERLIKE)

```tsx
// D-02: Text label with colored border appears during drag
// Source: rn-swiper-list README (verified)
const SaveLabel = () => (
  <View style={{ borderWidth: 3, borderColor: '#22c55e', borderRadius: 8, padding: 8 }}>
    <Text style={{ color: '#22c55e', fontSize: 24, fontWeight: '800' }}>SAVE</Text>
  </View>
);

const SkipLabel = () => (
  <View style={{ borderWidth: 3, borderColor: '#ef4444', borderRadius: 8, padding: 8 }}>
    <Text style={{ color: '#ef4444', fontSize: 24, fontWeight: '800' }}>SKIP</Text>
  </View>
);

const SuperlikeLabel = () => (
  <View style={{ borderWidth: 3, borderColor: '#eab308', borderRadius: 8, padding: 8 }}>
    <Text style={{ color: '#eab308', fontSize: 24, fontWeight: '800' }}>SUPERLIKE</Text>
  </View>
);
```

### expo-image Card Photo with Gradient Overlay

```tsx
// D-01: Full-bleed photo with bottom gradient overlay
// Source: expo-image docs (https://docs.expo.dev/versions/latest/sdk/image/)
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

const SwipeCard = ({ restaurant }: { restaurant: Restaurant }) => (
  <View style={{ flex: 1, borderRadius: 16, overflow: 'hidden' }}>
    <Image
      source={{ uri: restaurant.photo_urls[0] }}
      style={{ flex: 1 }}
      contentFit="cover"
      placeholder={{ thumbhash: restaurant.photo_blurhash }}
      transition={200}
    />
    <LinearGradient
      colors={['transparent', 'rgba(0,0,0,0.85)']}
      style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 160, padding: 16 }}
    >
      <Text style={{ color: 'white', fontSize: 22, fontWeight: '700' }}>{restaurant.name}</Text>
      <Text style={{ color: 'white', opacity: 0.85 }}>
        {restaurant.price_level_display} · {restaurant.primary_cuisine} · {restaurant.distance_km}km
      </Text>
    </LinearGradient>
  </View>
);
```

### Supabase Picks Query (Tonight's Picks)

```ts
// Phase 2 DB trigger auto-inserts into saves on right-swipe/superlike
// Phase 4 reads from saves table
const fetchPicks = async (userId: string) => {
  const { data, error } = await supabase
    .from('saves')
    .select(`
      id,
      interaction_type,
      saved_at,
      restaurants (id, name, photo_urls, cuisines, price_level, location)
    `)
    .eq('user_id', userId)
    .order('saved_at', { ascending: false });
  return { data, error };
};
```

### Maps Directions Deep Link

```tsx
// Source: https://reactnative.dev/docs/linking (verified pattern)
import { Linking, Platform } from 'react-native';

const openDirections = async (lat: number, lng: number, name: string) => {
  const encodedName = encodeURIComponent(name);
  const url = Platform.select({
    ios: `https://maps.apple.com/?daddr=${lat},${lng}&q=${encodedName}`,
    android: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${encodedName}`,
  });
  if (url) await Linking.openURL(url);
};
```

---

## Open Research Gaps (Resolved from STATE.md)

Both open gaps from STATE.md are now resolved:

| Gap | Resolution |
|-----|------------|
| `rn-swiper-list 3.0.0 exact react-native-worklets peer dep package name` | **`react-native-worklets`** (Software Mansion, v0.8.1). Confirmed via `npm view rn-swiper-list` — peer deps list `react-native-worklets: *`. |
| `Reanimated v4 Babel plugin name` | **`react-native-worklets/plugin`** (moved from `react-native-reanimated/plugin`). With Expo SDK 55, `babel-preset-expo` injects this automatically — **no manual babel.config.js entry needed**. |

---

## Open Questions

1. **Photo gallery component for detail view (D-10)**
   - What we know: Need horizontal swipe through up to 5 photos. `expo-image` handles the images. Swipe gesture is via gesture-handler or a FlatList with `horizontal + pagingEnabled`.
   - What's unclear: Whether to use `FlatList` with `pagingEnabled`, a custom `PagerView` (`expo-view-pager`), or a simple gesture-based approach.
   - Recommendation: Use `FlatList` with `horizontal`, `pagingEnabled`, and `snapToInterval` — no extra dependency. This is Claude's discretion per CONTEXT.md.

2. **Undo API call: should it DELETE the swipe record?**
   - What we know: `swipeBack()` re-presents the card in the UI. The recommendation engine in Phase 2 excludes swiped restaurants.
   - What's unclear: Whether Phase 2's `GET /recommendations` uses a 7-day swipe exclusion window or permanent exclusion.
   - Recommendation: Plan a `DELETE /api/v1/swipes/:restaurantId` call on undo. If the Phase 2 implementation doesn't support it yet, the worst case is the restaurant is excluded from future sessions — low severity, fixable in Phase 5.

3. **Preferences screen form state**
   - What we know: Cuisine multi-select + price range + max distance. Save to Supabase `user_preferences` table.
   - What's unclear: Whether to use local Zustand state with a "Save" button or auto-save on change.
   - Recommendation: Local Zustand state + explicit "Save" button — prevents accidental preference changes mid-swipe session. This is Claude's discretion per CONTEXT.md.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 4 is UI/code-only. All external services (Supabase, Express API on Render) are provided by Phases 1–3. No new CLI tools or services are required.

---

## Validation Architecture

nyquist_validation is set to `false` in `.planning/config.json` — section omitted per configuration.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No (Phase 3) | — |
| V3 Session Management | Partial | Sign out after account deletion to invalidate local JWT |
| V4 Access Control | Yes | Server-side verify JWT before delete; RLS on `saves`/`swipes` tables |
| V5 Input Validation | Yes | Zod schema validation on API responses for Restaurant type |
| V6 Cryptography | No | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| User deletes another user's account | Tampering | JWT verification middleware on `DELETE /users/me` — userId from verified token, never from request body |
| Service role key in mobile bundle | Information disclosure | Express-only admin client; never instantiate with service_role in mobile |
| Photo reference stored as URL (expired) | Denial of service | Store `photo_reference` string only; generate URL at render time |
| Unauthenticated swipe recording | Spoofing | JWT required on `POST /swipes`; user_id from token, not request payload |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `babel-preset-expo` handles `react-native-worklets/plugin` automatically in SDK 55, no manual entry needed | Standard Stack / Pitfall 1 | App fails to compile worklets; fix is adding the plugin manually to `babel.config.js` |
| A2 | `swipeBack()` re-inserts the card at the front of the visual deck without requiring a new deck re-fetch | Pattern 2 / Pitfall 5 | Undo doesn't work as expected; would need a custom re-insert into the deck array |
| A3 | `https://maps.apple.com/?daddr=` deep links open Apple Maps without LSApplicationQueriesSchemes in Info.plist | Pattern 6 | Directions button silently fails on iOS; fix is falling back to `comgooglemaps://` or `maps://` |
| A4 | Spring physics `{ damping: 18, stiffness: 120, mass: 1 }` produce a natural-feeling swipe | Pattern 2 | Cards feel too snappy or too slow; tune interactively — this is Claude's discretion |
| A5 | Phase 2 DB trigger inserts into `saves` with an `interaction_type` column distinguishing `right` vs `superlike` | Pattern 5 (Picks query) | Gold star badge cannot be rendered; requires Phase 2 schema change |

---

## Sources

### Primary (HIGH confidence)
- `npm view rn-swiper-list` — peer deps `react-native-worklets: *`, version 3.0.0 confirmed [VERIFIED: npm registry]
- `npm view react-native-worklets` — version 0.8.1, Software Mansion maintainers [VERIFIED: npm registry]
- `npm view react-native-worklets-core` — separate Margelo library, NOT the peer dep for rn-swiper-list [VERIFIED: npm registry]
- https://github.com/Skipperlla/rn-swiper-list — README API: props, ref methods, callbacks [VERIFIED: GitHub fetch]
- https://docs.expo.dev/versions/latest/sdk/image/ — `Image.prefetch(urls, cachePolicy)` signature [VERIFIED: official docs fetch]
- https://docs.swmansion.com/react-native-gesture-handler/docs/components/reanimated_swipeable/ — ReanimatedSwipeable API [VERIFIED: official docs fetch]
- https://reactnative.dev/docs/linking — `Linking.openURL`, platform map URLs [VERIFIED: official docs fetch]
- https://docs.expo.dev/router/basics/common-navigation-patterns/ — Root Stack + Tabs file structure [VERIFIED: official docs fetch]
- https://docs.swmansion.com/react-native-reanimated/docs/fundamentals/getting-started/ — Reanimated v4 babel plugin is `react-native-worklets/plugin`; New Architecture required [VERIFIED: official docs fetch]

### Secondary (MEDIUM confidence)
- https://expo.dev/changelog/sdk-55 — SDK 55 drops Legacy Architecture; New Architecture mandatory [CITED: official Expo changelog]
- https://expo.dev/blog/upgrading-to-sdk-55 — Reanimated v4 only supports New Architecture; SDK 55 + Reanimated v4 fully compatible [CITED: official Expo blog]
- WebSearch: `babel-preset-expo` auto-injects worklets plugin for Expo SDK 50+ — multiple search results including docs.swmansion.com [MEDIUM — multiple sources agree]
- https://supabase.com/docs/reference/javascript/auth-admin-deleteuser — service_role required; soft/hard delete [CITED: official Supabase docs]
- https://supabase.com/docs/guides/auth/managing-user-data — ON DELETE CASCADE pattern; Storage objects must be cleared before deleteUser [CITED: official Supabase docs]

### Tertiary (LOW confidence)
- Maps deep link URL patterns (`maps.apple.com`, `google.com/maps/dir`) — confirmed in Apple developer docs and Google Maps URL docs; exact query param behavior on all iOS versions not exhaustively tested [A3 in Assumptions Log]
- Spring physics values (`damping: 18, stiffness: 120`) — community convention; no official Cravyr-specific tuning [A4 in Assumptions Log]

---

## Metadata

**Confidence breakdown:**
- rn-swiper-list API: HIGH — verified from npm registry + GitHub README fetch
- Reanimated v4 / worklets babel plugin: HIGH — verified from official Software Mansion docs + Expo changelog
- Expo Router navigation pattern: HIGH — verified from official Expo docs
- Maps deep links: MEDIUM — verified from official Apple/Google docs; runtime behavior assumed
- Supabase delete user: HIGH — verified from official Supabase JS docs
- Zustand v5 store patterns: MEDIUM — verified version; store shape is ASSUMED based on training knowledge

**Research date:** 2026-04-06
**Valid until:** 2026-07-06 (stable libraries; Expo SDK versioning and Places API pricing most likely to drift)
