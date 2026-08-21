/**
 * Signs in as the Play reviewer account and walks the screens a reviewer will
 * open, exactly as they would.
 *
 * An untested reviewer login is the most common reason a login-only app is
 * rejected, and "it works for me" usually means the developer was already
 * signed in. This starts from a cold browser with no session.
 *
 * The reviewer account is a real login on the live backend, so its password is
 * never stored here — it lives in the Play Console form and in the environment
 * of whoever runs this.
 *
 * Run:  REVIEWER_PASSWORD=… node tools/verifyReviewerLogin.mjs
 */
import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";

const BASE = process.env.BASE || "http://localhost:8085";
const EMAIL = process.env.REVIEWER_EMAIL;
const PASSWORD = process.env.REVIEWER_PASSWORD;
const OUT = path.resolve("../verify-evidence/reviewer");

if (!EMAIL || !PASSWORD) {
  console.error(
    "\nREVIEWER_EMAIL / REVIEWER_PASSWORD are not set.\n" +
      "This tool signs in to the live reviewer account, so the credential is never stored in the repo.\n" +
      "Run with:  REVIEWER_EMAIL='…' REVIEWER_PASSWORD='…' node tools/verifyReviewerLogin.mjs\n",
  );
  process.exit(1);
}

fs.mkdirSync(OUT, { recursive: true });

/** What the App access note tells the reviewer they can reach. */
const SCREENS = [
  ["", "Dashboard"],
  ["sales/new", "New sale"],
  ["inventory", "Stock on hand"],
  ["receive-stock/scan", "Scan a bill"],
  ["shortbook", "ShortBook"],
  ["expiry", "Expiry"],
  ["reports", "Reports"],
  ["team", "Team & Access"],
  ["settings", "Settings"],
];

const results = [];
const rec = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`[${ok ? "PASS" : "FAIL"}] ${id.padEnd(18)} ${detail}`);
};

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
ctx.setDefaultNavigationTimeout(180000);
ctx.setDefaultTimeout(30000);
const page = await ctx.newPage();

await page.goto(BASE, { waitUntil: "domcontentloaded" });
await page.waitForSelector("input", { timeout: 300000 });
await page.waitForTimeout(1500);
await page.locator("input").nth(0).fill(EMAIL);
await page.locator("input").nth(1).fill(PASSWORD);
await page.keyboard.press("Enter");
await page.waitForTimeout(9000);
await page.screenshot({ path: path.join(OUT, "00-after-login.png") });

const body = await page.locator("body").innerText();
if (/Welcome back|Sign in to your/i.test(body)) {
  rec(
    "Sign in",
    false,
    `rejected — ${body.split("\n").slice(0, 3).join(" / ")}`,
  );
  await browser.close();
  process.exit(1);
}
rec("Sign in", true, `signed in as ${EMAIL}`);

for (const [route, expect] of SCREENS) {
  await page.goto(`${BASE}/${route}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);
  const t = await page.locator("body").innerText();
  const ok = t.includes(expect);
  await page.screenshot({
    path: path.join(OUT, `${(route || "dashboard").replace(/\//g, "-")}.png`),
  });
  rec(
    expect,
    ok,
    ok ? `/${route || ""} reachable` : `"${expect}" not on /${route}`,
  );
}

const failed = results.filter((r) => !r.ok).length;
console.log(
  `\n${results.length - failed}/${results.length} — ${failed ? "NOT READY to submit" : "reviewer login is good"}`,
);
await browser.close();
process.exit(failed ? 1 : 0);
