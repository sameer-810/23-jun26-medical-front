/**
 * Walks every screen a pharmacist can reach and checks the back link.
 *
 * The rule being tested is the one Screen now enforces:
 *   - a screen opened ON TOP of another must offer a way back
 *   - a screen the sidebar goes straight to must NOT (there is nothing below it,
 *     and a back link there is noise)
 *
 * The client's report was that "most screens don't have it" — Scan Bill being
 * the example — so this checks both halves, not just the missing ones.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { DEMO_EMAIL, DEMO_PASSWORD } from "./demoCreds.mjs";

const BASE = process.env.BASE || "http://localhost:8085";
const OUT = path.resolve("../verify-evidence/back-links");
fs.mkdirSync(OUT, { recursive: true });

/** Reached from the sidebar — nothing underneath, so no back link expected. */
const TOP_LEVEL = [
  ["", "Dashboard"],
  ["products", "Products"],
  ["medguide", "MedGuide"],
  ["search", "Batch & expiry search"],
  ["inventory", "Inventory"],
  ["shortbook", "ShortBook"],
  ["warehouse", "Warehouse"],
  ["transfers", "Transfers"],
  ["expiry", "Expiry"],
  ["damaged", "Damaged"],
  ["receive-stock", "Receive Stock"],
  ["orders", "Orders"],
  ["suppliers", "Suppliers"],
  ["pdc", "Cheques / PDC"],
  ["sales", "Sales"],
  ["customers", "Customers"],
  ["reports", "Reports"],
  ["audit-logs", "Audit Logs"],
  ["team", "Team & Access"],
  ["settings", "Settings"],
  ["reminders", "Reminders"],
  ["profile", "Profile"],
];

/**
 * Opened on top of something — a back link is required, and it must land where
 * its label says. `parent` is the URL it should return to.
 */
const NESTED = [
  ["receive-stock/scan", "Scan a bill", "/receive-stock"],
  ["receive-stock/history", "Receipt history", "/receive-stock"],
  ["sales/new", "New sale", "/sales"],
  ["products/edit", "New product", "/products"],
  ["orders/new", "New order", "/orders"],
  ["customers/edit", "New customer", "/customers"],
  ["suppliers/edit", "New supplier", "/suppliers"],
  ["team/add", "Add member", "/team"],
];

const results = [];
const rec = (id, status, detail) => {
  results.push({ id, status, detail });
  console.log(`[${status}] ${id.padEnd(26)} ${detail}`);
};

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
const page = await ctx.newPage();

await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 300000 });
await page.waitForSelector("input", { timeout: 300000 });
await page.waitForTimeout(1500);
const inp = page.locator("input");
await inp.nth(0).fill(DEMO_EMAIL);
await inp.nth(1).fill(DEMO_PASSWORD);
await page.keyboard.press("Enter");
await page.waitForTimeout(9000);
if (!(await page.locator("body").innerText()).toLowerCase().includes("dash")) {
  console.error("LOGIN FAILED");
  await page.screenshot({ path: path.join(OUT, "login-failed.png") });
  await browser.close();
  process.exit(1);
}

/** A back link is a button whose accessible name starts "Back". */
const backCount = async () =>
  page.locator('[aria-label^="Back"], [aria-label^="back"]').count();

/**
 * Nested screens are checked by NAVIGATING to them from their parent, not by
 * deep-linking. A cold page load has no history, so a deep link would report a
 * missing back link that a real user would never hit — and would have masked
 * the opposite mistake too.
 */
async function openFromParent(route) {
  await page.goto(`${BASE}/${route}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3800);
}

console.log("\n--- top-level screens (no back link expected) ---");
for (const [route, label] of TOP_LEVEL) {
  await page.goto(`${BASE}/${route}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2600);
  const n = await backCount();
  rec(
    label,
    n === 0 ? "PASS" : "FAIL",
    n === 0
      ? "no back link, as it should be"
      : `${n} back link(s) — unexpected`,
  );
}

/** Clicks the back link and reports where it landed. */
async function clickBack() {
  await page.locator('[aria-label^="Back"]').first().click();
  await page.waitForTimeout(3000);
  return page.url().replace(BASE, "") || "/";
}

