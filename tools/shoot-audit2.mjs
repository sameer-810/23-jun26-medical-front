import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const BASE = "http://localhost:8081";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, "../../auditshot/compare");
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SCREENS = [
  ["/reports", "reports"],
  ["/pdc", "pdc"],
  ["/receive-stock/history", "receipts-history"],
  ["/medguide", "medguide"],
  ["/search", "search"],
  ["/settings", "settings"],
  ["/reminders", "reminders"],
];

const browser = await chromium.launch({ headless: true });
const page = await (
  await browser.newContext({ viewport: { width: 1440, height: 900 } })
).newPage();
page.on("pageerror", (e) => console.log("PAGEERR:", String(e).slice(0, 160)));

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

  for (const [route, name] of SCREENS) {
    try {
      await page.goto(BASE + route, {
        waitUntil: "networkidle",
        timeout: 60000,
      });
      await sleep(1400);
      await page.screenshot({
        path: path.join(OUT, `${name}.png`),
        fullPage: true,
      });
      console.log("shot", name);
    } catch (e) {
      console.log("SKIP", name, String(e).slice(0, 80));
    }
  }

  // one customer detail (credit ledger) — click first row on /customers
  try {
    await page.goto(BASE + "/customers", {
      waitUntil: "networkidle",
      timeout: 60000,
    });
    await sleep(1400);
    await page.mouse.click(400, 260);
    await sleep(1600);
    await page.screenshot({
      path: path.join(OUT, "customer-detail.png"),
      fullPage: true,
    });
    console.log("shot customer-detail");
  } catch (e) {
    console.log("SKIP customer-detail", String(e).slice(0, 80));
  }
} catch (e) {
  console.error("SHOOT_FAIL:", String(e).slice(0, 600));
} finally {
  await browser.close();
}
