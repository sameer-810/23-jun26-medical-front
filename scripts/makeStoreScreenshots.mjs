/**
 * Builds the Play Store screenshots from real captures of the running app in
 * the `store-assets/raw-screens` and `store-assets/raw-screens-tablet` folders.
 *
 * Design targets come from published ASO research, not taste:
 *  - The headline must be readable at ~200px wide (the search-results
 *    thumbnail), because most users decide there and never open the listing.
 *    That sets the headline at ~88px on a 1080px canvas.
 *  - Headline in the top third — that is where the eye lands first.
 *  - Captions <= 6 words, one message per screenshot.
 *  - Each screen is framed on its hero element by sliding it vertically. The
 *    phone is NEVER scaled horizontally — cropping the UI's left/right edges
 *    makes a real screenshot look like a broken one.
 *  - Realistic data, never empty states (see captureStoreScreens.mjs).
 *  - Identical background, type and palette across all of them for recall.
 *
 * Run: node scripts/makeStoreScreenshots.mjs
 */
import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const sharp = require("sharp");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * One target per Play Console screenshot slot. Play accepts 320-3840px per
 * side with the longest side no more than twice the shortest, JPEG or 24-bit
 * PNG (no alpha), max 8MB. Tablet shots use the app's real tablet rendering —
 * Play explicitly warns against uploading enlarged phone frames, and this app
 * genuinely lays out differently at that width.
 */
const TARGETS = {
  phone: { w: 1080, h: 1920, raw: "raw-screens", out: "screenshots", scale: 1 },
  tab7: {
    w: 1200,
    h: 1920,
    raw: "raw-screens-tablet",
    out: "screenshots-tablet7",
    scale: 1,
  },
  tab10: {
    w: 1600,
    h: 2560,
    raw: "raw-screens-tablet",
    out: "screenshots-tablet10",
    scale: 1.333,
  },
};

/**
 * Order matters — Play shows the first 3-4 in the listing row and the first one
 * appears in search results, so the broadest-appeal screens lead.
 *
 * `offset` slides the screen vertically inside the phone (0 = top, 1 = bottom)
 * to frame that screen's hero element.
 *
 * Headlines say only what the screen actually shows. A listing that
 * overpromises earns refunds and one-star reviews.
 */
const SHOTS = [
  {
    src: "dashboard",
    title: "Your pharmacy\nat a glance",
    sub: "Stock, sales and expiry in one place",
    offset: 0,
  },
  {
    src: "sale",
    title: "Bill a customer\nin seconds",
    sub: "Scan or search · GST worked out for you",
    offset: 0,
  },
  // The differentiator: no counter software in this price range reads the
  // distributor's bill for you.
  {
    src: "scanbill",
    title: "Scan the\ndistributor's bill",
    sub: "Every product, batch and expiry read for you",
    offset: 0,
  },
  {
    src: "inventory",
    title: "Know exactly\nwhat you hold",
    sub: "Batch, expiry and value, live",
    offset: 0,
  },
  {
    src: "expiry",
    title: "Never sell\nexpired stock",
    sub: "Nearest expiry sold first, automatically",
    offset: 0,
  },
  {
    src: "shortbook",
    title: "Never run out\nof a fast mover",
    sub: "Reorder list built from what you sell",
    offset: 0,
  },
  {
    src: "receive",
    title: "Goods received,\nline by line",
    sub: "Matches your supplier's bill to the paisa",
    offset: 0,
  },
  // Breadth close.
  {
    src: "reports",
    title: "GST reports,\nready to file",
    sub: "Sales, expiry and stock, exportable",
    offset: 0,
  },
];

const b64 = (f) =>
  "data:image/png;base64," + fs.readFileSync(f).toString("base64");

/**
 * Deep Plusveda green (#073C21 -> #0C7942), straight off the app's own teal
 * ramp with #10A058 as the accent — the exact logo green.
 *
 * Dark on purpose, and the opposite of the call the AshShifa listing made.
 * That app has a cream UI and a consumer audience, so a light background
 * suited it. This app's UI is almost entirely white; on a pale background the
 * device would float with nothing to separate it. Dark green also reads as a
 * serious business tool rather than a consumer utility, which is what a
 * pharmacist scrolling a search row is deciding between.
 */
