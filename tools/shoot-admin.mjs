/**
 * Validates the reconciled superadmin console (AdminNav header). Logs in at
 * /admin as the platform admin and screenshots the pharmacies console.
 */
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const BASE = process.env.SHOOT_BASE || "http://localhost:8081";
const EMAIL = process.env.ADMIN_EMAIL || "superadmin@plusveda.app";
const PASSWORD = process.env.ADMIN_PASSWORD || "FiveM@810";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, "../../auditshot/redesign");
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ headless: true });
async function shoot(viewport, tag) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGEERR:", String(e).slice(0, 200)));
  try {
    await page.goto(BASE + "/admin", {
      waitUntil: "domcontentloaded",
      timeout: 180000,
    });
    const email = page.locator('input[placeholder="you@medstock.app"]');
    await email.waitFor({ state: "visible", timeout: 180000 });
    await email.fill(EMAIL);
    await page.locator('input[type="password"]').first().fill(PASSWORD);
    await page.getByText("Sign in", { exact: true }).click();
    // Text unique to the post-login console header (not the login page).
    await page
      .getByText("Manage every pharmacy")
      .first()
      .waitFor({ timeout: 60000 });
    await sleep(3000);
    await page.screenshot({
      path: path.join(OUT, `admin-${tag}.png`),
      fullPage: true,
    });
    console.log("admin shot", tag);
  } catch (e) {
    console.error("SHOOT_FAIL:", String(e).slice(0, 500));
    await page
      .screenshot({ path: path.join(OUT, `_admin_error_${tag}.png`) })
      .catch(() => {});
    process.exitCode = 1;
  } finally {
    await ctx.close();
  }
}

await shoot({ width: 1440, height: 900 }, "wide");
await shoot({ width: 390, height: 844 }, "narrow");
await browser.close();
