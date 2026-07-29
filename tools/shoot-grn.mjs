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
  await sleep(1600);
  await b.press("ArrowDown");
  await sleep(150);
  await b.press("Enter");
  await sleep(900);
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
  for (const q of ["1-al", "a to", "acne", "aero"]) await add(q);
  await page.mouse.click(5, 5);
  await sleep(600);
  await page.screenshot({
    path: path.join(OUT, "grn-wide.png"),
    fullPage: true,
  });
  console.log("grn wide shot");

  await page.setViewportSize({ width: 390, height: 844 });
  await sleep(800);
  await page.screenshot({
    path: path.join(OUT, "grn-narrow.png"),
    fullPage: true,
  });
  console.log("grn narrow shot");
} catch (e) {
  console.error("SHOOT_FAIL:", String(e).slice(0, 600));
  await page
    .screenshot({ path: path.join(OUT, "_grn_error.png") })
    .catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}
