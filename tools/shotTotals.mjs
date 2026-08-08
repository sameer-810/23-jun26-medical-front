/**
 * Types one line into the goods-received grid and checks the totals block
 * against a line taken off a real invoice — SHREE PIONEER PHARMA's GLYCOSTAR
 * M1 TAB, whose own printed figures are:
 *
 *   QNTY 5 × RATE 111.25 = VALUE 556.25
 *   Disc 16.69  ->  Taxable 539.56
 *   SGST 2.5% 13.49 + CGST 2.5% 13.49
 *
 * No Gemini call, so it is deterministic and repeatable.
 */
import { chromium } from "playwright";
import path from "node:path";

const BASE = "http://localhost:8085";
const OUT = path.resolve("../verify-evidence");

const b = await chromium.launch({ headless: true });
const page = await (
  await b.newContext({ viewport: { width: 1440, height: 980 } })
).newPage();

await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 300000 });
await page.waitForSelector("input", { timeout: 300000 });
await page.waitForTimeout(1500);
const inp = page.locator("input");
await inp.nth(0).fill("admin@medstock.demo");
await inp.nth(1).fill("Admin@123");
await page.keyboard.press("Enter");
await page.waitForTimeout(9000);

await page.goto(`${BASE}/receive-stock`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(6000);

// Pick any product so the row is real, then key the invoice line.
await page.getByText("Set product…", { exact: true }).first().click();
await page.waitForTimeout(2500);
await page.locator("input").last().fill("tab");
await page.waitForTimeout(4000);
const opt = page.locator('[role="button"]').filter({ hasText: /SKU|₹/ });
if (await opt.count()) await opt.first().click();
else await page.keyboard.press("Enter");
await page.waitForTimeout(3000);

/** Fill the grid cell sitting under a given header. */
async function cell(header, value) {
  const h = page.getByText(header, { exact: true }).first();
  const hb = await h.boundingBox();
  if (!hb) throw new Error(`no header ${header}`);
  const boxes = await page.locator("input").all();
  for (const el of boxes) {
    const b2 = await el.boundingBox();
    if (
      b2 &&
      Math.abs(b2.x + b2.width / 2 - (hb.x + hb.width / 2)) < 26 &&
      b2.y > hb.y
    ) {
      await el.fill(String(value));
      return true;
    }
  }
  throw new Error(`no cell under ${header}`);
}

await cell("QTY", 5);
await cell("RATE", 111.25);
await cell("DIS%", 3);
await cell("GST%", 5);
await page.waitForTimeout(1500);

await page.keyboard.press("Escape");
await page.waitForTimeout(800);
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(1200);
await page.screenshot({ path: path.join(OUT, "grn-totals-block.png") });

// 566.54 exact, 567.00 to pay — the bills print both, and so must we.
const body = await page.locator("body").innerText();
const want = ["556.25", "16.69", "539.56", "13.49", "566.54", "567.00"];
const hit = want.filter((v) => body.includes(v));
console.log(
  hit.length === want.length
    ? `PASS — totals match the invoice exactly: ${want.join(" / ")}`
    : `CHECK — matched ${hit.join(", ") || "none"} of ${want.join(", ")}`,
);

const inter = page.getByText("Inter (IGST)", { exact: true }).first();
if (await inter.count()) {
  await inter.click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, "grn-totals-igst.png") });
  const igst = await page.locator("body").innerText();
  console.log(
    igst.includes("26.98") && igst.includes("IGST")
      ? "PASS — inter-state switches to a single IGST 26.98"
      : "CHECK — IGST figure not found",
  );
}
await b.close();
