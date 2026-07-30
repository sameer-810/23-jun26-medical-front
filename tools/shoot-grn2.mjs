import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const BASE = "http://localhost:8081";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, "../../auditshot/redesign");
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ headless: true });
const page = await (
  await browser.newContext({ viewport: { width: 1440, height: 900 } })
).newPage();
page.on("pageerror", (e) => console.log("PAGEERR:", String(e).slice(0, 200)));

const box = 'input[placeholder*="Search a medicine to add a line"]';
async function add(q) {
  const b = page.locator(box);
  await b.click();
  await b.fill(q);
  await sleep(1500);
  await b.press("ArrowDown");
  await sleep(150);
  await b.press("Enter");
  await sleep(800);
}

try {
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page
    .locator('input[placeholder="you@company.com"]')
    .waitFor({ timeout: 180000 });
  await page
    .locator('input[placeholder="you@company.com"]')
    .fill("admin@medstock.demo");
  await page.locator('input[type="password"]').first().fill("Admin@123");
  await page.getByText("Sign in", { exact: true }).click();
  await page.getByText("Dashboard").first().waitFor({ timeout: 60000 });
  console.log("logged in");

  await page.goto(BASE + "/receive-stock", {
    waitUntil: "networkidle",
    timeout: 120000,
  });
  await page.locator(box).waitFor({ timeout: 30000 });
  await add("acne");
  await add("aero");

  // Fill a near-expiry date on row 1 (mfg is the first YYYY-MM, expiry the 2nd)
  const exp = page.locator('input[placeholder="YYYY-MM"]');
  await exp.nth(1).fill("2026-09"); // ~60 days out → "soon"
  // Free/scheme units on row 1 (the only input with a "0" placeholder)
  await page.locator('input[placeholder="0"]').first().fill("2");
  await sleep(700);
  await page.screenshot({
    path: path.join(OUT, "grn-shortexpiry.png"),
    fullPage: true,
  });
  console.log("short-expiry + free shot");

  // Now make row 1 already expired → red cell + hard-block banner
  await exp.nth(1).fill("2024-01");
  await sleep(700);
  await page.screenshot({
    path: path.join(OUT, "grn-expired.png"),
    fullPage: true,
  });
  console.log("expired-block shot");
} catch (e) {
  console.error("SHOOT_FAIL:", String(e).slice(0, 600));
  await page
    .screenshot({ path: path.join(OUT, "_grn2_error.png") })
    .catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}
