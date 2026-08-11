/**
 * Captures real screens of the running app into `store-assets/raw-screens/`
 * (phone) and `store-assets/raw-screens-tablet/` (tablet).
 *
 * These are genuine captures, not mockups — makeStoreScreenshots.mjs only
 * frames them. Three things must be true or the listing looks broken:
 *
 *  1. **The viewport must be a real phone WIDTH, scaled up by
 *     deviceScaleFactor.** 390x844 at 3x gives a 1170x2532 image of the phone
 *     layout. Setting the CSS viewport to 1170 instead renders the DESKTOP
 *     layout at phone proportions — sidebar and all — which is what the first
 *     run of this script produced.
 *  2. **No empty states.** Several screens read "No items yet" / "Nothing to
 *     reorder" until something is on them, and empty states measurably hurt
 *     conversion. The till is seeded with an in-stock medicine at a real price.
 *  3. The dev server must be running and the demo account must have data.
 *
 * Run:  npx expo start --web --port 8085
 *       node scripts/captureStoreScreens.mjs
 */
import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.BASE || "http://localhost:8085";
const EMAIL = process.env.DEMO_EMAIL || "admin@medstock.demo";
const PASSWORD = process.env.DEMO_PASSWORD || "Admin@123";

/**
 * CSS viewport x deviceScaleFactor = the pixel size Play receives.
 * Phone  390x844  @3x -> 1170x2532
 * Tablet 800x1280 @2x -> 1600x2560   (a real tablet layout, not a blown-up
 *                                     phone — Play rejects those)
 */
const TARGETS = [
  { key: "phone", dir: "raw-screens", w: 390, h: 844, dsf: 3, mobile: true },
  {
    key: "tablet",
    dir: "raw-screens-tablet",
    w: 800,
    h: 1280,
    dsf: 2,
    mobile: false,
  },
];

/**
 * A medicine the demo pharmacy actually holds stock of AND has a selling price
 * for. Both matter: no stock gives a red "Out of stock" line, and no price
 * gives a ₹0 grand total. Find one with:
 *
 *   db.stockitems.aggregate([{$group:{_id:"$productId",q:{$sum:"$quantity"}}},
 *     {$match:{q:{$gte:20}}}, ...lookup products where sellingPrice > 0])
 */
const IN_STOCK = process.env.DEMO_PRODUCT || "P 250 Tablet DT";

const SCREENS = [
  { name: "dashboard", route: "" },
  { name: "sale", route: "sales/new", seed: seedSaleLine },
  { name: "scanbill", route: "receive-stock/scan" },
  { name: "receive", route: "receive-stock" },
  { name: "inventory", route: "inventory" },
  { name: "shortbook", route: "shortbook" },
  { name: "expiry", route: "expiry" },
  { name: "reports", route: "reports" },
  { name: "invoices", route: "sales" },
  { name: "products", route: "products" },
];

/**
 * Puts one IN-STOCK medicine on the till at a real price, so the screenshot
 * shows a working sale rather than "No items yet" or a red out-of-stock line
 * totalling zero.
 */
/** True once a medicine is actually on the till (the empty state is gone). */
async function hasLine(page) {
  const t = await page.locator("body").innerText();
  return !/No items yet/i.test(t);
}

