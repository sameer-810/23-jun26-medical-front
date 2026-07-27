/**
 * Plusveda app icons — generated from an original, on-brand vector mark.
 *
 * The mark: a white medicine carton bearing a deep-teal medical cross, with a
 * second carton stacked behind it — i.e. "medical supplies in stock". Set on
 * the app's clinical-teal brand gradient (designSystem `gradient.hero`).
 *
 * Outputs:
 *   assets/icon.png            1024  full-bleed gradient + white mark (iOS rounds it)
 *   assets/adaptive-icon.png   1024  transparent fg, white mark in the Android safe zone
 *   assets/splash-icon.png     1024  self-contained rounded badge (shows on white splash)
 *   assets/favicon.png           48  web favicon
 *   assets/brand/logo.png      1024  the badge, for in-app use
 *
 * Run:  npm i sharp --no-save  &&  node scripts/genIcons.mjs
 */
import sharp from "sharp";
import fs from "fs";

// Brand colors (src/shared/designSystem.ts → gradient.hero / teal scale)
const G0 = "#14958F"; // teal 500
const G1 = "#0E7C7B"; // teal 600
const G2 = "#0A3B3A"; // teal 900
const CROSS = "#0A3B3A"; // deep teal cross on the white carton
const WHITE = "#FFFFFF";

const SIZE = 1024;

// The mark, centered on (0,0). Caller translates + scales it.
//   `box` = carton fill, `cross` = cross fill, `stack` = the carton behind.
function mark({
  box = WHITE,
  cross = CROSS,
  stack = "rgba(255,255,255,0.34)",
} = {}) {
  return `
    <!-- carton stacked behind (depth = "stock") -->
    <rect x="-216" y="-186" width="372" height="312" rx="40" fill="${stack}"/>
    <!-- front carton -->
    <rect x="-186" y="-156" width="372" height="312" rx="40" fill="${box}"/>
    <!-- lid seam -->
    <rect x="-186" y="-86" width="372" height="14" fill="rgba(10,59,58,0.10)"/>
    <!-- medical cross -->
    <rect x="-34" y="-92" width="68" height="184" rx="20" fill="${cross}"/>
    <rect x="-92" y="-34" width="184" height="68" rx="20" fill="${cross}"/>
  `;
}

const defs = `
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%"  stop-color="${G0}"/>
      <stop offset="55%" stop-color="${G1}"/>
      <stop offset="100%" stop-color="${G2}"/>
    </linearGradient>
    <linearGradient id="sheen" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"  stop-color="rgba(255,255,255,0.16)"/>
      <stop offset="45%" stop-color="rgba(255,255,255,0)"/>
    </linearGradient>
  </defs>`;

// 1) icon.png — full-bleed gradient + white mark
const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  ${defs}
  <rect width="${SIZE}" height="${SIZE}" fill="url(#g)"/>
  <rect width="${SIZE}" height="${SIZE}" fill="url(#sheen)"/>
  <g transform="translate(512,520) scale(1.62)">${mark()}</g>
</svg>`;

// 2) adaptive-icon.png — full-bleed gradient (matches iOS), mark kept inside the
//    Android safe zone (~66%) so it's never cropped by the launcher mask.
const adaptiveSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  ${defs}
  <rect width="${SIZE}" height="${SIZE}" fill="url(#g)"/>
  <rect width="${SIZE}" height="${SIZE}" fill="url(#sheen)"/>
  <g transform="translate(512,512) scale(1.18)">${mark()}</g>
</svg>`;

// 3) badge — self-contained rounded gradient tile (splash + brand logo)
const badgeSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  ${defs}
  <rect x="152" y="152" width="720" height="720" rx="158" fill="url(#g)"/>
  <rect x="152" y="152" width="720" height="720" rx="158" fill="url(#sheen)"/>
  <g transform="translate(512,516) scale(1.12)">${mark()}</g>
</svg>`;

async function png(svg, out, size = SIZE) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(out);
  console.log("  ✓", out);
}

async function main() {
  fs.mkdirSync("assets/brand", { recursive: true });
  console.log("Generating Plusveda icons…");
  await png(iconSvg, "assets/icon.png");
  await png(adaptiveSvg, "assets/adaptive-icon.png");
  await png(badgeSvg, "assets/splash-icon.png");
  await png(badgeSvg, "assets/brand/logo.png");
  await sharp("assets/icon.png")
    .resize(48, 48)
    .png()
    .toFile("assets/favicon.png");
  console.log("  ✓ assets/favicon.png");
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
