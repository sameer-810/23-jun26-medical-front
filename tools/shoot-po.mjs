import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";
const OUT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../auditshot/redesign",
);
const BASE = "http://localhost:8081";
const sleep = (m) => new Promise((r) => setTimeout(r, m));
const b = await chromium.launch({ headless: true });
const p = await (
  await b.newContext({ viewport: { width: 1440, height: 900 } })
).newPage();
p.on("pageerror", (e) => console.log("PAGEERR:", String(e).slice(0, 150)));
const box = 'input[placeholder*="Search by name or salt"]';
async function add(q) {
  const l = p.locator(box);
  await l.click();
  await l.fill(q);
  await sleep(1500);
  await l.press("ArrowDown");
  await sleep(120);
  await l.press("Enter");
  await sleep(800);
}
try {
  await p.goto(BASE, { waitUntil: "domcontentloaded", timeout: 180000 });
  await p
    .locator('input[placeholder="you@company.com"]')
    .waitFor({ timeout: 180000 });
  await p
    .locator('input[placeholder="you@company.com"]')
    .fill("admin@medstock.demo");
  await p.locator('input[type="password"]').first().fill("Admin@123");
  await p.getByText("Sign in", { exact: true }).click();
  await p.getByText("Dashboard").first().waitFor({ timeout: 60000 });
  await p.goto(BASE + "/orders/new", {
    waitUntil: "networkidle",
    timeout: 120000,
  });
  await p.locator(box).waitFor({ timeout: 30000 });
  for (const q of ["1-al", "a to", "acne"]) await add(q);
  await p.mouse.click(5, 5);
  await sleep(500);
  await p.screenshot({
    path: path.join(OUT, "po-form-wide.png"),
    fullPage: true,
  });
  console.log("po shot");
} catch (e) {
  console.error("FAIL", String(e).slice(0, 400));
  await p.screenshot({ path: path.join(OUT, "_po_err.png") }).catch(() => {});
  process.exitCode = 1;
} finally {
  await b.close();
}