const css = (T) => `
*{margin:0;padding:0;box-sizing:border-box}
body{width:${T.w}px;height:${T.h}px;overflow:hidden;position:relative;
  font-family:"Segoe UI",-apple-system,Roboto,sans-serif;
  background:linear-gradient(165deg,#073C21 0%,#0A5730 54%,#0C7942 100%)}
/* Soft light top-right, deeper shade bottom-left — keeps the gradient from
   reading as flat and gives the device something to sit against. */
.glow{position:absolute;top:-420px;right:-330px;width:1200px;height:1200px;border-radius:50%;
  background:radial-gradient(circle,rgba(57,208,128,.30) 0%,rgba(57,208,128,0) 68%)}
.glow2{position:absolute;bottom:-520px;left:-350px;width:1000px;height:1000px;border-radius:50%;
  background:radial-gradient(circle,rgba(3,26,14,.55) 0%,rgba(3,26,14,0) 70%)}
.wrap{position:relative;height:100%;display:flex;flex-direction:column;align-items:center;padding:${86 * T.scale}px ${60 * T.scale}px 0}
.eyebrow{display:flex;align-items:center;gap:${13 * T.scale}px;margin-bottom:${24 * T.scale}px}
.eyebrow i{width:${26 * T.scale}px;height:2px;background:#39D080;display:block;opacity:.85}
.eyebrow span{font-size:${20 * T.scale}px;font-weight:700;letter-spacing:${4.6 * T.scale}px;color:#76DBA5;text-transform:uppercase}
/* 88px is the floor for staying legible at the 200px search thumbnail */
h1{font-size:${88 * T.scale}px;line-height:1.07;font-weight:700;letter-spacing:${-2.2 * T.scale}px;color:#FFFFFF;
  text-align:center;white-space:pre-line}
p{margin-top:${22 * T.scale}px;font-size:${35 * T.scale}px;line-height:1.4;font-weight:400;color:rgba(214,245,231,.78);text-align:center}
/* A real phone body, not a bare rounded rectangle. Top-grossing listings all
   ship framed mockups; an unframed export is the mark of a listing nobody has
   revisited. The frame also gives the app's white UI a hard edge against the
   green. Bleeds off the bottom: depth, not a floating rectangle. */
.device{margin-top:${52 * T.scale}px;width:${T.dw}px;height:${T.dh}px;border-radius:${T.radius}px;
  padding:${13 * T.scale}px;position:relative;
  background:linear-gradient(150deg,#3A3A3C,#1C1C1E 45%,#48484A);
  box-shadow:0 55px 120px rgba(2,18,10,.55),0 8px 24px rgba(0,0,0,.35)}
.screen{width:100%;height:100%;border-radius:${T.radius - 12}px;overflow:hidden;background:#000}
.screen img{width:100%;display:block;margin-top:var(--y)}
.btn{position:absolute;right:${-4 * T.scale}px;width:${5 * T.scale}px;background:#2C2C2E;border-radius:3px}
.b1{top:${300 * T.scale}px;height:${60 * T.scale}px}.b2{top:${400 * T.scale}px;height:${110 * T.scale}px}.b3{top:${530 * T.scale}px;height:${110 * T.scale}px}
`;

const stage = (s, T) => {
  // Screen height inside the bezel vs the source image's natural height at that
  // width — the difference is how far the screen can slide.
  const screenW = T.dw - 2 * 13 * T.scale;
  const natural = screenW * (T.srcH / T.srcW);
  const y = Math.round(-(natural - (T.dh - 2 * 13 * T.scale)) * s.offset);
  return `<div class="device">
    <div class="screen"><img style="--y:${y}px" src="${b64(path.join(T.rawDir, s.src + ".png"))}"></div>
    <i class="btn b1"></i><i class="btn b2"></i><i class="btn b3"></i>
  </div>`;
};

const html = (s, T) => `<style>${css(T)}</style>
<div class="glow"></div><div class="glow2"></div>
<div class="wrap">
  <div class="eyebrow"><i></i><span>Plusveda</span><i></i></div>
  <h1>${s.title}</h1>
  <p>${s.sub}</p>
  ${stage(s, T)}
</div>`;

const browser = await chromium.launch();

for (const [key, t] of Object.entries(TARGETS)) {
  const rawDir = path.join(ROOT, "store-assets", t.raw);
  const outDir = path.join(ROOT, "store-assets", t.out);
  if (!fs.existsSync(rawDir)) {
    console.log(`skip ${key} — no ${t.raw}/`);
    continue;
  }
  fs.mkdirSync(outDir, { recursive: true });

  // Source captures differ per target (phone 1170x2532, tablet 1600x2560), so
  // the device body is sized from the real aspect ratio rather than hard-coded.
  const probe = await sharp(
    path.join(rawDir, SHOTS[0].src + ".png"),
  ).metadata();
  const T = {
    ...t,
    rawDir,
    srcW: probe.width,
    srcH: probe.height,
    dw: 0,
    dh: 0,
    radius: Math.round(70 * t.scale),
  };
  T.dw = Math.round(t.w * 0.73);
  const pad = 13 * t.scale;
  const screenW = T.dw - 2 * pad;
  const naturalH = screenW * (T.srcH / T.srcW);
  // Phone captures are taller than the frame, so the screen crops and the body
  // bleeds off the bottom edge. Tablet captures are shorter — cap the body at
  // the image's own height so no black gap shows inside the bezel.
  T.dh = Math.round(Math.min(t.h * 0.822, naturalH + 2 * pad));

  const page = await browser.newPage({
    viewport: { width: t.w, height: t.h },
    deviceScaleFactor: 1,
  });
  let i = 1;
  for (const s of SHOTS) {
    const f = path.join(rawDir, s.src + ".png");
    if (!fs.existsSync(f)) {
      console.log("skip (no source)", key, s.src);
      continue;
    }
    await page.setContent(html(s, T), { waitUntil: "load" });
    await page.waitForTimeout(350);
    const buf = await page.screenshot();
    const out = path.join(
      outDir,
      String(i).padStart(2, "0") + "-" + s.src + ".png",
    );
    // Flatten: Play rejects screenshots carrying an alpha channel, and a
    // Playwright PNG keeps one even when nothing is transparent.
    await sharp(buf).flatten({ background: "#073C21" }).png().toFile(out);
    i++;
  }
  await page.close();
  console.log(
    `${key}: ${i - 1} written to store-assets/${t.out}/ (${t.w}x${t.h})`,
  );
}
await browser.close();
