#!/usr/bin/env node
/**
 * generate-app-icons.mjs
 *
 * Reproducible Sharp-based generator for Cravyr app icons.
 *
 * Produces (when run WITHOUT --preview AND WITH --confirm-overwrite):
 *   - <out-dir>/icon.png           1024x1024 RGB (no alpha)           — iOS App Store icon
 *   - <out-dir>/adaptive-icon.png  1024x1024 (alpha permitted)        — Android adaptive foreground
 *   - <out-dir>/splash.png         2048x2048 RGB (no alpha)           — Expo splash (letterbox-ready)
 *
 * In --preview mode, writes only candidate icon previews to <out-dir>/_preview/.
 *
 * CLI contract (from 260424-jw8-PLAN.md):
 *   --source <path>         Path to source image. Required.
 *   --mode <mode>           center | left | right | fit. Default: fit.
 *   --bg <hex>              Background hex for padding (fit / splash / flatten). Default: #f97316.
 *   --out-dir <path>        Output directory. Default: apps/mobile/assets.
 *   --preview               Write candidates to <out-dir>/_preview/; do NOT touch icon.png et al.
 *   --confirm-overwrite     Required to overwrite icon.png / adaptive-icon.png / splash.png.
 *
 * Exit codes:
 *   0  success
 *   1  bad args / missing source / overwrite guard / verification failure
 *   2  Sharp processing error
 */

import sharp from "sharp";
import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";

// --- tiny flag parser (no deps) ---
function parseArgs(argv) {
  const out = { preview: false, confirmOverwrite: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--preview") out.preview = true;
    else if (a === "--confirm-overwrite") out.confirmOverwrite = true;
    else if (a === "--source") out.source = argv[++i];
    else if (a === "--mode") out.mode = argv[++i];
    else if (a === "--bg") out.bg = argv[++i];
    else if (a === "--out-dir") out.outDir = argv[++i];
    else if (a === "--help" || a === "-h") out.help = true;
    else {
      console.error(`unknown flag: ${a}`);
      process.exit(1);
    }
  }
  return out;
}

function usage() {
  console.error(
    [
      "Usage: node generate-app-icons.mjs --source <path> [--mode <center|left|right|fit>] [--bg <hex>] [--out-dir <path>] [--preview] [--confirm-overwrite]",
      "",
      "Required:",
      "  --source <path>      Source image (PNG/JPG/SVG).",
      "",
      "Optional:",
      "  --mode <mode>        center | left | right | fit. Default: fit.",
      "  --bg <hex>           Background hex for padding/flatten. Default: #f97316.",
      "  --out-dir <path>     Output directory. Default: apps/mobile/assets.",
      "  --preview            Write previews only; do NOT overwrite real icons.",
      "  --confirm-overwrite  Required to overwrite icon.png/adaptive-icon.png/splash.png.",
    ].join("\n"),
  );
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  usage();
  process.exit(0);
}

if (!args.source) {
  console.error("error: --source <path> is required");
  usage();
  process.exit(1);
}

const mode = args.mode ?? "fit";
if (!["center", "left", "right", "fit"].includes(mode)) {
  console.error(`error: --mode must be one of center|left|right|fit (got ${mode})`);
  process.exit(1);
}

const bg = args.bg ?? "#f97316";
if (!/^#[0-9a-fA-F]{6}$/.test(bg)) {
  console.error(`error: --bg must be a 6-digit hex like #f97316 (got ${bg})`);
  process.exit(1);
}

const outDir = args.outDir ?? "apps/mobile/assets";

// --- overwrite guard: real assets require --confirm-overwrite AND not --preview ---
const wantsRealWrite = !args.preview;
if (wantsRealWrite && !args.confirmOverwrite) {
  console.error(
    [
      "error: this command would overwrite icon.png / adaptive-icon.png / splash.png.",
      "  Pass --confirm-overwrite to proceed, or --preview to write to _preview/ instead.",
    ].join("\n"),
  );
  process.exit(1);
}

// --- verify source exists and is readable ---
try {
  await fs.access(args.source);
} catch {
  console.error(`error: source file not found: ${args.source}`);
  process.exit(1);
}

// --- load source and read metadata ---
let srcMeta;
try {
  srcMeta = await sharp(args.source).metadata();
} catch (err) {
  console.error(`error: sharp failed to read source: ${err.message}`);
  process.exit(2);
}

if (!srcMeta.width || !srcMeta.height) {
  console.error("error: source has no width/height metadata");
  process.exit(2);
}

console.log(
  `[source] ${args.source} — ${srcMeta.width}x${srcMeta.height}, format=${srcMeta.format}, hasAlpha=${srcMeta.hasAlpha}`,
);

// --- helpers ---

/**
 * Produce a 1024x1024 pipeline from the source according to `mode`.
 * Modes:
 *   center — crop centered square of side=min(w,h), then resize to 1024.
 *   left   — crop leftmost square of side=min(w,h), then resize.
 *   right  — crop rightmost square of side=min(w,h), then resize.
 *   fit    — letterbox into 1024x1024 with --bg padding. Never crops.
 */