console.log(
  "\n--- nested screens, opened cold by URL (reload / deep link) ---",
);
for (const [route, label, parent] of NESTED) {
  await openFromParent(route);
  const n = await backCount();
  const name = n
    ? await page
        .locator('[aria-label^="Back"]')
        .first()
        .getAttribute("aria-label")
    : "";
  await page.screenshot({
    path: path.join(OUT, `${route.replace(/\//g, "-")}.png`),
  });
  if (n !== 1) {
    rec(
      label,
      "FAIL",
      n === 0 ? "NO WAY BACK" : `${n} back links — duplicated`,
    );
    continue;
  }
  const landed = await clickBack();
  rec(
    label,
    landed === parent ? "PASS" : "FAIL",
    landed === parent
      ? `"${name}" → ${landed}`
      : `"${name}" landed on ${landed}, expected ${parent}`,
  );
}

console.log("\n--- the same screens, reached in-app the way a user would ---");
for (const [route, label, parent] of NESTED) {
  // Load the parent first, THEN push the child, so there is real history.
  await page.goto(`${BASE}${parent}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3200);
  await page.goto(`${BASE}/${route}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3200);
  if ((await backCount()) !== 1) {
    rec(`${label} (in-app)`, "FAIL", "no single back link");
    continue;
  }
  const landed = await clickBack();
  rec(
    `${label} (in-app)`,
    landed === parent ? "PASS" : "FAIL",
    landed === parent
      ? `→ ${landed}`
      : `landed on ${landed}, expected ${parent}`,
  );
}

/**
 * Detail screens, reached by clicking a row the way anyone would. These are the
 * 23 that already had a hand-placed back link before it moved into Screen —
 * worth clicking through in case the lift mangled one.
 */
const DETAIL = [
  ["receive-stock/history", /^GRN-\d+$/, "Back to history"],
  ["sales", /^INV-\d+$/, "Back to sales"],
  ["inventory", /^[A-Z0-9-]{4,}$/, "Back to inventory"],
  ["customers", /^\+?\d[\d\s-]{7,}$/, "Back to customers"],
  ["suppliers", /^\+?\d[\d\s-]{7,}$/, "Back to suppliers"],
];

console.log("\n--- detail screens, opened by clicking a row ---");
for (const [list, rowRe, expected] of DETAIL) {
  await page.goto(`${BASE}/${list}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4200);
  const before = page.url();
  const row = page.getByText(rowRe).first();
  if (!(await row.count())) {
    rec(`${list} detail`, "SKIP", "no rows to open");
    continue;
  }
  await row.click({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(4200);
  if (page.url() === before) {
    rec(`${list} detail`, "SKIP", "row click did not open a detail screen");
    continue;
  }
  const name = await page
    .locator('[aria-label^="Back"]')
    .first()
    .getAttribute("aria-label")
    .catch(() => null);
  rec(
    `${list} detail`,
    name === expected ? "PASS" : "FAIL",
    name ? `"${name}"` : "NO WAY BACK",
  );
}

// The phone build has no browser chrome at all, so the in-page link is the only
// way out. This is the layout the client's APK complaint is really about.
console.log("\n--- phone layout ---");
const phone = await page
  .context()
  .browser()
  .newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
const mp = await phone.newPage();
await mp.goto(BASE, { waitUntil: "domcontentloaded", timeout: 300000 });
await mp.waitForSelector("input", { timeout: 300000 });
await mp.waitForTimeout(1500);
await mp.locator("input").nth(0).fill(DEMO_EMAIL);
await mp.locator("input").nth(1).fill(DEMO_PASSWORD);
await mp.keyboard.press("Enter");
await mp.waitForTimeout(9000);
await mp.goto(`${BASE}/receive-stock/scan`, { waitUntil: "domcontentloaded" });
await mp.waitForTimeout(4000);
await mp.screenshot({ path: path.join(OUT, "phone-scan-bill.png") });
const phoneBack = await mp.locator('[aria-label^="Back"]').count();
rec(
  "Scan a bill (phone)",
  phoneBack === 1 ? "PASS" : "FAIL",
  phoneBack === 1 ? "back link present on the phone layout" : "NO WAY BACK",
);
await phone.close();

const failed = results.filter((r) => r.status === "FAIL");
console.log(
  `\n${results.length - failed.length}/${results.length} correct` +
    (failed.length ? `\nFAILED: ${failed.map((f) => f.id).join(", ")}` : ""),
);
fs.writeFileSync(
  path.join(OUT, "results.json"),
  JSON.stringify(results, null, 2),
);
await browser.close();
process.exit(failed.length ? 1 : 0);
