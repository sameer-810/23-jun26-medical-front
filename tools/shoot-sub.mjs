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
  await page.goto(BASE + "/sales/new", {
    waitUntil: "networkidle",
    timeout: 120000,
  });
  const box = page.locator("#pos-search");
  await box.waitFor({ timeout: 30000 });
  await box.click();
  await box.fill("aristomol");
  await sleep(1600);
  await box.press("ArrowDown");
  await sleep(150);
  await box.press("Enter");
  await sleep(1500); // availability load
  await page.screenshot({
    path: path.join(OUT, "sub-line.png"),
    fullPage: true,
  });
  console.log("line added");

  await page
    .getByRole("button", { name: "Find a same-salt substitute" })
    .first()
    .click();
  await sleep(1600);
  await page.screenshot({
    path: path.join(OUT, "sub-panel.png"),
    fullPage: true,
  });
  console.log("panel open");

  await page.getByText("Swap", { exact: true }).first().click();
  await sleep(1400);
  await page.screenshot({
    path: path.join(OUT, "sub-swapped.png"),
    fullPage: true,
  });
  console.log("swapped");
} catch (e) {
  console.error("FAIL", String(e).slice(0, 400));
  process.exitCode = 1;
} finally {
  await browser.close();
}
