// The plain "bwip-js" entry resolves to its React Native build, which imports
// `react-zlib-js` — a peer dependency it doesn't ship. That breaks the Android
// bundle outright. The /browser entry is the same library minus the PNG/zlib
// path we never use (we only ever call toSVG), and touches no DOM at import
// time, so it is safe on native, web and node alike.
import bwipjs from "bwip-js/browser";
import { printHtml } from "@shared/print";

/**
 * Shelf-label printing.
 *
 * A pharmacy prints its own label at receive time and sticks it on the medicine,
 * because Indian strips carry no reliable scannable code of their own. The label
 * holds the shop name, product, batch, expiry and MRP, plus the opaque label
 * code as a Code128 barcode — the symbology the cheap ₹1200 laser scanner every
 * shop owns reads, and which the in-app camera scanner also accepts. Scanning it
 * resolves the exact lot at the till; see `resolveScan` on the backend.
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
//
// Change these if the shop's roll differs. Above ~20mm of height there is room
// to add a QR beside the text again; at 15mm there is not (see .barcode below).
const LABEL_W_MM = 38;
const LABEL_H_MM = 15;
// Hard cap so a fat-fingered quantity can't spool a thousand labels.
const MAX_LABELS = 300;

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

/**
 * The Code128 symbol for one code, as an inline-able SVG string.
 *
 * There is no QR: at 15mm tall, after the shop name, product, batch/expiry, MRP
 * and the barcode itself, the largest square that fits is about 4.5mm. A 21x21
 * module QR at 4.5mm on a 203dpi head gives under two dots per module, and a
 * symbol that coarse does not decode — it would print a black smudge that looks
 * scannable and isn't. The Code128 carries the same code, and every scanner in
 * play (laser guns, 2D imagers, the in-app camera) reads it.
 */
async function barcodeSvg(code: string): Promise<string> {
  const svg = await bwipjs.toSVG({
    bcid: "code128",
    text: code,
    height: 7,
    includetext: false,
    paddingwidth: 0,
    paddingheight: 0,
  });
  // preserveAspectRatio="none" lets the barcode fill the label's full width.
  // Left at the default it is letterboxed to fit the ~5mm height, which shrinks
  // the bars to roughly half the width they should be — and a laser scanner
  // simply won't read bars that narrow. Stretching only the HEIGHT is safe:
  // every bar scales by the same horizontal factor, so their ratios (the thing
  // the scanner actually decodes) are untouched.
  return svg.replace("<svg ", '<svg preserveAspectRatio="none" ');
}

function labelHtml(spec: LabelSpec, shopName: string, barcode: string): string {
  const exp = expMonthYear(spec.expiry);
  // "BATCH", not "B:" — a "B:" prefix reads like the B00000000 scan code under
  // the barcode, and people typed the wrong one.
  const batch = spec.batchNumber
    ? `<span class="batch">BATCH ${esc(spec.batchNumber)}</span>`
    : "";
  return `
    <div class="label">
      <div class="shop">${esc(shopName)}</div>
      <div class="name">${esc(spec.productName)}</div>
      <div class="meta">
        ${batch}${exp ? `<span class="exp">EXP ${exp}</span>` : ""}
        <span class="mrp">MRP ${money(spec.mrp)}</span>
      </div>
      <div class="barcode">${barcode}</div>
      <div class="code">${esc(spec.labelCode)}</div>
    </div>`;
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
): Promise<string> {
  // One barcode render per DISTINCT code, then repeated — a 100-unit lot
  // shouldn't pay for 100 identical renders.
  const svgByCode = new Map<string, string>();
  for (const s of specs) {
    if (!svgByCode.has(s.labelCode)) {
      svgByCode.set(s.labelCode, await barcodeSvg(s.labelCode));
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

  return `<!doctype html><html><head><meta charset="utf-8"/>
  <style>
    @page { size: ${LABEL_W_MM}mm ${LABEL_H_MM}mm; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, sans-serif; -webkit-print-color-adjust: exact; color: #000; }
    /* One sticker per page. The explicit break keeps a label from being split
       across two stickers when a browser rounds 15mm to a fractionally taller
       box; the :last-child reset stops the roll advancing one blank label at
       the end of every run. */
    .label {
      width: ${LABEL_W_MM}mm; height: ${LABEL_H_MM}mm;
      padding: .6mm 1.4mm .5mm; overflow: hidden;
      display: flex; flex-direction: column;
      page-break-inside: avoid; page-break-after: always;
    }
    .label:last-child { page-break-after: auto; }
    /* Every line below is sized so the fixed rows total ~9mm, leaving the
       barcode (flex: 1) the remaining ~5mm. Growing any font here shrinks the
       barcode, so check a live scan before you do. */
    .shop { font-size: 5pt; font-weight: 700; letter-spacing: .1px; text-align: center;
            line-height: 1; border-bottom: .25mm solid #000; padding-bottom: .25mm; }
    .name { font-size: 5.5pt; font-weight: 700; line-height: 1.1; margin-top: .4mm;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    /* Batch, expiry and MRP share one line, and 38mm will not always hold all
       three. The shrink order encodes what a pharmacy may lose: the BATCH is
       the only truncatable field (it is recoverable by scanning), so it alone
       gets flex-shrink and an ellipsis. EXPIRY and MRP never shrink and never
       clip — an expiry silently cut off a medicine sticker is a safety problem,
       and a half-printed price is a billing dispute. */
    .meta { display: flex; align-items: baseline; gap: 1.2mm;
            margin-top: .3mm; line-height: 1.1; }
    .batch { font-size: 4.5pt; min-width: 0; white-space: nowrap;
             overflow: hidden; text-overflow: ellipsis; }
    .exp { font-size: 4.5pt; flex: none; white-space: nowrap; }
    .mrp { font-size: 7pt; font-weight: 700; flex: none; margin-left: auto; white-space: nowrap; }
    /* 2mm of white each side is the QUIET ZONE. Code128 is unreadable without
       one — the scanner needs blank space to find where the symbol starts and
       ends. This was missing, and is a classic cause of "the scanner won't
       read it". flex: 1 hands the barcode whatever height the text rows didn't
       use, so the label absorbs a long product name by losing bar height
       instead of overflowing onto the next sticker. */
    .barcode { flex: 1; min-height: 3.5mm; padding: .4mm 2mm 0; }
    .barcode svg { width: 100%; height: 100%; display: block; }
    .code { font-size: 4.5pt; text-align: center; letter-spacing: .3mm; line-height: 1; }
  </style></head>
  <body>${cells.join("")}</body></html>`;
}

/** Renders and hands the label sheet to the OS print dialog / label printer. */
export async function printLabels(
  specs: LabelSpec[],
  shopName: string,
): Promise<void> {
  const html = await buildLabelSheetHtml(specs, shopName);
  await printHtml(html);
}
