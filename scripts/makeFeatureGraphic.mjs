/**
 * Builds the Google Play feature graphic (1024x500) from real app captures in
 * `store-assets/raw-screens/`.
 *
 * Hard rules from Play's spec:
 *  - Exactly 1024x500, JPEG or 24-bit PNG, **no alpha channel**. Alpha is one
 *    of the two most common rejection causes, so the output is flattened
 *    before it is written.
 *  - Keep everything that matters inside the centre 860x480, with a 70-80px
 *    buffer from every edge — Play crops this image differently per surface.
 *  - If a promo video is ever attached, Play renders a 96x96 play button dead
 *    centre (x 464-560, y 202-298). That band is left empty, so adding a video
 *    later cannot cover the headline.
 *
 * Design rules from ASO research:
 *  - A clean app-UI crop with one benefit-led message beats a stock photo.
 *  - The graphic should match the screenshots and short description, not look
 *    like a disconnected ad banner — hence the same deep green background and
 *    the same headline as screenshot 01.
 *  - Five to seven words maximum. This uses four.
 *  - No store badges, no "Download now", no price or ranking claims; those get
 *    listings rejected.
 *  - Don't repeat the app icon here: Play already shows it beside this image.
 *
 * Run: node scripts/makeFeatureGraphic.mjs [--guides]
 *   --guides writes a separate copy with the safe zone (green) and play-button
 *   dead zone (red) drawn on top, for checking placement.
 */
import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const sharp = require("sharp");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAW = path.join(ROOT, "store-assets", "raw-screens");
const SHOW_GUIDES = process.argv.includes("--guides");
const OUT = path.join(
  ROOT,
  "store-assets",
  SHOW_GUIDES ? "feature-graphic-GUIDES.png" : "feature-graphic-1024x500.png",
);

const im = (n) =>
  "data:image/png;base64," +
  fs.readFileSync(path.join(RAW, n + ".png")).toString("base64");

const html = `<style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:1024px;height:500px;overflow:hidden;position:relative;
  font-family:"Segoe UI",-apple-system,Roboto,sans-serif;
  background:linear-gradient(165deg,#073C21 0%,#0A5730 54%,#0C7942 100%)}
.glow{position:absolute;right:-200px;top:-240px;width:860px;height:860px;border-radius:50%;
  background:radial-gradient(circle,rgba(57,208,128,.32) 0%,rgba(57,208,128,0) 68%)}
/* Text block sits entirely left of the play-button dead zone (x 464). */
.copy{position:absolute;left:82px;top:0;height:500px;width:378px;z-index:5;
  display:flex;flex-direction:column;justify-content:center}
.eyebrow{display:flex;align-items:center;gap:11px;margin-bottom:18px}
.eyebrow i{width:24px;height:2px;background:#39D080;display:block}
.eyebrow span{font-size:18px;font-weight:700;letter-spacing:4.2px;color:#76DBA5;text-transform:uppercase}
h1{font-size:56px;line-height:1.06;font-weight:700;letter-spacing:-1.5px;color:#FFFFFF}
.rule{width:52px;height:3px;background:#39D080;border-radius:2px;margin:20px 0 16px}
p{font-size:20px;line-height:1.35;color:rgba(214,245,231,.80)}
/* Two phones: the front one carries the message, the one behind hints at depth
   without adding a second message. Both bleed off the bottom edge. */
.ph{position:absolute;border-radius:34px;padding:7px;overflow:hidden;
  background:linear-gradient(150deg,#3A3A3C,#1C1C1E 45%,#48484A)}
.ph .s{width:100%;height:100%;border-radius:28px;overflow:hidden;background:#000}
.ph img{width:100%;display:block}
.front{right:210px;top:60px;width:238px;height:520px;z-index:3;
  box-shadow:0 34px 74px rgba(2,18,10,.55)}
.back{right:60px;top:104px;width:206px;height:450px;z-index:2;opacity:.96;
  box-shadow:0 26px 56px rgba(2,18,10,.45)}
.safe{position:absolute;left:82px;top:10px;width:860px;height:480px;outline:2px dashed rgba(0,255,180,.9);z-index:9}
.dead{position:absolute;left:464px;top:202px;width:96px;height:96px;z-index:9;
  outline:2px dashed rgba(255,70,70,1);background:rgba(255,70,70,.18)}
</style>
<div class="glow"></div>
<!-- Behind: scanning the distributor's bill — the one thing competitors in
     this bracket don't do, so it earns the second slot over inventory. -->
<div class="ph back"><div class="s"><img src="${im("scanbill")}"></div></div>
<div class="ph front"><div class="s"><img src="${im("dashboard")}"></div></div>
<div class="copy">
  <div class="eyebrow"><i></i><span>Plusveda</span></div>
  <h1>Your pharmacy,<br>under control</h1>
  <div class="rule"></div>
  <p>Billing · Stock · Expiry · GST</p>
</div>
${SHOW_GUIDES ? '<div class="safe"></div><div class="dead"></div>' : ""}`;

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1024, height: 500 },
  deviceScaleFactor: 1,
});
await page.setContent(html, { waitUntil: "load" });
await page.waitForTimeout(350);
const buf = await page.screenshot();
await browser.close();

// Flatten — Play rejects PNGs carrying an alpha channel.
await sharp(buf).flatten({ background: "#073C21" }).png().toFile(OUT);
const meta = await sharp(OUT).metadata();
const kb = (fs.statSync(OUT).size / 1024).toFixed(0);
console.log(
  `wrote ${path.relative(ROOT, OUT)} — ${meta.width}x${meta.height}, ` +
    `${meta.channels} channels (needs 3), ${kb}KB`,
);