async function buildIcon1024({ sourcePath, mode, bgHex }) {
  const m = await sharp(sourcePath).metadata();
  const { width: w, height: h } = m;

  if (mode === "fit") {
    return sharp(sourcePath)
      .resize(1024, 1024, { fit: "contain", background: bgHex })
      .png({ compressionLevel: 9 });
  }

  const side = Math.min(w, h);
  const top = Math.max(0, Math.floor((h - side) / 2));
  let left = 0;
  if (mode === "center") left = Math.max(0, Math.floor((w - side) / 2));
  else if (mode === "left") left = 0;
  else if (mode === "right") left = Math.max(0, w - side);

  return sharp(sourcePath)
    .extract({ left, top, width: side, height: side })
    .resize(1024, 1024, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9 });
}

/** 1024x1024 pipeline for adaptive-icon.png — alpha allowed. */
function buildAdaptive1024(sourcePath) {
  return sharp(sourcePath)
    .resize(1024, 1024, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9 });
}

/** 2048x2048 splash pipeline, flattened against bg — no alpha. */
function buildSplash2048(sourcePath, bgHex) {
  return sharp(sourcePath)
    .flatten({ background: bgHex })
    .resize(2048, 2048, { fit: "contain", background: bgHex })
    .removeAlpha()
    .png({ compressionLevel: 9 });
}

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function writePipelineToFile(pipeline, outPath) {
  const buf = await pipeline.toBuffer();
  await fs.writeFile(outPath, buf);
  const meta = await sharp(outPath).metadata();
  console.log(
    `[wrote]  ${outPath} — ${meta.width}x${meta.height}, channels=${meta.channels}, hasAlpha=${meta.hasAlpha}`,
  );
  return meta;
}

// --- execute ---

try {
  if (args.preview) {
    // PREVIEW MODE: write a single candidate for the chosen mode into _preview/
    const previewDir = path.join(outDir, "_preview");
    await ensureDir(previewDir);

    const name =
      mode === "fit" ? "icon-fit-1024.png" : `icon-${mode}-1024.png`;
    const outPath = path.join(previewDir, name);
    const pipeline = await buildIcon1024({
      sourcePath: args.source,
      mode,
      bgHex: bg,
    });
    const meta = await writePipelineToFile(pipeline, outPath);
    if (meta.width !== 1024 || meta.height !== 1024) {
      console.error(
        `FAIL: ${outPath} is ${meta.width}x${meta.height}, expected 1024x1024`,
      );
      process.exit(1);
    }
    process.exit(0);
  }

  // REAL WRITE MODE: produce all three outputs.
  await ensureDir(outDir);

  // icon.png: flatten + removeAlpha — Apple requires no alpha.
  const iconPipeline = (await buildIcon1024({
    sourcePath: args.source,
    mode,
    bgHex: bg,
  }))
    .flatten({ background: bg })
    .removeAlpha()
    .png({ compressionLevel: 9 });

  const iconOut = path.join(outDir, "icon.png");
  const iconMeta = await writePipelineToFile(iconPipeline, iconOut);

  const adaptivePipeline = buildAdaptive1024(args.source);
  const adaptiveOut = path.join(outDir, "adaptive-icon.png");
  const adaptiveMeta = await writePipelineToFile(adaptivePipeline, adaptiveOut);

  const splashPipeline = buildSplash2048(args.source, bg);
  const splashOut = path.join(outDir, "splash.png");
  const splashMeta = await writePipelineToFile(splashPipeline, splashOut);

  // --- verification (T-260424-01 / T-260424-02 mitigation) ---
  let ok = true;
  if (iconMeta.width !== 1024 || iconMeta.height !== 1024) {
    console.error(
      `FAIL icon.png: ${iconMeta.width}x${iconMeta.height} (expected 1024x1024)`,
    );
    ok = false;
  }
  if (iconMeta.hasAlpha === true) {
    console.error("FAIL icon.png: hasAlpha=true (Apple rejects alpha)");
    ok = false;
  }
  if (iconMeta.channels !== 3) {
    console.error(
      `FAIL icon.png: channels=${iconMeta.channels} (expected 3 = RGB)`,
    );
    ok = false;
  }
  if (adaptiveMeta.width !== 1024 || adaptiveMeta.height !== 1024) {
    console.error(
      `FAIL adaptive-icon.png: ${adaptiveMeta.width}x${adaptiveMeta.height} (expected 1024x1024)`,
    );
    ok = false;
  }
  if (splashMeta.width !== 2048 || splashMeta.height !== 2048) {
    console.error(
      `FAIL splash.png: ${splashMeta.width}x${splashMeta.height} (expected 2048x2048)`,
    );
    ok = false;
  }
  if (splashMeta.hasAlpha === true) {
    console.error("FAIL splash.png: hasAlpha=true");
    ok = false;
  }

  if (!ok) {
    console.error("one or more outputs failed post-write verification");
    process.exit(1);
  }

  console.log("[ok] all outputs verified");
  process.exit(0);
} catch (err) {
  console.error(`error: ${err.message}`);
  process.exit(2);
}
