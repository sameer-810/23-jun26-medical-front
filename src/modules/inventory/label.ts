// The plain "bwip-js" entry resolves to its React Native build, which imports
// `react-zlib-js` — a peer dependency it doesn't ship. That breaks the Android
// bundle outright. The /browser entry is the same library minus the PNG/zlib
// path we never use (we only ever call toSVG), and touches no DOM at import
// time, so it is safe on native, web and node alike.
import bwipjs from "bwip-js/browser";
import {
  printHtml,
  getLabelScale,
  isPlainBrowser,
  openPdfForPrint,
} from "@shared/print";

/**
 * Shelf-label printing.
 *
 * A pharmacy prints its own label at receive time and sticks it on the medicine,
 * because Indian strips carry no reliable scannable code of their own. The label
 * holds the shop name, product, batch, expiry and MRP, plus the SAME opaque
 * label code as both a Code128 barcode (for the cheap ₹1200 laser scanner every
 * shop owns) and a QR (for 2D scanners and phone cameras). Either scan resolves
 * the exact lot at the till — see `resolveScan` on the backend.
 */

export interface LabelSpec {
  labelCode: string;
  productName: string;
  batchNumber: string;
  /** ISO date or YYYY-MM-DD; shown as MM/YY, the Indian convention. */
  expiry: string | null;
  mrp: number;
  /** How many identical stickers to print — usually one per received unit. */
  copies?: number;
}

// The shop's actual roll: 38mm x 15mm die-cut thermal, 1-across, 1" core.
// These two drive @page AND the sticker box, so the requested page always
// matches the media. When they DON'T match, the print system rotates the label
// and scales it to fit the roll — which is how a 25mm design ended up printing
// sideways across two-and-a-half 15mm stickers.
const LABEL_W_MM = 38;
const LABEL_H_MM = 15;
/**
 * The same size, handed to the printer itself rather than only to the CSS.
 *
 * @page alone is a REQUEST: the browser honours it if the driver offers a
 * matching paper, and quietly scales to fit if it doesn't. That scaling is not
 * cosmetic — at 80% the barcode drops under the resolution of a 203dpi head and
 * the label stops scanning. The desktop and native print paths take this and set
 * the page size on the print job, where it is not negotiable.
 */
export const LABEL_PAGE_MM = { widthMm: LABEL_W_MM, heightMm: LABEL_H_MM };
// Hard cap so a fat-fingered quantity can't spool a thousand labels.
const MAX_LABELS = 300;

/*
 * WHY THE LAYOUT IS SHAPED THE WAY IT IS
 *
 * 38x15mm has to carry two symbols, and on a 203dpi head (8 dots/mm, the
 * resolution of nearly every Indian pharmacy label printer) both are close to
 * their floor. Denso Wave — who invented QR — recommend 4+ printer dots per
 * module for stable printing, i.e. a 0.5mm module, i.e. a 10.5mm symbol for the
 * 21x21 version-1 QR our 9-character code needs. That does not fit UNDER the
 * text. It does fit BESIDE it:
 *
 *   +--------------------------------------+
 *   | [QR]  MedStock Demo Pharmacy         |   QR beside a 4-row text column
 *   | [QR]  HUMAN ACTRAPID 40IU VIAL...    |
 *   | [QR]  BATCH B-70955  EXP 03/28       |
 *   | [QR]  MRP Rs 18.13                   |
 *   | |||| ||| |||| || ||| |||| || ||||||  |   Code128 across the FULL width
 *   |             B00000112                |
 *   +--------------------------------------+
 *
 * Stacking them would have starved both. Side-by-side, the QR gets the whole
 * height of the upper band and the Code128 keeps the whole width of the label —
 * which matters more for a 1D symbol, because its width IS its data. The cost
 * is the product-name column, now ~25mm instead of 35mm; a long name truncates
 * sooner. That is the trade the geometry forces, and the name is the one field
 * on here that a human can recover by looking at the box.
 *
 * Measured on the rendered output at 203dpi: QR module ~2.5 dots, Code128
 * X-dimension ~0.30mm (~2.4 dots). Both decode (there is a decode test in the
 * scratchpad rig), but neither has margin to spare — so if you grow a font or
 * add a row here, re-run a real scan before shipping it. On a 300dpi printer
 * the same artwork lands near 4 dots per module and is comfortable.
 */

