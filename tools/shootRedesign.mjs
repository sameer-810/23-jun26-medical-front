/**
 * Photographs the redesigned screens at desktop and phone widths.
 *
 * The point is comparison: the same routes, the same demo tenant and the same
 * two viewports as the `ui-audit/` baseline the client reacted to, so "the
 * cards are smaller now" is something you can see side by side rather than
 * take on trust. Output lands in ../ui-audit/redesign/.
 *
 * Run: DEMO_PASSWORD=… node tools/shootRedesign.mjs   (web build on :8085)
 *
 * TWO THINGS HERE ARE LOAD-BEARING, both learned the hard way:
 *
 * 1. It seeds a FIXED device id and signs out at the end. The app enforces a
 *    concurrent-device limit, and each run used to log in from a fresh browser
 *    profile — a brand-new "device" every time, never signed out. Twenty runs
 *    later the demo admin hit its cap and could not log in at all, which had to
 *    be cleared with `scripts/clearSessions.mjs` on the backend. One stable id
 *    means repeat runs update one session instead of hoarding twenty.
 * 2. It asserts it actually got in before photographing anything. When login
 *    failed, every route redirected to /login and the script cheerfully wrote a
 *    full set of screenshots of the sign-in form. They look like perfectly good
 *    pages in a file listing; the only reason it was caught was that every file
 *    was byte-for-byte the same size. Evidence of the wrong thing is worse than
 *    no evidence, so a shoot that cannot see the app now fails loudly.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { DEMO_EMAIL, DEMO_PASSWORD } from "./demoCreds.mjs";

const B = process.env.BASE || "http://localhost:8085";
const OUT = path.resolve("../ui-audit/redesign");
const EMAIL = DEMO_EMAIL;
const PASSWORD = DEMO_PASSWORD;

/** Matches the client's localStorage key in src/shared/api/deviceId.ts. */
const DEVICE_KEY = "medstock-device-id";
const DEVICE_ID = "5c00b07f-0000-4000-8000-000000000001"; // "screenshot rig"

fs.mkdirSync(OUT, { recursive: true });

/**
 * The five screens the client looked at, plus the rest of the daily surfaces —
 * a redesign that only holds up on the photographed screens isn't one.
 */
const ROUTES = [
  ["", "dashboard"],
  ["products", "products"],
  ["inventory", "inventory"],
  ["sales/new", "sales-new"],
  ["receive-stock", "receive-stock"],
  ["sales", "sales-list"],
  ["customers", "customers"],
  ["suppliers", "suppliers"],
  ["expiry", "expiry"],
  ["shortbook", "shortbook"],
  ["pdc", "pdc"],
  ["reports", "reports"],
];

const VIEWPORTS = [
  ["desktop", { width: 1440, height: 900 }],
  ["phone", { width: 390, height: 844 }],
];

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: VIEWPORTS[0][1],
  deviceScaleFactor: 2,
});
ctx.setDefaultNavigationTimeout(180000);
ctx.setDefaultTimeout(30000);

// Seed the device id before any app code runs, so login reuses one session
// slot instead of registering a new device on every run.
await ctx.addInitScript(
  ([k, v]) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* private mode — the run still works, it just costs a session */
    }
  },
  [DEVICE_KEY, DEVICE_ID],
);

const page = await ctx.newPage();

await page.goto(B, { waitUntil: "domcontentloaded" });
await page.waitForSelector("input", { timeout: 300000 });
await page.waitForTimeout(1500);
await page.locator("input").nth(0).fill(EMAIL);
await page.locator("input").nth(1).fill(PASSWORD);
await page.keyboard.press("Enter");

try {
  // The sidebar only exists once authenticated.
  await page.waitForSelector("text=ShortBook", { timeout: 60000 });
} catch {
  await page.screenshot({ path: path.join(OUT, "LOGIN-FAILED.png") });
  await browser.close();
  console.error(
    "Still on the sign-in screen 60s after submitting — see " +
      'ui-audit/redesign/LOGIN-FAILED.png. If it reads "already signed in on ' +
      'N devices", run `node scripts/clearSessions.mjs` in the backend.',
  );
  process.exit(1);
}
await page.waitForTimeout(3000);

// One session, both viewports: resizing the page beats a second login.
for (const [label, viewport] of VIEWPORTS) {
  console.log(`${label} ${viewport.width}x${viewport.height}`);
  await page.setViewportSize(viewport);
  await page.waitForTimeout(1200);

  for (const [route, name] of ROUTES) {
    await page.goto(`${B}/${route}`, { waitUntil: "domcontentloaded" });
    // The data-heavy screens paint their lists after the query resolves.
    await page.waitForTimeout(5000);
    await page.screenshot({ path: path.join(OUT, `${label}-${name}.png`) });
    console.log(`  ${label}-${name}.png`);
  }
}

/**
 * Hand the session slot back. Without this the rig still leaks one device per
 * machine it's ever run on, which is how the cap was reached in the first place.
 */
try {
  // Back to a wide viewport first: at 390px the sidebar that holds the
  // sign-out control is behind a drawer, so the click never lands.
  await page.setViewportSize(VIEWPORTS[0][1]);
  await page.goto(`${B}/dashboard`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  const signOut = page.locator('[aria-label*="Sign out" i]').first();
  if (await signOut.count()) {
    await signOut.click();
    await page.waitForTimeout(2500);
    console.log("\nsigned out");
  } else {
    console.log("\nno sign-out control found — session left open");
  }
} catch {
  console.log("\nsign-out failed — session left open");
}

await browser.close();
console.log(`Wrote to ${OUT}`);
