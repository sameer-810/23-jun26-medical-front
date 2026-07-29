/**
 * Focused validation for the redesigned POS. Logs in, opens /sales/new, adds a
 * few products through the keyboard-first search, and screenshots the empty +
 * populated states at desktop and mobile widths. Does NOT complete the sale, so
 * no data is written.
 */
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const BASE = process.env.SHOOT_BASE || "http://localhost:8081";
const EMAIL = process.env.SHOOT_EMAIL || "admin@medstock.demo";
const PASSWORD = process.env.SHOOT_PASSWORD || "Admin@123";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, "../../auditshot/redesign");
fs.mkdirSync(OUT, { recursive: true });

const WIDE = { width: 1440, height: 900 };
const NARROW = { width: 390, height: 844 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: WIDE });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("PAGEERR:", String(e).slice(0, 200)));

async function shot(name) {
  await sleep(1200);
  const f = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: f, fullPage: true });
  console.log("shot", f);
}

async function addProduct(query) {
  const box = page.locator("#pos-search");
  await box.click();
  await box.fill(query);
  await sleep(1600); // let the server search resolve
  await box.press("ArrowDown");
  await sleep(150);
  await box.press("Enter");
  await sleep(900);
}

try {
  // login
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 180000 });
  const email = page.locator('input[placeholder="you@company.com"]');
  await email.waitFor({ state: "visible", timeout: 180000 });
  await email.fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  await page.getByText("Sign in", { exact: true }).click();
  await page.getByText("Dashboard").first().waitFor({ timeout: 60000 });
  console.log("logged in");

  // POS
  await page.goto(BASE + "/sales/new", {
    waitUntil: "networkidle",
    timeout: 120000,
  });
  await page.locator("#pos-search").waitFor({ timeout: 30000 });
  await shot("pos-after-empty-wide");

  for (const q of ["para", "amox", "cetiri", "vitamin"]) {
    await addProduct(q);
  }
  await page.mouse.click(5, 5); // dismiss dropdown
  await shot("pos-after-wide");

  await page.setViewportSize(NARROW);
  await sleep(800);
  await shot("pos-after-narrow");
} catch (e) {
  console.error("SHOOT_FAIL:", String(e).slice(0, 700));
  await page
    .screenshot({ path: path.join(OUT, "_pos_error.png") })
    .catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}
