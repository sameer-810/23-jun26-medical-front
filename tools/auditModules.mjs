/**
 * Checks the four audit modules against the RUNNING app on a phone viewport,
 * and photographs each finding. Code inspection said what should happen; this
 * says what does.
 *
 * Run: node tools/auditModules.mjs
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const B = process.env.BASE || "http://localhost:8085";
const OUT = path.resolve("../verify-evidence/audit");
fs.mkdirSync(OUT, { recursive: true });

const out = [];
const rec = (id, state, detail) => {
  out.push({ id, state, detail });
  console.log(`[${state}] ${id.padEnd(26)} ${detail}`);
};

const b = await chromium.launch();
const ctx = await b.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
ctx.setDefaultNavigationTimeout(180000);
ctx.setDefaultTimeout(15000);
const p = await ctx.newPage();
const txt = () => p.locator("body").innerText();
const shot = (n) => p.screenshot({ path: path.join(OUT, `${n}.png`) });

await p.goto(B, { waitUntil: "domcontentloaded" });
await p.waitForSelector("input", { timeout: 300000 });
await p.waitForTimeout(1500);
await p.locator("input").nth(0).fill("admin@medstock.demo");
await p.locator("input").nth(1).fill("Admin@123");
await p.keyboard.press("Enter");
await p.waitForTimeout(9000);

const fab = () => p.locator('[aria-label^="Scan a pack"]');

// ---- MOD-01: the Scan button should be on Home ONLY -----------------------
for (const [route, name] of [
  ["", "Dashboard"],
  ["receive-stock", "Receive Stock"],
  ["sales/new", "New sale"],
  ["inventory", "Inventory"],
]) {
  await p.goto(`${B}/${route}`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(4500);
  const n = await fab().count();
  await shot(`mod01-${route.replace(/\//g, "-") || "home"}`);
  const wanted = name === "Dashboard";
  rec(
    `MOD-01 FAB on ${name}`,
    n > 0 === wanted ? "OK" : "DEFECT",
    n > 0
      ? wanted
        ? "present (correct — Home)"
        : "PRESENT on a secondary page — audit asks for Home only"
      : wanted
        ? "MISSING on Home"
        : "absent (correct)",
  );
}

// Does tapping it actually open the camera?
await p.goto(`${B}/receive-stock`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(4500);
if (await fab().count()) {
  await fab().first().click();
  await p.waitForTimeout(6000);
  const t = await txt();
  await shot("mod01-after-tap");
  const opened = /camera|scan a pack|allow|permission/i.test(t);
  rec(
    "MOD-01 tap opens camera",
    opened ? "OK" : "DEFECT",
    opened ? `landed on ${p.url().replace(B, "")}` : "nothing opened",
  );
  const modal = /batch number|qr code/i.test(t);
  rec(
    "MOD-01 camera chooser",
    modal ? "OK" : "MISSING",
    modal ? "chooser shown" : "no Batch-vs-QR chooser — goes straight to one",
  );
}

// ---- MOD-02: refill duration picker under Customer ------------------------
await p.goto(`${B}/sales/new`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(5000);
// The control is deliberately hidden for walk-in sales, so pick a customer.
const cust = p.getByText("Search name or mobile…", { exact: false }).first();
if (await cust.count()) {
  await cust.click().catch(() => {});
  await p.waitForTimeout(2500);
  // Rows read "Rajesh Kumar · +919811100001" — match the phone, not the name.
  const opt = p.getByText(/·\s*\+?\d{8,}/).first();
  if (await opt.count()) await opt.click({ timeout: 8000 }).catch(() => {});
  await p.waitForTimeout(3500);
}
const saleTxt = await txt();
await shot("mod02-new-sale");
rec(
  "MOD-02 refill picker",
  /REFILL REMINDER/i.test(saleTxt) ? "OK" : "MISSING",
  /REFILL REMINDER/i.test(saleTxt)
    ? "a duration control is on the billing form"
    : "no duration picker under Customer selection",
);

// ---- MOD-03: does the total keep its paise? -------------------------------
const search = p.locator("input").first();
await search.click();
await search.fill("BETADINE");
await p.waitForTimeout(4500);
await p.keyboard.press("ArrowDown");
await p.keyboard.press("Enter");
await p.waitForTimeout(4000);
// Price 389, disc 20%, GST 5 -> 389 - 77.80 = 311.20 taxable+tax combos
const setField = async (label, v) => {
  const h = p.getByText(label, { exact: true }).first();
  if (!(await h.count())) return;
  const hb = await h.boundingBox();
  for (const el of await p.locator("input").all()) {
    const bb = await el.boundingBox();
    if (bb && bb.y > hb.y && bb.y - hb.y < 90 && Math.abs(bb.x - hb.x) < 90) {
      await el.fill(String(v));
      return;
    }
  }
};
await setField("Price", 389);
await setField("Disc", 20);
await p.waitForTimeout(2500);
await p.keyboard.press("Escape");
await p.mouse.click(6, 6);
await p.waitForTimeout(1500);
await shot("mod03-totals");
const t3 = await txt();
const hasPaise = /₹\d+\.\d{2}/.test(t3);
rec(
  "MOD-03 exact paise shown",
  hasPaise ? "OK" : "DEFECT",
  hasPaise
    ? `decimals present: ${(t3.match(/₹\d+\.\d{2}/g) || []).slice(0, 4).join(", ")}`
    : "every money figure is whole rupees — no paise anywhere",
);
const roundOff = /round ?off/i.test(t3);
rec(
  "MOD-03 round-off line",
  roundOff ? "OK" : "MISSING",
  roundOff
    ? "round-off shown"
    : "no round-off line, so the paise are just gone",
);

// ---- MOD-04: receipt history ---------------------------------------------
await p.goto(`${B}/receive-stock/history`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(5500);
await shot("mod04-history-top");
const t4 = await txt();
rec(
  "MOD-04 date filter",
  /from|to date|date range/i.test(t4) ? "OK" : "MISSING",
  /from|to date|date range/i.test(t4)
    ? "date controls present"
    : "no date range pickers",
);
rec(
  "MOD-04 export",
  /export|download|pdf|csv/i.test(t4) ? "OK" : "MISSING",
  /export|download|pdf|csv/i.test(t4)
    ? "export action present"
    : "no PDF/CSV export",
);
// Scrollability: can the page actually move?
const before = await p.evaluate(() => window.scrollY);
await p.mouse.wheel(0, 3000);
await p.waitForTimeout(1500);
const after = await p.evaluate(() => window.scrollY);
const docH = await p.evaluate(() => document.documentElement.scrollHeight);
const winH = await p.evaluate(() => window.innerHeight);
await shot("mod04-history-scrolled");
rec(
  "MOD-04 scrollable",
  after > before || docH <= winH + 4 ? "OK" : "DEFECT",
  after > before
    ? `scrolled ${after - before}px`
    : docH <= winH + 4
      ? "fits on screen, nothing to scroll"
      : `content is ${docH}px in a ${winH}px window but will not scroll`,
);

fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(out, null, 2));
console.log(`\nevidence: ${OUT}`);
await b.close();
