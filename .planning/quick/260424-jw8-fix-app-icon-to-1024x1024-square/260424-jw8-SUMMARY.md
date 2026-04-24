---
phase: 260424-jw8
plan: 01
subsystem: mobile/assets
tags: [app-store, icon, expo, sharp, ios-compliance]
requires:
  - apps/mobile/assets/icon.png (pre-existing 1376x768 landscape PNG used as cropped source)
  - apps/mobile/scripts/generate-app-icons.mjs (created in Task 1)
  - sharp devDependency in apps/mobile/package.json (installed in Task 1)
provides:
  - apps/mobile/assets/icon.png (1024x1024 RGB, no alpha — Apple App Store compliant)
  - apps/mobile/assets/adaptive-icon.png (1024x1024, alpha retained for Android adaptive foreground)
  - apps/mobile/assets/splash.png (2048x2048 RGB, no alpha — letterbox-ready for Expo)
affects:
  - App Store submission readiness (Human Action #6 in STATE.md)
  - Expo prebuild icon validation
tech-stack:
  added: []
  patterns:
    - Sharp pipeline with temp-source staging to avoid source-as-sink corruption when the input file is also an output target
key-files:
  created: []
  modified:
    - apps/mobile/assets/icon.png
    - apps/mobile/assets/adaptive-icon.png
    - apps/mobile/assets/splash.png
  deleted:
    - apps/mobile/assets/_preview/ (throwaway audit directory, per Task 3 done criteria)
decisions:
  - "User selected option-b: center crop (Task 2 checkpoint). Rationale: original 1376x768 icon.png has the Cravyr fork/knife/heart logo centered on solid #f97316 orange; the logo fits entirely within the 768x768 center square, so the discarded left/right regions are blank orange. Center crop is therefore near-non-lossy in brand content; the 768→1024 upscale is a ~33% enlargement on flat vector-style art which Lanczos3 renders cleanly."
  - "Temp-source staging used: copied apps/mobile/assets/icon.png to apps/mobile/assets/_preview/_src.png before running the generator so the script read from _src.png while writing to assets/icon.png. Prevents the three-pipeline Sharp script from reading a partially-overwritten icon.png on its second and third pipelines (adaptive, splash)."
metrics:
  duration: ~3 minutes (executor)
  completed: 2026-04-24
---

# Phase 260424-jw8 Plan 01: Fix App Icon to 1024x1024 Square Summary

Regenerated Cravyr's App Store / adaptive / splash assets from the existing 1376x768 landscape PNG using Sharp with a `center` crop, producing a 1024x1024 RGB no-alpha `icon.png`, a 1024x1024 `adaptive-icon.png`, and a 2048x2048 no-alpha `splash.png` — unblocking the App Store submission gate (Human Action #6).

## Outcome

**Status:** SHIPPED (option-b: center)

The user evaluated three candidate previews at the Task 2 checkpoint (center / left / right crops plus a fit letterbox) and selected `option-b: center`. The center 768x768 region of the original 1376x768 PNG contains the full Cravyr logo on solid orange; the left/right regions are blank orange. Discarding them is effectively non-lossy in brand content. The remaining concern — the ~33% Lanczos3 upscale from 768 to 1024 — is acceptable on flat vector-style logo art and produces a clean App Store icon. The user acknowledged a real high-res source asset should still be produced before final App Store submission to replace the upscaled version; this plan unblocks the gate without shipping a visibly broken icon.

## Final Asset Dimensions

| File | Dimensions | Channels | hasAlpha | Notes |
|------|------------|----------|----------|-------|
| `apps/mobile/assets/icon.png` | 1024x1024 | 3 (RGB) | false | Apple App Store compliant — no alpha, exact 1024 square |
| `apps/mobile/assets/adaptive-icon.png` | 1024x1024 | 4 (RGBA) | true | Android adaptive foreground (alpha permitted per Expo convention) |
| `apps/mobile/assets/splash.png` | 2048x2048 | 3 (RGB) | false | Flattened against `#f97316`, square so Expo letterboxes on any aspect ratio |

Verified via both `file(1)` output and `sharp().metadata()`:

```
apps/mobile/assets/icon.png:          PNG image data, 1024 x 1024, 8-bit/color RGB, non-interlaced
apps/mobile/assets/adaptive-icon.png: PNG image data, 1024 x 1024, 8-bit/color RGBA, non-interlaced
apps/mobile/assets/splash.png:        PNG image data, 2048 x 2048, 8-bit/color RGB, non-interlaced

sharp('assets/icon.png').metadata():
  {"width":1024,"height":1024,"channels":3,"hasAlpha":false}
```

## Regeneration Command

From `apps/mobile/` (requires a source file that is NOT one of the output targets):

```
# If starting from the current in-repo icon.png, stage it to a temp location first:
cp assets/icon.png /tmp/src-icon.png

# Then run the generator:
node scripts/generate-app-icons.mjs \
  --source /tmp/src-icon.png \
  --mode center \
  --bg '#f97316' \
  --out-dir assets \
  --confirm-overwrite
```

When a proper high-resolution source asset becomes available (ideally >=2048x2048 or SVG), use `--mode fit` to preserve the designer's full composition without cropping:

```
node scripts/generate-app-icons.mjs \
  --source <path-to-high-res-source> \
  --mode fit \
  --bg '#f97316' \
  --out-dir assets \
  --confirm-overwrite
```

## Deviations from Plan

### [Rule 3 - Blocking issue] Temp-source staging for source-as-sink collision

- **Found during:** Task 3, before running the generator
- **Issue:** The plan's Task 3 invocation uses `--source apps/mobile/assets/icon.png` with `--out-dir apps/mobile/assets`, meaning the source path is the same file as one of the output paths. The generator runs THREE separate Sharp pipelines (icon, adaptive, splash), each of which calls `sharp(args.source)` to start a fresh read from disk. The first pipeline would overwrite `icon.png` with the 1024x1024 output, and the second and third pipelines would then read that 1024x1024 file instead of the original 1376x768 landscape source — producing a corrupt adaptive-icon.png and splash.png derived from an already-cropped icon.
- **Fix:** Copied `apps/mobile/assets/icon.png` to `apps/mobile/assets/_preview/_src.png` before running the generator, and passed `--source assets/_preview/_src.png` instead. The temp source was deleted alongside the `_preview/` cleanup at the end of the task.
- **Files modified:** none (inline workaround; no script change)
- **Commit:** N/A — workaround applied at invocation time; the generator script was not modified. Future users should either pass a distinct source file or use the temp-copy workflow shown in the Regeneration Command section above. If the collision becomes a recurring footgun, a follow-up could harden the script to detect `realpath(source) === realpath(outDir/icon.png)` and refuse, or to buffer the source to memory before running any pipeline.

## Follow-ups

- **Real source asset before App Store launch:** The current icons are a ~33% Lanczos3 upscale of a 768-tall original. They are Apple-compliant and unblock TestFlight, but a proper high-resolution source (SVG or >=2048x2048 PNG) should be produced and re-run through the generator with `--mode fit` before public App Store submission. This was explicitly acknowledged by the user at the Task 2 checkpoint.
- **Generator hardening (optional):** Consider adding a source-as-sink guard to `apps/mobile/scripts/generate-app-icons.mjs` so future invocations can safely pass the same file as source and output target without manual temp-copying.

## Self-Check

- Commit `cf634c1` exists on branch `worktree-agent-ab268726`: FOUND
- `apps/mobile/assets/icon.png` exists and is 1024x1024 RGB no-alpha: FOUND
- `apps/mobile/assets/adaptive-icon.png` exists and is 1024x1024: FOUND
- `apps/mobile/assets/splash.png` exists and is 2048x2048 RGB no-alpha: FOUND
- `apps/mobile/assets/_preview/` removed: FOUND (test ! -d returns true)
- `apps/mobile/app.config.ts` unmodified: CONFIRMED (not in git status)

## Self-Check: PASSED
