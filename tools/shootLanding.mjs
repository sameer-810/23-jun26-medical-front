/**
 * Photographs the product for the landing page.
 *
 * Different job from `shootRedesign.mjs`, which documents every route for
 * comparison. This one produces a small number of images that have to survive
 * being blown up to 1200px on a marketing page, which means they cannot be
 * empty. A screenshot of "No items yet" proves the screen exists and nothing
 * else; the reference site the client sent shows a *working* till, and that is
 * the difference between a product shot and a placeholder.
 *
 * So it drives the app before it photographs it: it searches the catalogue,
 * adds real medicines to a real cart, and shoots the loaded state. Nothing is
 * saved — the sale is never completed, so no invoice is written to the demo
 * tenant.
 *
 * Run: DEMO_PASSWORD=… node tools/shootLanding.mjs   (web build on :8085)
 *
 * The device-id and sign-out handling is copied from shootRedesign.mjs and is
 * load-bearing for the same reason: the backend caps concurrent sessions, and
 * a rig that logs in from a fresh profile every run eventually locks the demo
 * admin out of its own account.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const B = process.env.BASE || "http://localhost:8085";
const OUT = path.resolve("../landing/public/shots");
const EMAIL = process.env.DEMO_EMAIL || "admin@medstock.demo";
const PASSWORD = process.env.DEMO_PASSWORD;

if (!PASSWORD) {
  console.error("DEMO_PASSWORD is not set. Refusing to guess.");
  process.exit(1);
}

const DEVICE_KEY = "medstock-device-id";
const DEVICE_ID = "5c00b07f-0000-4000-8000-000000000001";

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
ctx.setDefaultNavigationTimeout(180000);
ctx.setDefaultTimeout(30000);
await ctx.addInitScript(
  ([k, v]) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* private mode */
    }
  },
  [DEVICE_KEY, DEVICE_ID],
);

const page = await ctx.newPage();
await page.goto(B, { waitUntil: "domcontentloaded" });
await page.waitForSelector("input", { timeout: 300000 });
await page.waitForTimeout(1500);
await page.locator("input").nth(0).fill(EMAIL);
await page.locator("input").nth(1).fill(PASSWORD);
await page.keyboard.press("Enter");

try {
  await page.waitForSelector("text=ShortBook", { timeout: 60000 });
} catch {
  await page.screenshot({ path: path.join(OUT, "LOGIN-FAILED.png") });
  await browser.close();
  console.error("Never got past sign-in — see public/shots/LOGIN-FAILED.png");
  process.exit(1);
}
await page.waitForTimeout(3000);

const shot = async (name, opts = {}) => {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), ...opts });
  console.log(`  ${name}.png`);
};

/** Collapse the sidebar so the content gets the full frame where it helps. */
const setSidebar = async (collapsed) => {
  const btn = page
    .locator('[aria-label*="sidebar" i], [aria-label*="collapse" i]')
    .first();
  if (await btn.count()) {
    const isCollapsed = await page.evaluate(
      () => document.body.innerText.indexOf("CATALOGUE") === -1,
    );
    if (isCollapsed !== collapsed) {
      await btn.click();
      await page.waitForTimeout(800);
    }
  }
};

console.log("desktop 1440x900");

// ---- Dashboard -----------------------------------------------------------
await page.goto(`${B}/dashboard`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(6000);
await shot("dashboard");

// ---- A billing screen with an actual cart in it --------------------------
// Three searches, three picks. The terms are common salts so they hit the
// demo catalogue regardless of which products happen to be seeded.
await page.goto(`${B}/sales/new`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(5000);

const search = page.locator('input[placeholder*="Search medicine" i]').first();
let added = 0;
/*
 * A sellable line needs the product to be BOTH in stock and priced, and in
 * this demo tenant that is a narrow set: of 122 stocked products only five
 * have a selling price recorded and three or more units on hand. Picked from
 * GET /inventory/stock filtered on `available >= 3 && sellingPrice > 0`.
 *
 * The first two attempts at this shot failed on exactly that. Searching a
 * common salt gave a full cart of catalogue medicines the shop does not stock
 * ("Out of stock" on every row); searching stocked brand names gave rows at
 * ₹0 because their selling price was never entered. Neither is a picture you
 * put on a landing page.
 *
 * If this list goes stale, re-run that query rather than guessing — the gate
 * below will fail the shoot rather than let a broken cart through.
 */
for (const term of ["Dynapar", "ACTRAPID", "Aptidor", "MULMINA"]) {
  if (added >= 3) break;
  try {
    await search.click();
    await search.fill("");
    await page.waitForTimeout(400);
    await search.type(term, { delay: 60 });
    await page.waitForTimeout(2600);
    /*
     * The result rows are react-native-web pressables — plain divs with no
     * role, so there is nothing semantic to select on. `r-1loqt21` is the
     * generated class RN-Web gives anything with cursor:pointer, which is the
     * most stable handle available.
     *
     * `₹[1-9]` is not cosmetic filtering: a good part of the demo catalogue
     * has no selling price recorded, and a cart full of ₹0 lines is a worse
     * advert than no cart at all.
     */
    const hit = page
      .locator('div[class~="r-1loqt21"]')
      .filter({ hasText: /₹[1-9]/ })
      .first();
    if (await hit.count()) {
      const label = (await hit.innerText()).replace(/\s+/g, " ").slice(0, 46);
      await hit.click();
      await page.waitForTimeout(2000);
      added += 1;
      console.log(`    + ${label}`);
    }
  } catch {
    /* a term that finds nothing is not a failure — try the next */
  }
}
await search.fill("");
await page.waitForTimeout(1800);

/*
 * A cart is only worth photographing if it could actually be rung up. Fail
 * loudly rather than quietly shipping a marketing image of a broken sale.
 */
const blocked = await page.evaluate(() =>
  /Not enough stock|Out of stock/i.test(document.body.innerText),
);
console.log(`  cart has ${added} line(s); sellable: ${!blocked}`);
if (blocked || added < 2) {
  await shot("billing-REJECTED");
  console.error(
    "\nThe billing shot is not usable — the cart is short or flagged out of " +
      "stock. Check the search terms against /inventory and re-run.",
  );
  await browser.close();
  process.exit(1);
}
await shot("billing");

// ---- The data-heavy screens ---------------------------------------------
for (const [route, name] of [
  ["inventory", "inventory"],
  ["expiry", "expiry"],
  ["shortbook", "shortbook"],
  ["reports", "reports"],
  ["receive-stock", "receive"],
  ["products", "products"],
]) {
  await page.goto(`${B}/${route}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5500);
  await shot(name);
}

// ---- Phone, for the "it works on the counter and in your pocket" slot ----
console.log("phone 390x844");
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(1500);
for (const [route, name] of [
  ["dashboard", "phone-dashboard"],
  ["inventory", "phone-inventory"],
]) {
  await page.goto(`${B}/${route}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5500);
  await shot(name);
}

// ---- Hand the session slot back -----------------------------------------
try {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${B}/dashboard`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  const signOut = page.locator('[aria-label*="Sign out" i]').first();
  if (await signOut.count()) {
    await signOut.click();
    await page.waitForTimeout(2500);
    console.log("\nsigned out");
  } else {
    console.log("\nno sign-out control found — session left open");
  }
} catch {
  console.log("\nsign-out failed — session left open");
}

await browser.close();
console.log(`Wrote to ${OUT}`);
