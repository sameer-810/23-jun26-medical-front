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
  await page.goto(BASE + "/dashboard", {
    waitUntil: "networkidle",
    timeout: 120000,
  });
  await sleep(1500);

  // Open palette with Ctrl+K
  await page.keyboard.press("Control+KeyK");
  await sleep(900);
  await page.screenshot({
    path: path.join(OUT, "cmdk-open.png"),
    fullPage: true,
  });
  console.log("cmdk open shot");

  // Type a fuzzy query
  await page.keyboard.type("expiry");
  await sleep(700);
  await page.screenshot({
    path: path.join(OUT, "cmdk-filtered.png"),
    fullPage: true,
  });
  console.log("cmdk filtered shot");

  // Enter to navigate
  await page.keyboard.press("Enter");
  await sleep(1400);
  await page.screenshot({
    path: path.join(OUT, "cmdk-navigated.png"),
    fullPage: true,
  });
  const url = page.url();
  console.log("navigated to", url);
} catch (e) {
  console.error("FAIL", String(e).slice(0, 400));
  process.exitCode = 1;
} finally {
  await browser.close();
}