const esc = (s: string) =>
  String(s ?? "").replace(
    /[&<>]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!,
  );

// Always two decimals: a printed price tag reading "₹31.5" looks like a
// mis-print of ₹31.50 to a customer, and that argument happens at the counter.
const money = (n: number) =>
  `₹${Number(n).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/** ISO / YYYY-MM-DD -> "MM/YY". Blank stays blank. */
function expMonthYear(expiry: string | null): string {
  if (!expiry) return "";
  const [y, m] = String(expiry).slice(0, 10).split("-");
  if (!y || !m) return "";
  return `${m}/${y.slice(2)}`;
}

/** Both symbologies of one code, as inline-able SVG strings. */
async function codeSvgs(
  code: string,
): Promise<{ barcode: string; qr: string }> {
  const [barcode, qr] = await Promise.all([
    bwipjs.toSVG({
      bcid: "code128",
      text: code,
      height: 7,
      includetext: false,
      paddingwidth: 0,
      paddingheight: 0,
    }),
    // No eclevel here on purpose. BWIPP picks the SMALLEST version that holds
    // the data and then spends whatever room is left over on error correction,
    // so a "B" + 8-digit code comes out as a 21x21 version 1 at level H — the
    // smallest symbol AND the toughest, which is exactly what a 7.2mm square on
    // thermal paper needs. Asking for a specific eclevel cannot improve on that
    // and a lower one would only throw away redundancy at the same size.
    // The constraint that DOES matter is code LENGTH: version 1 carries this
    // format with room to spare, but a materially longer labelCode would push
    // the symbol to 25x25 and shrink every module by a fifth, below the print
    // floor. If the code format ever changes, re-run the decode test.
    bwipjs.toSVG({ bcid: "qrcode", text: code }),
  ]);
  // preserveAspectRatio="none" lets the barcode fill the label's full width.
  // Left at the default it is letterboxed to fit the ~4mm height, which shrinks
  // the bars to roughly half the width they should be — and a laser scanner
  // simply won't read bars that narrow. Stretching only the HEIGHT is safe:
  // every bar scales by the same horizontal factor, so their ratios (the thing
  // the scanner actually decodes) are untouched.
  //
  // The QR gets NO such treatment: it is data in two dimensions, so a
  // non-uniform stretch corrupts it outright. It stays square (see .qr svg).
  return {
    barcode: barcode.replace("<svg ", '<svg preserveAspectRatio="none" '),
    qr,
  };
}

function labelHtml(
  spec: LabelSpec,
  shopName: string,
  svgs: { barcode: string; qr: string },
): string {
  const exp = expMonthYear(spec.expiry);
  // "BATCH", not "B:" — a "B:" prefix reads like the B00000000 scan code under
  // the barcode, and people typed the wrong one.
  const batch = spec.batchNumber
    ? `<span class="batch">BATCH ${esc(spec.batchNumber)}</span>`
    : "";
  // .page is the sheet the printer advances; .label is the artwork on it. They
  // are separate because calibration scales the artwork inside a page that
  // grows with it — see labelDocument().
  return `
    <div class="page"><div class="label">
      <div class="top">
        <div class="qr">${svgs.qr}</div>
        <div class="info">
          <div class="shop">${esc(shopName)}</div>
          <div class="name">${esc(spec.productName)}</div>
          <div class="meta">${batch}${exp ? `<span class="exp">EXP ${exp}</span>` : ""}</div>
          <div class="mrp">MRP ${money(spec.mrp)}</div>
        </div>
      </div>
      <div class="barcode">${svgs.barcode}</div>
    </div></div>`;
}

/**
 * Full print document: every label repeated `copies` times, one sticker per
 * page, so the roll advances exactly one label per label. On an A4 or PDF
 * fallback the same document prints one small label per sheet — correct, if
 * wasteful, which is the right trade when the alternative is misaligned stock.
 * Async because the barcodes are generated per distinct code.
 */
export async function buildLabelSheetHtml(
  specs: LabelSpec[],
  shopName: string,
  scale = 1,
): Promise<string> {
  // One barcode render per DISTINCT code, then repeated — a 100-unit lot
  // shouldn't pay for 100 identical renders.
  const svgByCode = new Map<string, { barcode: string; qr: string }>();
  for (const s of specs) {
    if (!svgByCode.has(s.labelCode)) {
      svgByCode.set(s.labelCode, await codeSvgs(s.labelCode));
    }
  }

  let count = 0;
  const cells: string[] = [];
  for (const s of specs) {
    const copies = Math.max(1, Math.floor(s.copies || 1));
    for (let i = 0; i < copies && count < MAX_LABELS; i++, count++) {
      cells.push(labelHtml(s, shopName, svgByCode.get(s.labelCode)!));
    }
  }

  return labelDocument(cells.join(""), scale);
}

/**
 * Wrap finished labels in the print document.
 *
 * `scale` is the calibration factor from `getLabelScale()`, and it pre-enlarges
 * BOTH the page and the artwork so that a pipeline which shrinks by 1/scale
 * lands on a physically correct 38x15mm sticker. The page has to grow with the
 * artwork — scaling the content alone inside a fixed page would just push it
 * over the edge and get it clipped, since a browser scales the whole page box,
 * not the content within it. At the default scale of 1 both multiplications are
 * no-ops and this is the plain, uncalibrated document.
 *
 * The artwork itself is never re-laid-out: it stays authored at exactly 38x15mm
 * and gets a transform. That keeps every millimetre in the stylesheet below
 * meaning a real millimetre on the sticker, which is the only way the barcode
 * geometry stays reviewable.
 */
function labelDocument(cells: string, scale: number): string {
  const s = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const pageW = +(LABEL_W_MM * s).toFixed(3);
  const pageH = +(LABEL_H_MM * s).toFixed(3);

  return `<!doctype html><html><head><meta charset="utf-8"/>
  <style>
    @page { size: ${pageW}mm ${pageH}mm; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, sans-serif; -webkit-print-color-adjust: exact; color: #000; }
    /* One sticker per page. The explicit break keeps a label from being split
       across two stickers when a browser rounds 15mm to a fractionally taller
       box; the :last-child reset stops the roll advancing one blank label at
       the end of every run. */
    .page {
      width: ${pageW}mm; height: ${pageH}mm; overflow: hidden;
      page-break-inside: avoid; page-break-after: always;
    }
    .page:last-child { page-break-after: auto; }
    .label {
      width: ${LABEL_W_MM}mm; height: ${LABEL_H_MM}mm;
      padding: .8mm 1.4mm .5mm 1.5mm; overflow: hidden;
      display: flex; flex-direction: column;
      transform: scale(${s}); transform-origin: top left;
    }

    /* Upper band: QR on the left, the four text rows on the right. It takes
       whatever the barcode band below does not, which is ~9.1mm.
       EVERY line-height here is 1.2, not 1.1. Arial's glyphs need ~1.15em of
       line box; at 1.1 the ascenders and descenders were being sliced off by
       the overflow:hidden that keeps long names in bounds — the label looked
       like a printer fault when it was pure CSS. */
    .top { flex: 1; display: flex; gap: 1.5mm; min-height: 0; }

    /* 7.2mm across 21 modules is a 0.34mm module — about 2.8 dots on a 203dpi
       head. Below this it stops decoding; above it, the text column gets too
       narrow to name the medicine. The box is wider than the symbol on purpose:
       the QUIET ZONE. A QR needs 4 clear modules (~1.4mm) on every side, and
       without it a scanner cannot find the symbol's edges at all. Here that
       white comes from the box being 8.6mm around a 7.2mm symbol, plus the
       label's own padding — so never set a background or border on .qr. */
    .qr { flex: none; width: 8.6mm; display: flex; align-items: center; justify-content: center; }
    /* Square, always. A QR carries data in both axes, so a non-uniform stretch
       corrupts it — height and width must scale together. */
    .qr svg { width: 7.2mm; height: 7.2mm; display: block; }

    .info { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; }
    .shop { font-size: 4pt; font-weight: 700; letter-spacing: .1px; line-height: 1.2;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            border-bottom: .25mm solid #000; padding-bottom: .15mm; }
    .name { font-size: 5pt; font-weight: 700; line-height: 1.2; margin-top: .2mm;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    /* Batch and expiry share a line; 25mm will not always hold both. The shrink
       order encodes what a pharmacy may lose: the BATCH is the only truncatable
       field (it is recoverable by scanning), so it alone gets an ellipsis. The
       EXPIRY never shrinks and never clips — an expiry silently cut off a
       medicine sticker is a safety problem, not a cosmetic one. */
    .meta { display: flex; align-items: baseline; gap: 1.2mm; margin-top: .15mm; line-height: 1.2; }
    .batch { font-size: 4pt; min-width: 0; white-space: nowrap;
             overflow: hidden; text-overflow: ellipsis; }
    .exp { font-size: 4pt; flex: none; white-space: nowrap; }
    /* MRP gets its own row rather than sharing with batch/expiry: in a 25mm
       column the two together overflow, and the price is what the counter reads
       off the sticker, so it keeps the larger type. */
    .mrp { font-size: 6pt; font-weight: 700; line-height: 1.2; margin-top: .1mm; white-space: nowrap; }

    /* The Code128 keeps the FULL width of the label, because for a 1D symbol
       width IS data — the same code squeezed into a column beside the QR would
       drop the X-dimension to ~1.3 dots and stop scanning. At full width it
       lands near 0.30mm (~2.4 dots), which decodes.
       2mm of white each side is its QUIET ZONE. Code128 is unreadable without
       one — the scanner needs blank space to find where the symbol starts and
       ends. This was missing, and is a classic cause of "the scanner won't
       read it".
       There is no human-readable code line under the bars any more: adding the
       QR cost ~1.5mm of height, and of everything on here the printed
       "B00000112" was the only field already carried by BOTH symbols. It was
       the right thing to spend. */
    .barcode { flex: none; height: 4.6mm; padding: .45mm 2mm 0; }
    .barcode svg { width: 100%; height: 100%; display: block; }
  </style></head>
  <body>${cells}</body></html>`;
}

/** The nominal length of the measuring bar on the calibration label. */
export const CALIBRATION_BAR_MM = 30;

/**
 * A single test sticker whose only job is to be measured with a ruler.
 *
 * The bar is exactly 30mm as designed, with end ticks so there is no doubt
 * where it starts and stops. Whatever the shop measures off the printed sticker
 * tells us precisely what the print path did to the artwork — no guessing about
 * margins, paper sizes or driver settings, which is what made the original
 * fault so hard to pin down from a photo.
 */
export function buildCalibrationLabelHtml(scale = 1): string {
  const cell = `
    <div class="page"><div class="label cal">
      <div class="cal-title">LABEL SIZE TEST</div>
      <div class="cal-bar"><span class="tick"></span><span class="tick"></span></div>
      <div class="cal-note">Measure the bar above. It should be exactly ${CALIBRATION_BAR_MM} mm.</div>
    </div></div>`;

  return labelDocument(cell, scale).replace(
    "</style>",
    `
    .cal { justify-content: space-between; }
    .cal-title { font-size: 4.5pt; font-weight: 700; letter-spacing: .2mm; line-height: 1.2; }
    /* Exactly ${CALIBRATION_BAR_MM}mm wide as authored. The ticks drop below the
       bar so a ruler can be lined up against its true ends. */
    .cal-bar {
      width: ${CALIBRATION_BAR_MM}mm; height: 1.6mm; background: #000;
      position: relative; margin: .4mm 0;
    }
    .cal-bar .tick { position: absolute; top: 100%; width: .3mm; height: 1.2mm; background: #000; }
    .cal-bar .tick:first-child { left: 0; }
    .cal-bar .tick:last-child { right: 0; }
    .cal-note { font-size: 4pt; line-height: 1.2; }
    </style>`,
  );
}

/**
 * Print the labels, by whichever route this device can do exactly.
 *
 * In a plain browser that means a PDF, not an HTML print: a browser adds a
 * header and footer — date, title, full URL — that no page can suppress, and on
 * a 15mm sticker those spill onto the labels above and below, wasting three
 * stickers to print one. A PDF has no such furniture. Everywhere else (the
 * desktop shell, the native apps) the print job takes an exact page size
 * directly, so the HTML path is already exact and keeps working.
 */
export async function printLabels(
  specs: LabelSpec[],
  shopName: string,
): Promise<void> {
  const scale = getLabelScale();

  if (isPlainBrowser()) {
    // A Zebra reachable through Browser Print beats every other route: the
    // bytes go to the printer, so no dialog, driver, paper size or scale
    // setting gets a say. Falls through to the PDF when it isn't installed.
    if (await printLabelsViaZebra(specs, shopName)) return;

    // Imported lazily: jsPDF and the canvas renderer are a few hundred KB that
    // a phone opening the sales screen has no reason to download.
    const { buildLabelPdf } = await import("@modules/inventory/labelPdf");
    const pdf = await buildLabelPdf(specs, shopName, scale, MAX_LABELS);
    openPdfForPrint(pdf, "labels.pdf");
    return;
  }

  const html = await buildLabelSheetHtml(specs, shopName, scale);
  await printHtml(html, scaledPage(scale));
}

/**
 * Try the direct route to a Zebra. True if the labels are on their way.
 *
 * Everything is loaded lazily and every failure returns false rather than
 * throwing: a shop without Browser Print installed must land on the PDF path
 * without ever seeing an error about a service it has never heard of.
 */
async function printLabelsViaZebra(
  specs: LabelSpec[],
  shopName: string,
): Promise<boolean> {
  try {
    const { findZebraPrinter, sendZpl } =
      await import("@shared/zebraBrowserPrint");
    const link = await findZebraPrinter();
    if (!link) return false;
    const { buildLabelZpl } = await import("@modules/inventory/labelZpl");
    return await sendZpl(
      link,
      await buildLabelZpl(specs, shopName, MAX_LABELS),
    );
  } catch {
    return false;
  }
}

/** Prints the one test sticker the calibration flow asks the shop to measure. */
export async function printCalibrationLabel(): Promise<void> {
  const scale = getLabelScale();

  if (isPlainBrowser()) {
    // Same route as a real label, or the shop would be measuring one pipeline
    // and printing through another.
    try {
      const { findZebraPrinter, sendZpl } =
        await import("@shared/zebraBrowserPrint");
      const link = await findZebraPrinter();
      if (link) {
        const { buildCalibrationZpl } =
          await import("@modules/inventory/labelZpl");
        if (await sendZpl(link, buildCalibrationZpl(CALIBRATION_BAR_MM)))
          return;
      }
    } catch {
      // Fall through to the PDF.
    }
    const { buildCalibrationPdf } = await import("@modules/inventory/labelPdf");
    const pdf = await buildCalibrationPdf(CALIBRATION_BAR_MM, scale);
    openPdfForPrint(pdf, "label-size-test.pdf");
    return;
  }

  await printHtml(buildCalibrationLabelHtml(scale), scaledPage(scale));
}

/**
 * The page size to put on the print job.
 *
 * On the paths that accept an exact page size (desktop, native) the artwork is
 * already correct and `scale` should be 1 — but if a shop has calibrated anyway,
 * the job's page must grow with it or the enlarged artwork gets cropped.
 */
function scaledPage(scale: number) {
  return {
    widthMm: LABEL_W_MM * scale,
    heightMm: LABEL_H_MM * scale,
  };
}
