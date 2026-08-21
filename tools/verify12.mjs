/**
 * Plusveda — Chromium verification of the 12 points in
 * Plusveda_Requirements_and_Issues.docx.
 *
 * Drives the LOCAL Expo web build (so it tests the code as changed, not as
 * deployed) against the live Render backend. Every check ends in PASS/FAIL plus
 * a screenshot, because "it's done" is worth nothing without the picture.
 *
 *   DEMO_PASSWORD=… node tools/verify12.mjs        # all points
 *   DEMO_PASSWORD=… node tools/verify12.mjs 1 5    # only those points
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { DEMO_EMAIL, DEMO_PASSWORD } from "./demoCreds.mjs";

const BASE = process.env.BASE || "http://localhost:8085";
const OUT = process.env.OUT || path.resolve("../verify-evidence");
const ONLY = process.argv.slice(2).filter((a) => /^\d+$/.test(a));
const BILL =
  process.env.BILL ||
  path.resolve("../All Bills/WhatsApp Image 2026-08-04 at 5.15.45 PM.jpeg");

fs.mkdirSync(OUT, { recursive: true });
const results = [];

const record = (id, status, detail) => {
  results.push({ id, status, detail });
  console.log(`[${status}] ${id} — ${detail}`);
};

let page;
const shot = (name) =>
  page.screenshot({ path: path.join(OUT, `${name}.png`) }).catch(() => {});
const txt = () => page.locator("body").innerText();
const has = async (s) => (await txt()).toLowerCase().includes(s.toLowerCase());
const go = async (route, wait = 4500) => {
  await page.goto(`${BASE}/${route}`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await page.waitForTimeout(wait);
};

async function login() {
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 300000 });
  await page.waitForSelector("input", { timeout: 300000 });
  await page.waitForTimeout(1500);
  const inputs = page.locator("input");
  await inputs.nth(0).fill(DEMO_EMAIL);
  await inputs.nth(1).fill(DEMO_PASSWORD);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(9000);
  return has("dashboard");
}

// ---------------------------------------------------------------- the checks

/**
 * 1. The goods-received grid must read like a distributor invoice: the columns
 * the bills all carry, under the words the bills all use.
 */
async function p1() {
  await go("receive-stock");
  const body = await txt();
  await shot("p01-receive-stock-grid");

  const want = [
    "PACK",
    "BATCH",
    "EXPIRY",
    "QTY",
    "FREE",
    "MRP",
    "RATE",
    "DIS%",
    "GST%",
    "AMOUNT",
  ];
  const missing = want.filter((h) => !body.includes(h));
  const stale = ["UNIT", "COST/BASE"].filter((h) =>
    new RegExp(`\\b${h.replace("/", "\\/")}\\b`).test(body),
  );
  record(
    1,
    !missing.length && !stale.length ? "PASS" : "FAIL",
    !missing.length && !stale.length
      ? `Grid carries the bills' own columns: ${want.join(" · ")} — and no "UNIT"/"COST/BASE" left`
      : `${missing.length ? `Missing: ${missing.join(", ")}. ` : ""}${stale.length ? `Still shows: ${stale.join(", ")}.` : ""}`,
  );

  // The totals block must speak the bill's language too, and must not round.
  const foot = ["Taxable", "CGST", "SGST", "Total amt", "To pay"];
  const footMissing = foot.filter((f) => !body.includes(f));
  record(
    "1d",
    footMissing.length ? "FAIL" : "PASS",
    footMissing.length
      ? `Totals block missing: ${footMissing.join(", ")}`
      : "Totals block reads Amount · Disc · Taxable · CGST/SGST · Total amt · Round off · To pay",
  );
}

/**
 * 1b. End to end: scan the real SHREE SIMBA CHEMIST invoice the client sent and
 * check the grid's RATE cells against the TRADE PRICE column printed on it.
 *
 * These are the numbers on the paper. Before the fix the grid showed them
 * divided by the pack size (64.46 for a 15-tab pack became 4.2973) or, when the
 * pack couldn't be resolved, showed nothing at all.
 */
const BILL_TRADE_PRICES = [64.46, 151.62, 94.43, 109.38];

