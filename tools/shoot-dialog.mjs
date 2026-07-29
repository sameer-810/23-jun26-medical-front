/**
 * Validates the new PromptDialog (payment) that replaced the native-broken
 * window.prompt. Logs in, opens a customer, clicks Collect payment, and
 * screenshots the dialog. Does NOT submit — no data written.
 */
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const BASE = process.env.SHOOT_BASE || "http://localhost:8081";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, "../../auditshot/redesign");
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("PAGEERR:", String(e).slice(0, 200)));

try {
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 180000 });
  const email = page.locator('input[placeholder="you@company.com"]');
  await email.waitFor({ state: "visible", timeout: 180000 });
  await email.fill("admin@medstock.demo");
  await page.locator('input[type="password"]').first().fill("Admin@123");
  await page.getByText("Sign in", { exact: true }).click();
  await page.getByText("Dashboard").first().waitFor({ timeout: 60000 });
  console.log("logged in");

  await page.goto(BASE + "/customers", {
    waitUntil: "networkidle",
    timeout: 120000,
  });
  await sleep(2500);
  // Open a customer with outstanding credit.
  await page.getByText("City Care Hospital").first().click();
  await sleep(2500);
  await page.screenshot({
    path: path.join(OUT, "customer-detail-wide.png"),
    fullPage: true,
  });
  console.log("customer detail shot");

  // Open the payment dialog (replaces the old window.prompt).
  await page
    .getByText(/Collect payment/)
    .first()
    .click();
  await sleep(1000);
  await page.screenshot({
    path: path.join(OUT, "dialog-collect-payment.png"),
    fullPage: false,
  });
  console.log("payment dialog shot");
} catch (e) {
  console.error("SHOOT_FAIL:", String(e).slice(0, 500));
  await page
    .screenshot({ path: path.join(OUT, "_dialog_error.png") })
    .catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}
