/**
 * Builds `store-assets/play-icon-512.png` — the 512x512 icon Play shows beside
 * the listing and in search results.
 *
 * Unlike the feature graphic and screenshots, the icon slot DOES accept a
 * 32-bit PNG with alpha, so the source icon is resized rather than flattened.
 * Play still requires exactly 512x512 and under 1MB.
 *
 * Run: node scripts/makePlayIcon.mjs
 */
import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "assets", "icon.png");
const OUT = path.join(ROOT, "store-assets", "play-icon-512.png");

fs.mkdirSync(path.dirname(OUT), { recursive: true });

await sharp(SRC)
  .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile(OUT);

const meta = await sharp(OUT).metadata();
const kb = (fs.statSync(OUT).size / 1024).toFixed(0);
console.log(
  `wrote store-assets/play-icon-512.png — ${meta.width}x${meta.height}, ` +
    `${meta.channels} channels, ${kb}KB (Play limit 1MB)`,
);