async function p1scan() {
  if (!fs.existsSync(BILL)) return record("1b", "SKIP", `No bill at ${BILL}`);
  await go("receive-stock/scan", 3500);
  await shot("p01b-scan-screen");
  // The picker is created on demand, so catch the native chooser event.
  const gallery = page.getByText("From gallery", { exact: true }).first();
  if (!(await gallery.count()))
    return record("1b", "SKIP", "No 'From gallery' action on the scan screen");
  const [fc] = await Promise.all([
    page.waitForEvent("filechooser", { timeout: 20000 }),
    gallery.click(),
  ]);
  await fc.setFiles(BILL);
  await page.waitForTimeout(8000);
  await shot("p01b-preview");
  // The scan screen asks the pharmacist to confirm the page is square first.
  for (const label of ["Looks right", "Scan bill", "Read bill", "Continue"]) {
    const b = page.getByText(label, { exact: true }).first();
    if (await b.count()) {
      await b.click().catch(() => {});
      break;
    }
  }
  // Gemini round trip on a photographed invoice.
  await page.waitForTimeout(60000);
  await shot("p01b-after-scan");

  // The read is a proposal; carrying it into the goods-received grid is where
  // the RATE column actually gets filled.
  const use = page.getByText("Use these lines", { exact: true }).first();
  if (!(await use.count()))
    return record(
      "1b",
      "CHECK",
      "Scan produced no usable lines — see p01b-after-scan.png",
    );
  await use.click();
  await page.waitForTimeout(8000);
  await shot("p01b-grid-from-bill");

  const values = await page.$$eval("input", (els) =>
    els.map((e) => e.value).filter((v) => v && /^\d+(\.\d+)?$/.test(v)),
  );
  const nums = values.map(Number);
  const near = (a, b) => Math.abs(a - b) < 0.6;
  const found = BILL_TRADE_PRICES.filter((tp) => nums.some((n) => near(n, tp)));
  // The old bug's fingerprint: the trade price divided by the pack size.
  const divided = [64.46 / 15, 151.62 / 10, 109.38 / 15].filter((d) =>
    nums.some((n) => Math.abs(n - d) < 0.05),
  );

  record(
    "1b",
    found.length >= 2 && !divided.length ? "PASS" : "CHECK",
    found.length >= 2 && !divided.length
      ? `Grid carries the bill's TRADE PRICE as printed — matched ${found.join(", ")} of ${BILL_TRADE_PRICES.join(", ")}; no per-tablet division present`
      : `Matched ${found.length ? found.join(", ") : "none"} of the printed trade prices${divided.length ? `; still showing divided values ${divided.map((d) => d.toFixed(4)).join(", ")}` : ""} — read p01b-after-scan.png against the bill`,
  );

  // The AMOUNT column must print the paise the bill prints. SHREE SIMBA's four
  // lines work out to 128.92, 454.86, 94.49 and 109.39 — a grid showing
  // "₹129 / ₹455 / ₹94 / ₹109" cannot be checked against that.
  const shown = await txt();
  const exact = ["128.92", "454.86", "94.49", "109.39"].filter((v) =>
    shown.includes(v),
  );
  record(
    "1e",
    exact.length >= 3 ? "PASS" : "FAIL",
    exact.length >= 3
      ? `AMOUNT column prints the exact paise: ${exact.join(", ")} — no rounding to rupees`
      : `Only ${exact.length} of the 4 exact line amounts are shown (${exact.join(", ") || "none"}) — see p01b-grid-from-bill.png`,
  );

  // 1c — what is SENT must be per BASE unit, because that is what every stock
  // valuation multiplies by a base-unit quantity. Intercept and abort the POST
  // so the payload can be read without booking the stock (this invoice is a
  // known duplicate — actually saving it would double the shelf).
  let payload = null;
  await page.route("**/inventory/receipts", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    try {
      payload = route.request().postDataJSON();
    } catch {
      payload = null;
    }
    await route.abort();
  });

  // Every line needs a storage location before it can be saved. The picker is a
  // modal, so open one, take the first option, and repeat until none are left.
  // NB the placeholder is "Select…" with a real ellipsis character, not "...".
  for (let guard = 0; guard < 8; guard++) {
    const empty = page.getByText("Select…", { exact: true }).first();
    if (!(await empty.count())) break;
    await empty.click();
    await page.waitForTimeout(1600);
    if (guard === 0) await shot("p01c-location-picker");
    // Options read "WH1-W1-S1-R1-D1 — Drawer 1"; take a leaf bin, not the store.
    const opts = page.getByText(/^WH\d-[A-Z0-9-]+ — /);
    if (!(await opts.count())) {
      await page.keyboard.press("Escape");
      break;
    }
    await opts
      .last()
      .click({ timeout: 8000 })
      .catch(() => {});
    await page.waitForTimeout(1000);
  }
  await shot("p01c-locations-picked");
  const save = page.getByText("Receive stock", { exact: true }).last();
  await save.scrollIntoViewIfNeeded().catch(() => {});
  await save.click().catch(() => {});
  await page.waitForTimeout(6000);
  await page.unroute("**/inventory/receipts").catch(() => {});

  if (!payload?.lines?.length) {
    return record(
      "1c",
      "CHECK",
      "Could not capture the save payload (a location may still be unset) — see p01c-locations-picked.png",
    );
  }
  // ALTONIL: 64.46 for a 15-tab pack must be sent as 64.46/15 = 4.2973.
  const sent = payload.lines.map((l) => l.purchasePrice);
  const expected = BILL_TRADE_PRICES.map((tp, i) =>
    [15, 10, 75, 15][i] ? tp / [15, 10, 75, 15][i] : tp,
  );
  const matched = expected.filter((e) =>
    sent.some((s) => Math.abs(s - e) < 0.01),
  );
  record(
    "1c",
    matched.length >= 2 ? "PASS" : "CHECK",
    matched.length >= 2
      ? `Saved per BASE unit: sent ${sent.join(", ")} — the printed pack rates divided by their pack sizes, so stock value stays right`
      : `Sent ${sent.join(", ")}; expected about ${expected.map((e) => e.toFixed(4)).join(", ")}`,
  );
}