async function seedSaleLine(page) {
  const search = page.locator("input").first();
  await search.click();
  await search.fill(IN_STOCK);
  await page.waitForTimeout(4500);

  // Keyboard first — it works on both layouts and costs nothing. Falling back
  // to a click on the suggestion row covers the case where the list is a tap
  // target rather than a combobox.
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(3000);

  if (!(await hasLine(page))) {
    const row = page.getByText(IN_STOCK, { exact: true }).last();
    if (await row.count().catch(() => 0)) {
      await row.click({ timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(3000);
    }
  }

  // An empty billing screenshot is worse than none — say so loudly rather than
  // letting "No items yet" reach the listing.
  if (!(await hasLine(page))) {
    console.warn(
      `  ! SALE SEED FAILED — "${IN_STOCK}" did not add a line. ` +
        `Set DEMO_PRODUCT to a medicine with stock AND a selling price.`,
    );
  }

  // Give the line a quantity and a price. A ₹0 grand total on a billing
  // screenshot is worse than no screenshot.
  const fill = async (header, value) => {
    const h = page.getByText(header, { exact: true }).first();
    if (!(await h.count())) return;
    const hb = await h.boundingBox();
    if (!hb) return;
    for (const el of await page.locator("input").all()) {
      const b = await el.boundingBox();
      if (b && b.y > hb.y && b.y - hb.y < 90 && Math.abs(b.x - hb.x) < 90) {
        await el.fill(String(value));
        return;
      }
    }
  };
  // Quantity only — the price comes from the product, so overwriting it would
  // put a number on the screenshot that the app itself would never show.
  await fill("Qty", 3);
  await page.waitForTimeout(1500);

  // Drop focus so no cursor or open dropdown is caught in the shot.
  await page.keyboard.press("Escape");
  await page.mouse.click(6, 6);
  await page.waitForTimeout(1200);
}

async function login(page) {
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("input", { timeout: 300000 });
  await page.waitForTimeout(1500);
  await page.locator("input").nth(0).fill(EMAIL);
  await page.locator("input").nth(1).fill(PASSWORD);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(9000);
  const body = (await page.locator("body").innerText()).toLowerCase();
  if (!body.includes("dash"))
    throw new Error("login failed — check the demo credentials");
}

/**
 * Signs out before the context closes.
 *
 * Each browser context is a separate DEVICE as far as the app is concerned,
 * and the account is capped at three signed-in devices. Capturing phone then
 * tablet without signing out in between burns two slots and the second login
 * is refused — which is the app behaving correctly, and it silently produced a
 * run with no tablet captures at all.
 */
async function signOut(page) {
  let btn = page.locator('[aria-label="Sign out"]').first();
  if (!(await btn.count())) {
    // Phone: the sign-out lives in the drawer, behind the hamburger.
    const menu = page
      .locator('[aria-label*="menu" i], [aria-label*="drawer" i]')
      .first();
    if (await menu.count()) {
      await menu.click().catch(() => {});
      await page.waitForTimeout(1500);
      btn = page.locator('[aria-label="Sign out"]').first();
    }
  }
  if (await btn.count()) {
    await btn.click().catch(() => {});
    await page.waitForTimeout(3000);
  }
}

/** Collapses the desktop sidebar so the app itself fills the tablet frame. */
async function collapseSidebar(page) {
  const btn = page
    .locator('[aria-label*="ollapse" i], [aria-label*="sidebar" i]')
    .first();
  if (await btn.count()) {
    await btn.click().catch(() => {});
    await page.waitForTimeout(1200);
  }
}

const browser = await chromium.launch();

for (const t of TARGETS) {
  const outDir = path.join(ROOT, "store-assets", t.dir);
  fs.mkdirSync(outDir, { recursive: true });

  const ctx = await browser.newContext({
    viewport: { width: t.w, height: t.h },
    deviceScaleFactor: t.dsf,
    isMobile: t.mobile,
    hasTouch: t.mobile,
  });
  // Metro serves the first request of a new context cold; 30s is not enough.
  ctx.setDefaultNavigationTimeout(180000);
  // Short, so a locator that never matches fails fast instead of stalling the
  // whole run for two minutes per call.
  ctx.setDefaultTimeout(15000);
  const page = await ctx.newPage();
  await login(page);
  if (!t.mobile) await collapseSidebar(page);

  for (const s of SCREENS) {
    await page.goto(`${BASE}/${s.route}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(5000);
    if (s.seed) await s.seed(page);
    await page.screenshot({ path: path.join(outDir, `${s.name}.png`) });
    console.log(`${t.key}: ${s.name}`);
  }
  await signOut(page);
  await ctx.close();
}

await browser.close();
console.log(
  "\nraw captures written. Now run: node scripts/makeStoreScreenshots.mjs",
);
