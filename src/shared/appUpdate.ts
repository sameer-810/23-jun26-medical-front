/**
 * Has a newer build been deployed than the one this tab is running?
 *
 * A counter tab stays open for days, so a deploy only reaches it on a reload —
 * a fix could be live while the shop keeps working on the old screen. Expo
 * hashes the entry bundle's filename, so comparing the hash this page loaded
 * with the one the host serves now answers the question without a version file.
 */
const ENTRY = /\/_expo\/static\/js\/web\/index-([a-f0-9]+)\.js/;

/** The entry bundle's hash in a page's HTML, or null if there isn't one. */
export function entryHash(html: string): string | null {
  return html.match(ENTRY)?.[1] ?? null;
}

/** Null on either side means "can't tell", which is never an update. */
export function isNewBuild(running: string | null, served: string | null) {
  return Boolean(running && served && running !== served);
}

/** The hash of the bundle this tab booted from. */
export function runningHash(): string | null {
  if (typeof document === "undefined") return null;
  const scripts = Array.from(document.scripts).map((s) => s.src);
  return entryHash(scripts.find((src) => ENTRY.test(src)) || "");
}

/** The hash the host serves now. `vcheck` keeps the service worker out of it. */
export async function servedHash(): Promise<string | null> {
  try {
    const res = await fetch(`/?vcheck=${Date.now()}`, { cache: "no-store" });
    return res.ok ? entryHash(await res.text()) : null;
  } catch {
    return null;
  }
}
