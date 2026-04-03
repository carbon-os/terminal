#!/usr/bin/env node

import sharp from "sharp";
import { execSync } from "child_process";
import { mkdirSync, rmSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root      = resolve(__dirname, "..");

const SRC_PNG   = resolve(root, "resources/assets/logo.png");
const OUT_ICNS  = resolve(root, "resources/assets/logo.icns");
const ICONSET   = resolve(root, "resources/assets/logo.iconset");
const SHAPED    = resolve(root, "resources/assets/logo_shaped.png");

const SIZE    = 1024;
const PAD     = 60;          // transparent bleed around rounded rect
const RR      = SIZE - PAD * 2; // 904 — artwork area
const RADIUS  = 185;         // macOS Big Sur corner radius spec

// ── 1. Build rounded-rect mask as a raw alpha buffer ─────────────────────────
async function buildMask() {
  // Draw a white rounded rect on black via SVG, extract as alpha channel
  const svg = `
    <svg width="${RR}" height="${RR}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${RR}" height="${RR}"
            rx="${RADIUS}" ry="${RADIUS}"
            fill="white"/>
    </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

// ── 2. Shape the source PNG ───────────────────────────────────────────────────
async function shapeIcon() {
  console.log("  shaping icon...");

  const maskBuf = await buildMask();

  // Resize source artwork into the rounded rect area, remove any bg via
  // flatten→ensureAlpha keeps existing transparency; trimming removes solid
  // borders if present
  const artwork = await sharp(SRC_PNG)
    .trim()                                          // strip solid border/whitespace
    .resize(RR, RR, { fit: "contain",
                      background: { r:0,g:0,b:0,alpha:0 } })
    .ensureAlpha()
    .toBuffer();

  // Apply rounded rect mask
  const masked = await sharp(artwork)
    .composite([{ input: maskBuf, blend: "dest-in" }])
    .png()
    .toBuffer();

  // Drop shadow layer: blurred dark rounded rect
  const shadowSvg = `
    <svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
      <rect x="${PAD + 4}" y="${PAD + 10}"
            width="${RR}" height="${RR}"
            rx="${RADIUS}" ry="${RADIUS}"
            fill="rgba(0,0,0,0.45)"/>
    </svg>`;

  const shadow = await sharp(Buffer.from(shadowSvg))
    .blur(18)
    .png()
    .toBuffer();

  // Composite: transparent canvas → shadow → artwork
  await sharp({
    create: { width: SIZE, height: SIZE, channels: 4,
               background: { r:0, g:0, b:0, alpha:0 } }
  })
    .composite([
      { input: shadow,  top: 0,   left: 0   },
      { input: masked,  top: PAD, left: PAD },
    ])
    .png()
    .toFile(SHAPED);

  console.log(`  shaped → ${SHAPED}`);
}

// ── 3. Generate all iconset sizes ─────────────────────────────────────────────
const SIZES = [
  { file: "icon_16x16.png",        size: 16   },
  { file: "icon_16x16@2x.png",     size: 32   },
  { file: "icon_32x32.png",        size: 32   },
  { file: "icon_32x32@2x.png",     size: 64   },
  { file: "icon_128x128.png",      size: 128  },
  { file: "icon_128x128@2x.png",   size: 256  },
  { file: "icon_256x256.png",      size: 256  },
  { file: "icon_256x256@2x.png",   size: 512  },
  { file: "icon_512x512.png",      size: 512  },
  { file: "icon_512x512@2x.png",   size: 1024 },
];

async function generateIconset() {
  console.log("  generating iconset...");
  if (existsSync(ICONSET)) rmSync(ICONSET, { recursive: true });
  mkdirSync(ICONSET, { recursive: true });

  await Promise.all(
    SIZES.map(({ file, size }) =>
      sharp(SHAPED)
        .resize(size, size)
        .png()
        .toFile(resolve(ICONSET, file))
    )
  );
}

// ── 4. iconutil → .icns ───────────────────────────────────────────────────────
function buildIcns() {
  console.log("  running iconutil...");
  execSync(`iconutil -c icns "${ICONSET}" -o "${OUT_ICNS}"`);
}

// ── 5. Cleanup ────────────────────────────────────────────────────────────────
function cleanup() {
  rmSync(ICONSET, { recursive: true });
  rmSync(SHAPED);
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  try {
    await shapeIcon();
    await generateIconset();
    buildIcns();
    cleanup();
    console.log(`✓ icon → ${OUT_ICNS}`);
  } catch (err) {
    console.error("✗ format_icon failed:", err.message);
    process.exit(1);
  }
})();