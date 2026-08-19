/**
 * Zebra Browser Print — raw printing from a browser.
 *
 * Browser Print is a small service Zebra ships that runs on the counter PC and
 * listens on localhost. A web page posts ZPL to it and it hands those bytes
 * straight to the printer. That is the whole point: the print dialog, the
 * driver's paper size, the scale setting and the browser's header and footer
 * are all bypassed, because none of them are in the path any more.
 *
 * It has to be installed on the machine with the printer — it is not something
 * the web app can provide. So everything here is written to fail quietly: if
 * the service is not running, the caller falls back to the PDF and the shop is
 * no worse off than before.
 *
 * Talking to it over plain fetch rather than Zebra's SDK, which ships as two
 * non-module script tags with no types and no npm package — a poor trade for
 * three endpoints.
 */

/**
 * HTTPS first. The app is served over https, and a browser blocks an http
 * subresource from an https page as mixed content — 9101 is Browser Print's TLS
 * port and exists for exactly this. 9100 is kept for a shop running the app
 * from http, and costs one failed request to find out.
 */
const BASES = ["https://127.0.0.1:9101", "http://127.0.0.1:9100"];

/** How long to wait before deciding the service isn't there. */
const PROBE_MS = 1500;

export interface ZebraDevice {
  name?: string;
  deviceType?: string;
  connection?: string;
  uid?: string;
  provider?: string;
  manufacturer?: string;
}

export interface ZebraLink {
  base: string;
  device: ZebraDevice;
}

async function ask(
  url: string,
  init?: RequestInit,
  timeoutMs = PROBE_MS,
): Promise<Response | null> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: abort.signal });
  } catch {
    // Not installed, not running, certificate not trusted, blocked by the
    // browser's private-network rules — all the same answer to the caller.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Find the service and the printer it would use, or null.
 *
 * Asks for the DEFAULT device rather than making the pharmacist choose: a shop
 * with a label printer has one, and Browser Print already knows which. A shop
 * with two can set the default in the Browser Print app itself, which is where
 * that setting belongs.
 */
export async function findZebraPrinter(): Promise<ZebraLink | null> {
  if (typeof window === "undefined" || typeof fetch === "undefined")
    return null;

  for (const base of BASES) {
    const res = await ask(`${base}/default?type=printer`);
    if (!res?.ok) continue;
    try {
      // Older builds answer with a bare device name rather than JSON.
      const text = await res.text();
      const device: ZebraDevice = text.trim().startsWith("{")
        ? JSON.parse(text)
        : { name: text.trim(), deviceType: "printer" };
      if (device?.name || device?.uid) return { base, device };
    } catch {
      // Malformed answer means this isn't a service we can drive.
    }
  }
  return null;
}

/**
 * Send raw ZPL. Resolves true only if the service accepted the job.
 *
 * The write timeout is generous because a long run is a large graphic payload
 * over localhost, and giving up early would leave the shop unsure whether the
 * labels are coming.
 */
export async function sendZpl(link: ZebraLink, zpl: string): Promise<boolean> {
  const res = await ask(
    `${link.base}/write`,
    {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: JSON.stringify({ device: link.device, data: zpl }),
    },
    20_000,
  );
  return !!res?.ok;
}