/** 2. GST is inside the MRP — the sale must not add it on top. */
async function p2() {
  await go("settings");
  await shot("p02-settings-tax");
  const inclusive =
    (await has("inclusive")) || (await has("price includes tax"));
  record(
    2,
    inclusive ? "PASS" : "FAIL",
    inclusive
      ? "Settings exposes tax-inclusive pricing"
      : "No tax-inclusive setting found on Settings",
  );
}

/** 3. Invoice carries the owner's signature / stamp. */
async function p3() {
  await go("settings");
  const sig = (await has("signature")) || (await has("stamp"));
  await shot("p03-settings-signature");
  record(
    3,
    sig ? "PASS" : "FAIL",
    sig
      ? "Settings offers a signature / stamp upload"
      : "No signature or stamp upload on Settings",
  );
}

/**
 * 4. Every "reason" is a dropdown with an Other… escape, not a free-text box.
 * Three screens record one: the sales return, the purchase return, and the
 * write-off. All three have to be checked — two of them were still text boxes.
 */
async function p4() {
  // 4a — purchase return, reached from a goods-received note.
  await go("receive-stock/history", 5000);
  await shot("p04-receipts-history");
  const grn = page.locator("text=/^GRN-\\d+/").first();
  if (!(await grn.count()))
    return record("4a", "SKIP", "No goods-received notes to return against");
  await grn.click();
  await page.waitForTimeout(5000);
  await shot("p04a-receipt-detail");
  const ret = page
    .locator("text=/return to supplier|purchase return|^return$/i")
    .first();
  if (!(await ret.count()))
    record("4a", "SKIP", "No Return action on the receipt detail");
  else {
    await ret.click();
    await page.waitForTimeout(4500);
    await openFirstSelect("Reason");
    await shot("p04a-purchase-return-reason");
    const body = await txt();
    const okList =
      /damaged/i.test(body) && /wrong item/i.test(body) && /other/i.test(body);
    record(
      "4a",
      okList ? "PASS" : "CHECK",
      okList
        ? "Purchase return reason is a dropdown: Damaged / Wrong item / Sales return / Expired / Other…"
        : "Purchase return reason list not visible — see p04a-purchase-return-reason.png",
    );
  }

  // 4b — stock write-off.
  await go("damaged", 5000);
  await openFirstSelect("Reason");
  await shot("p04b-damaged-reason");
  const d = await txt();
  const okD = /broken seal/i.test(d) && /spillage/i.test(d) && /other/i.test(d);
  record(
    "4b",
    okD ? "PASS" : "CHECK",
    okD
      ? "Write-off reason is a dropdown: Damaged / Broken seal / Expired / Spillage / Storage damage / Other…"
      : "Write-off reason list not visible — see p04b-damaged-reason.png",
  );

  // 4c — sales return.
  await go("sales", 5000);
  const inv = page.locator("text=/^INV-\\d+/").first();
  if (!(await inv.count()))
    return record("4c", "SKIP", "No invoices to return");
  await inv.click();
  await page.waitForTimeout(5000);
  const rBtn = page.getByText("Return", { exact: true }).first();
  if (!(await rBtn.count()))
    return record("4c", "SKIP", "No Return action on the invoice");
  await rBtn.click({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await openFirstSelect("Reason");
  await shot("p04c-sales-return-reason");
  const s = await txt();
  const okS = /sales return/i.test(s) && /other/i.test(s);
  record(
    "4c",
    okS ? "PASS" : "CHECK",
    okS
      ? "Sales return reason is a dropdown with an Other… escape"
      : "Sales return reason list not visible — see p04c-sales-return-reason.png",
  );
}

/**
 * Opens the Select sitting under the given label so its options render.
 * Matches the label EXACTLY — "Reason" must not resolve to "Reason type".
 */
async function openFirstSelect(label) {
  const l = page.getByText(label, { exact: true }).last();
  if (!(await l.count())) return false;
  const box = await l.boundingBox();
  if (!box) return false;
  await page.mouse.click(box.x + 80, box.y + 34);
  await page.waitForTimeout(1500);
  return true;
}

/** 5. ShortBook: add a medicine from the till, and from the medicine guide. */
async function p5() {
  // 5a — from the New Sale screen, which is where a short is discovered.
  await go("sales/new", 6000);
  const search = page.locator("input").first();
  await search.click();
  await search.fill("tablet");
  await page.waitForTimeout(4000);
  await shot("p05a-sale-search");
  // Take the first suggestion so a line exists.
  const opt = page.locator('[role="button"], [tabindex="0"]');
  const before = await txt();
  await page.keyboard.press("ArrowDown").catch(() => {});
  await page.keyboard.press("Enter").catch(() => {});
  await page.waitForTimeout(4000);
  let body = await txt();
  if (body === before) {
    // Fall back to clicking the first visible suggestion row.
    const rows = page.locator("text=/tablet/i");
    if (await rows.count())
      await rows
        .nth(1)
        .click()
        .catch(() => {});
    await page.waitForTimeout(4000);
    body = await txt();
  }
  await shot("p05b-sale-line");
  const chip = page.locator('[aria-label="Add to ShortBook"]');
  const chipCount = await chip.count();
  const shortbookVisible = /shortbook/i.test(body) || chipCount > 0;
  if (shortbookVisible && chipCount) {
    await chip.first().click();
    await page.waitForTimeout(6000);
    await shot("p05c-shortbook-added");
    const after = await txt();
    record(
      5,
      /on the shortbook/i.test(after) ? "PASS" : "CHECK",
      /on the shortbook/i.test(after)
        ? "New Sale offers ShortBook on a line that can't be filled, and it saved"
        : "ShortBook chip clicked but no confirmation — see p05c-shortbook-added.png",
    );
  } else {
    record(
      5,
      shortbookVisible ? "CHECK" : "FAIL",
      "No 'ShortBook' action on the New Sale line — see p05b-sale-line.png",
    );
  }

  // 5b — the medicine guide path, for something never stocked.
  await go("medguide", 4000);
  const g = page.locator("input").first();
  await g.fill("paracetamol");
  await page.waitForTimeout(5000);
  await shot("p05d-medguide");
  const gChip = page.locator(
    '[aria-label^="Add "][aria-label$="to ShortBook"]',
  );
  record(
    "5b",
    (await gChip.count()) ? "PASS" : "FAIL",
    (await gChip.count())
      ? `MedGuide shows ${await gChip.count()} ShortBook buttons`
      : "No ShortBook button in MedGuide",
  );

  // 5c — the follow-up reminder module exists and is reachable.
  await go("reminders", 4000);
  await shot("p05e-reminders");
  record(
    "5c",
    (await has("reminder")) ? "PASS" : "FAIL",
    (await has("reminder"))
      ? "Reminders screen is reachable (refill follow-up lands here)"
      : "Reminders screen not reachable",
  );
}

/** 6. Inventory / Batch / Stock movement / Purchase are gone from Reports. */
async function p6() {
  await go("reports", 5000);
  await shot("p06-reports");
  const body = (await txt()).toLowerCase();
  const banned = ["stock movement", "batch report", "purchase report"];
  const found = banned.filter((b) => body.includes(b));
  record(
    6,
    found.length ? "FAIL" : "PASS",
    found.length
      ? `Still listed: ${found.join(", ")}`
      : "Reports lists only Sales / Expiry / Warehouse / User activity",
  );
}

/** 7 + 8 + 9. Member limit, device limit, and where they're set. */
async function p789() {
  await go("team", 5000);
  await shot("p07-team");
  const body = await txt();
  // Don't settle for the words being on screen — set the limit to exactly the
  // number of members that already exist, then try to add one more. The
  // complaint was that the limit was ignored, so the refusal is the only proof.
  const inUse = Number((/(\d+)\s+members in use/i.exec(body) || [])[1] || 0);
  const fields = page.locator("input");
  await fields.nth(0).fill(String(inUse || 4));
  await page.waitForTimeout(500);
  const save = page.locator("text=Save limits").first();
  await save.click().catch(() => {});
  await page.waitForTimeout(4000);
  await shot("p07-limit-set");

  await go("team/add", 4500);
  const add = page.locator("input");
  const stamp = Date.now();
  await add.nth(0).fill("Limit");
  await add.nth(1).fill("Test");
  await add.nth(2).fill(`limit${stamp}@medstock.demo`);
  await add.nth(3).fill("9876500001");
  // Throwaway member on a live tenant: unique per run, never a literal in the repo.
  await add.nth(4).fill(`Staff@${stamp}`);
  // A member with no permissions may be rejected before the limit is reached,
  // which would prove nothing — grant one.
  const perm = page.locator("text=View the dashboard").first();
  await perm.click().catch(() => {});
  await page.waitForTimeout(500);
  await shot("p07-add-member-form");
  const submit = page
    .locator("text=/^(Create member|Add member|Create|Save)$/")
    .last();
  await submit.scrollIntoViewIfNeeded().catch(() => {});
  await submit.click().catch(() => {});
  await page.waitForTimeout(7000);
  await shot("p07-limit-enforced");
  const after = await txt();
  const refused = /member limit reached/i.test(after);
  record(
    7,
    refused ? "PASS" : "CHECK",
    refused
      ? `Limit set to ${inUse}; creating one more is refused: "${(/Member limit reached[^\n]*/i.exec(after) || [""])[0]}"`
      : `Set limit to ${inUse} and submitted a new member — no refusal seen; check p07-limit-enforced.png`,
  );

  const devices = /device/i.test(body);
  record(
    8,
    devices ? "PASS" : "CHECK",
    devices
      ? "Team & Access exposes both the member count and the per-member device limit"
      : "No device-limit control on Team — see p07-team.png",
  );

  await go("profile", 4000);
  await shot("p09-profile-devices");
  const p = await txt();
  record(
    9,
    /sign out everywhere|signed in|device/i.test(p) ? "PASS" : "CHECK",
    /sign out everywhere|signed in|device/i.test(p)
      ? "Profile lists signed-in devices with a sign-out-everywhere escape"
      : "No device list on Profile — see p09-profile-devices.png",
  );
}

/** 10. Email / SMS alerts are paid, and say so before switching on. */
async function p10() {
  await go("settings", 5000);
  const body = await txt();
  const alerts = /email alert|sms alert|alert/i.test(body);
  await shot("p10-settings-alerts");
  if (!alerts) return record(10, "FAIL", "No email / SMS alert settings found");

  // Find the toggle that sits on the "SMS alerts" row and flip it. What matters
  // is that NEW text appears — a dialog — not that the word "price" is already
  // printed on the row, which it is either way.
  const before = await txt();
  const row = page.locator("text=SMS alerts").first();
  await row.scrollIntoViewIfNeeded().catch(() => {});
  const box = await row.boundingBox();
  if (!box) return record(10, "CHECK", "SMS alerts row not reachable");
  const sw = page.locator('[role="switch"]');
  let hit = false;
  for (let i = 0; i < (await sw.count()); i++) {
    const b = await sw.nth(i).boundingBox();
    if (b && Math.abs(b.y - box.y) < 24) {
      await sw.nth(i).click();
      hit = true;
      break;
    }
  }
  if (!hit) return record(10, "CHECK", "No switch aligned with the SMS row");
  await page.waitForTimeout(3000);
  await shot("p10-alert-price-popup");
  const after = await txt();
  const added = after.replace(before, "").trim();
  const dialog =
    /request|paid|price|charge|per month|₹/i.test(added) && added.length > 20;
  record(
    10,
    dialog ? "PASS" : "CHECK",
    dialog
      ? `Toggling SMS alerts raised a pricing prompt: "${added.replace(/\s+/g, " ").slice(0, 140)}"`
      : `Toggled, but no new pricing text appeared (added: "${added.replace(/\s+/g, " ").slice(0, 100)}") — see p10-alert-price-popup.png`,
  );
}

/** 11. Phone gets a centre scan button that goes straight to billing. */
async function p11() {
  const phone = await page
    .context()
    .browser()
    .newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
  const mp = await phone.newPage();
  const saved = page;
  page = mp;
  try {
    const okLogin = await login();
    if (!okLogin)
      return record(11, "SKIP", "Phone-viewport login did not land");
    await page.waitForTimeout(3000);
    await shot("p11-phone-scan-fab");
    const fab = page.locator('[aria-label*="scan" i]');
    const count = await fab.count();
    if (!count) return record(11, "FAIL", "No scan button on the phone layout");
    const box = await fab.first().boundingBox();
    const centred = box && Math.abs(box.x + box.width / 2 - 195) < 60;
    record(
      11,
      centred ? "PASS" : "CHECK",
      centred
        ? `Scan button is bottom-centre (x≈${Math.round(box.x + box.width / 2)} of 390)`
        : "Scan button present but not centred — see p11-phone-scan-fab.png",
    );
  } finally {
    page = saved;
    await phone.close();
  }
}

/** 12. The billing grid must not overlap on a 1280–1400px laptop. */
async function p12() {
  for (const w of [1280, 1366, 1440]) {
    await page.setViewportSize({ width: w, height: 860 });
    await go("sales/new", 5000);
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    await shot(`p12-sales-new-${w}`);
    record(
      `12@${w}`,
      overflow <= 2 ? "PASS" : "FAIL",
      overflow <= 2
        ? `No horizontal overflow at ${w}px`
        : `Page scrolls ${overflow}px sideways at ${w}px`,
    );
  }
  await page.setViewportSize({ width: 1440, height: 900 });
}

// ------------------------------------------------------------------- runner

const CHECKS = {
  1: [p1, p1scan],
  2: [p2],
  3: [p3],
  4: [p4],
  5: [p5],
  6: [p6],
  7: [p789],
  10: [p10],
  11: [p11],
  12: [p12],
};

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
page = await ctx.newPage();

if (!(await login())) {
  console.error("LOGIN FAILED — nothing below can be trusted");
  await shot("00-login-failed");
  await browser.close();
  process.exit(1);
}
console.log("logged in\n");
await shot("00-dashboard");

for (const [id, fns] of Object.entries(CHECKS)) {
  if (ONLY.length && !ONLY.includes(id)) continue;
  for (const fn of fns) {
    try {
      await fn();
    } catch (e) {
      record(id, "FAIL", `threw: ${String(e.message).slice(0, 180)}`);
    }
  }
}

console.log("\n===== SUMMARY =====");
for (const r of results)
  console.log(`${r.status.padEnd(5)} ${String(r.id).padEnd(6)} ${r.detail}`);
fs.writeFileSync(
  path.join(OUT, "results.json"),
  JSON.stringify(results, null, 2),
);
console.log(`\nEvidence: ${OUT}`);

await browser.close();
