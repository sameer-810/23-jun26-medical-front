import * as Print from "expo-print";
import { Platform } from "react-native";

/**
 * Printing, cross-platform, at an exact page size.
 *
 * A label is the one thing this app prints where SIZE IS CORRECTNESS. A 38x15mm
 * sticker scaled to 80% is not a slightly smaller sticker — the barcode's
 * X-dimension falls under what a thermal head can resolve and the label stops
 * scanning, which is how a shop ends up unable to sell the stock it just
 * received. So every platform gets told the page size explicitly rather than
 * being left to a print dialog's "fit to page", which is what silently halved
 * the first batch the client printed.
 *
 * Three paths, in order of how much control we actually have:
 *
 *   DESKTOP (Electron) — total control. The shell prints straight to the label
 *     printer at an exact page size with no margins and no scaling, no dialog
 *     involved. This is the path the shop counter actually uses, because the
 *     label printer is plugged into that PC.
 *   NATIVE (Android/iOS) — expo-print takes an explicit page width/height in
 *     points, so the PDF it hands the OS is already the right size.
 *   BROWSER — no API can override the print dialog's scale setting. We emit the
 *     correct @page size and the operator must leave Scale at 100% / Margins at
 *     None. Use the desktop app for labels where you can.
 */

/** A page size in millimetres — the units label stock is actually sold in. */
export interface PageSizeMm {
  widthMm: number;
  heightMm: number;
}

/** The desktop shell's bridge, present only inside the Electron app. */
interface DesktopBridge {
  platform?: string;
  printExact?: (req: {
    html: string;
    widthMm: number;
    heightMm: number;
    deviceName?: string;
  }) => Promise<{ ok: boolean; reason?: string; deviceName?: string }>;
  listPrinters?: () => Promise<
    { name: string; displayName?: string; isDefault?: boolean }[]
  >;
}

function desktop(): DesktopBridge | null {
  if (typeof window === "undefined") return null;
  const bridge = (window as unknown as { medstock?: DesktopBridge }).medstock;
  return bridge?.printExact ? bridge : null;
}

/** Is an exact-size, no-dialog print available right now? */
export function canPrintExact(): boolean {
  return Platform.OS === "web" ? !!desktop() : true;
}

/**
 * Is this a plain browser, with no desktop shell behind it?
 *
 * The one case where an HTML print is the WRONG tool: the browser will wrap the
 * document in a header and footer that no page can suppress. Callers with a
 * PDF to offer should offer it here.
 */
export function isPlainBrowser(): boolean {
  return Platform.OS === "web" && typeof document !== "undefined" && !desktop();
}

/**
 * Hand a finished PDF to the user for printing.
 *
 * Opened in a tab rather than downloaded, because that lands the operator on
 * the viewer's own print button with the document already open — and a PDF
 * print carries no browser header, footer or URL, which is the entire reason
 * this path exists. Falls back to a download when a popup blocker gets in the
 * way, since a blocked tab would otherwise look like nothing happened.
 */
