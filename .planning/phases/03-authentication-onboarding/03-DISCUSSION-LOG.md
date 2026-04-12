# Phase 3: Authentication + Onboarding - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-12
**Phase:** 03-authentication-onboarding
**Areas discussed:** Onboarding step order, Sign-in screen layout, Location permission UX, Preference collection depth

---

## Onboarding Step Order

| Option | Description | Selected |
|--------|-------------|----------|
| Location → Preferences → Auth | User sees value first, sets preferences while engaged, then commits with an account | ✓ |
| Auth → Location → Preferences | Account creation gates everything; simpler auth guard logic | |
| Preferences → Auth → Location | Capture intent before commitment; location furthest from first impression | |

**User's choice:** Location → Preferences → Auth

| Option | Description | Selected |
|--------|-------------|----------|
| Zustand store (in-memory) — flush to Supabase after auth | Preferences held in onboarding store, written to DB after account creation | ✓ |
| AsyncStorage — survive app kill between steps | Persisted locally so preferences survive if app is killed mid-onboarding | |

**User's choice:** Zustand store (in-memory) — flush to Supabase after auth

---

## Sign-In Screen Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Single screen: email form + social buttons below | Email/password fields at top, divider, then Google + Apple buttons | ✓ |
| Social-first: Apple + Google prominent, email as secondary | Social buttons hero, email is a smaller link/button | |
| Method selection: three equal cards | Three equal options on first screen, tapping email slides to form | |

**User's choice:** Single screen: email form + social buttons below

| Option | Description | Selected |
|--------|-------------|----------|
| Single screen with toggle | One screen, sign-in/create account toggle | ✓ |
| Separate sign-in and sign-up screens | Two distinct screens with separate copy and CTAs | |

**User's choice:** Single screen with toggle

---

## Location Permission UX

| Option | Description | Selected |
|--------|-------------|----------|
| Full-screen explanation with single CTA | Centered illustration/icon, heading, 2-sentence explanation, single CTA button | ✓ |
| Minimal banner prompt | Smaller card/banner at bottom of preferences screen | |
| Skip soft-prompt — trigger native dialog directly | Immediately fire the native dialog | |

**User's choice:** Full-screen explanation with single CTA

| Option | Description | Selected |
|--------|-------------|----------|
| Graceful fallback screen with Settings deep link | Dedicated screen + "Open Settings" button; user cannot proceed | ✓ |
| Fallback to default city | Use hardcoded default location | |
| Allow proceeding without location — prompt again in-app | Let user into app with limited deck + in-app banner | |

**User's choice:** Graceful fallback screen with Settings deep link (user cannot proceed without granting location)

---

## Preference Collection Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Cuisines (multi-select) + price range only | Two quick steps; distance defaults to 10km | |
| Cuisines + price range + max distance | Three steps including distance slider | ✓ |
| Cuisines only — minimal onboarding | Just cuisines; price and distance default | |

**User's choice:** Cuisines + price range + max distance (3 steps)

| Option | Description | Selected |
|--------|-------------|----------|
| Required — all three steps must be completed | User must complete all three before proceeding | ✓ |
| Optional — 'Skip for now' on each step | Each step has a Skip option with defaults | |

**User's choice:** Required — all three steps must be completed

---

## Claude's Discretion

- Exact cuisine list icons and visual treatment of multi-select grid
- Distance slider step increments
- Sign-in screen typography and spacing
- Loading/error states during social sign-in
- Whether to add "Forgot password" flow

## Deferred Ideas

None
