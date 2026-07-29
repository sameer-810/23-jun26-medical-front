/**
 * Chromium screenshot harness for redesign validation.
 *
 * Boots against a running `expo start --web` (http://localhost:8081) + backend,
 * logs in once, then screenshots each requested route at desktop + mobile widths
 * into auditshot/redesign/.
 *
 * Usage:
 *   node tools/shoot.mjs <label>:<route> [<label>:<route> ...]
 *   node tools/shoot.mjs sales:/sales dashboard:/dashboard
 * Defaults to the POS screen if no args are given.
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

const targets = (
  process.argv.slice(2).length ? process.argv.slice(2) : ["sales:/sales"]
).map((a) => {
  const i = a.indexOf(":");
  return { label: a.slice(0, i), route: a.slice(i + 1) };
});

const WIDE = { width: 1440, height: 900 };
const NARROW = { width: 390, height: 844 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function login(page) {
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 180000 });
  // First web bundle can take a while to compile+boot.
  const email = page.locator('input[placeholder="you@company.com"]');
  await email.waitFor({ state: "visible", timeout: 180000 });
  await email.fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  await page.getByText("Sign in", { exact: true }).click();
  // Wait until the app shell is up (sidebar shows the brand / Dashboard).
  await page
    .getByText("Dashboard", { exact: false })
    .first()
    .waitFor({ timeout: 60000 });
  await sleep(1500);
}

async function shoot(page, label, route, viewport, tag) {
  await page.setViewportSize(viewport);
  await page.goto(BASE + route, { waitUntil: "networkidle", timeout: 120000 });
  await sleep(2500); // let queries resolve + layout settle
  const file = path.join(OUT, `${label}-${tag}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log("shot", file);
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: WIDE, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("PAGEERR:", String(e).slice(0, 200)));

try {
  await login(page);
  console.log("logged in");
  for (const { label, route } of targets) {
    await shoot(page, label, route, WIDE, "wide");
    await shoot(page, label, route, NARROW, "narrow");
  }
} catch (e) {
  console.error("SHOOT_FAIL:", String(e).slice(0, 600));
  await page.screenshot({ path: path.join(OUT, "_error.png") }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}