export function openPdfForPrint(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const tab = window.open(url, "_blank");
  if (!tab) {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  // Revoking immediately would pull the document out from under the viewer;
  // the delay is long enough for the tab to have taken its own reference.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Which printer the desktop shell should send labels to.
 *
 * Remembered per machine because the counter PC usually has two printers — an
 * A4 one for invoices and the thermal one for labels — and the label printer is
 * rarely the Windows default. Unset means "use the system default", which is
 * the right behaviour on a machine that only has the one printer.
 */
const LABEL_PRINTER_KEY = "plusveda.labelPrinter";

export function getLabelPrinter(): string | undefined {
  try {
    return localStorage.getItem(LABEL_PRINTER_KEY) || undefined;
  } catch {
    return undefined;
  }
}

export function setLabelPrinter(name: string | null): void {
  try {
    if (name) localStorage.setItem(LABEL_PRINTER_KEY, name);
    else localStorage.removeItem(LABEL_PRINTER_KEY);
  } catch {
    // Private-mode browsers throw on localStorage; falling back to the system
    // default printer is a perfectly good answer.
  }
}

/**
 * Print-size calibration, for the paths where we don't control the print job.
 *
 * A browser gives no API to override its print dialog's scale, and the dialog's
 * default is "fit to printable area" — so a driver that declares a generous
 * unprintable margin silently shrinks the page. That is not cosmetic on a
 * barcode: the client's first run came out at roughly half size, which puts the
 * bars under the resolution of a 203dpi head and the sticker will not scan.
 *
 * Rather than argue with the dialog, we measure it. The shop prints a test
 * label carrying a bar of known length, measures what actually came out with a
 * ruler, and this factor pre-compensates every later label by exactly the
 * amount that pipeline shrinks it. Whatever the cause — margins, paper
 * mismatch, a driver's own fit-to-media — the correction is the same, because
 * it is derived from the finished sticker rather than from a theory about why.
 *
 * 1 means "print as designed" and is right wherever the size is already exact.
 */
const LABEL_SCALE_KEY = "plusveda.labelScale";
/** Beyond this the input was a typo or the wrong bar was measured. */
const SCALE_MIN = 0.5;
const SCALE_MAX = 3;

export function getLabelScale(): number {
  try {
    const raw = Number(localStorage.getItem(LABEL_SCALE_KEY));
    if (!Number.isFinite(raw) || raw <= 0) return 1;
    return Math.min(SCALE_MAX, Math.max(SCALE_MIN, raw));
  } catch {
    return 1;
  }
}

export function setLabelScale(scale: number | null): void {
  try {
    if (scale && Number.isFinite(scale) && scale > 0) {
      localStorage.setItem(
        LABEL_SCALE_KEY,
        String(Math.min(SCALE_MAX, Math.max(SCALE_MIN, scale))),
      );
    } else {
      localStorage.removeItem(LABEL_SCALE_KEY);
    }
  } catch {
    // Private-mode browsers throw; printing uncalibrated is still printing.
  }
}

/** Printers the desktop shell can see. Empty everywhere else. */
export async function listPrinters(): Promise<
  { name: string; displayName?: string; isDefault?: boolean }[]
> {
  const bridge = desktop();
  if (!bridge?.listPrinters) return [];
  try {
    return await bridge.listPrinters();
  } catch {
    return [];
  }
}

/** Millimetres to PostScript points, the unit expo-print counts pages in. */
const mmToPt = (mm: number) => (mm / 25.4) * 72;

/**
 * Print an HTML document.
 *
 * Pass `page` whenever the output has a physical size that must be honoured —
 * labels always, invoices never (those are happy on whatever paper is loaded).
 */
export async function printHtml(
  html: string,
  page?: PageSizeMm,
): Promise<void> {
  if (Platform.OS === "web" && typeof document !== "undefined") {
    const bridge = desktop();
    if (bridge?.printExact && page) {
      const res = await bridge.printExact({
        html,
        widthMm: page.widthMm,
        heightMm: page.heightMm,
        deviceName: getLabelPrinter(),
      });
      // The shell falls back to a system dialog by itself when a silent print
      // can't go through (no printer, printer offline). A false here means even
      // that failed, so the browser path is the last thing left to try.
      if (res?.ok) return;
    }
    printHtmlWeb(html);
    return;
  }

  // Native. Width/height are per-page and in points; without them expo-print
  // defaults to US Letter and the label comes out as a stamp in the corner of a
  // sheet, or scaled to fit by the OS print service.
  await Print.printAsync(
    page
      ? {
          html,
          width: mmToPt(page.widthMm),
          height: mmToPt(page.heightMm),
        }
      : { html },
  );
}

/**
 * Browser fallback.
 *
 * On WEB, `Print.printAsync({ html })` ends up printing the host page (the whole
 * app) rather than the HTML you hand it. So we render the HTML into an isolated,
 * off-screen iframe and print THAT — only the intended document reaches the
 * printer. The document's own @page rule carries the size; the dialog's scale
 * setting is the operator's to get right.
 */
function printHtmlWeb(html: string): void {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  Object.assign(iframe.style, {
    position: "fixed",
    right: "0",
    bottom: "0",
    width: "0",
    height: "0",
    border: "0",
  });
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  if (!win) {
    iframe.remove();
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();

  let removed = false;
  const cleanup = () => {
    if (removed) return;
    removed = true;
    iframe.remove();
  };
  // Printing the iframe's own document blocks until the dialog closes on real
  // browsers, so afterprint is the prompt, correct moment to tidy up.
  win.onafterprint = cleanup;

  // Inline SVG lays out synchronously, but give the render a beat before we
  // freeze the page for printing. The timeout is the safety net for browsers
  // (and headless) that never fire afterprint.
  window.setTimeout(() => {
    win.focus();
    win.print();
    window.setTimeout(cleanup, 3000);
  }, 200);
}
