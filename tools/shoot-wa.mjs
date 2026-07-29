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

  await page.goto(BASE + "/customers", {
    waitUntil: "networkidle",
    timeout: 120000,
  });
  await sleep(2000);
  await page.getByText("City Care Hospital").first().click();
  await sleep(2500);
  await page.screenshot({
    path: path.join(OUT, "wa-customer.png"),
    fullPage: true,
  });
  console.log("customer shot");

  await page.goto(BASE + "/sales", {
    waitUntil: "networkidle",
    timeout: 120000,
  });
  await sleep(2000);
  await page.getByText("INV-0016").first().click();
  await sleep(2500);
  await page.screenshot({
    path: path.join(OUT, "wa-sale.png"),
    fullPage: true,
  });
  console.log("sale shot");
} catch (e) {
  console.error("SHOOT_FAIL:", String(e).slice(0, 500));
  await page
    .screenshot({ path: path.join(OUT, "_wa_error.png") })
    .catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}
