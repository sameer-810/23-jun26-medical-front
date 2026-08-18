import bwipjs from "bwip-js/browser";
import { jsPDF } from "jspdf";
import type { LabelSpec } from "@modules/inventory/label";
import {
  LABEL,
  PT_MM,
  PRINT_DPI,
  infoWidthMm,
  barcodeWidthMm,
  topBandMm,
} from "@modules/inventory/labelSpec";

/**
 * Labels as a PDF, for browsers.
 *
 * A browser will not let a page suppress the header and footer it prints around
 * an HTML document — the date, the title and the full URL, injected below the
 * DOM where no CSS reaches. On a 15mm sticker those land on the labels above
 * and below and ruin three stickers to print one. It is a deliberate browser
 * rule (a site should not be able to hide where a printout came from), so there
 * is nothing to fix in the markup.
 *
 * Printing a PDF has no such furniture: the page is the page. So on the web the
 * label becomes a real PDF, one 38x15mm page per sticker, each holding a single
 * bitmap rendered at the printer's own 203dpi. That also removes the last bit of
 * interpretation between us and the paper — no font substitution, no reflow, one
 * image pixel per printer dot.
 */

const dots = (mm: number) => Math.round((mm / 25.4) * PRINT_DPI);

/** Millimetre helpers for laying out on the dot grid. */
function ctxFor(widthMm: number, heightMm: number) {
  const canvas = document.createElement("canvas");
  canvas.width = dots(widthMm);
  canvas.height = dots(heightMm);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context unavailable");
  // Work in millimetres from here on, so the code below reads like the CSS it
  // mirrors instead of like pixel arithmetic.
  const perMm = PRINT_DPI / 25.4;
  ctx.scale(perMm, perMm);
  // Thermal paper is white and the head burns black. No greys: anti-aliased
  // edges on a 1-bit device just become ragged, and on a barcode that costs
  // scans.
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, widthMm, heightMm);
  ctx.fillStyle = "#000";
  ctx.textBaseline = "alphabetic";
  return { canvas, ctx };
}

/**
 * Font size, in the millimetre user-space this context works in.
 *
 * Deliberately "px", not "mm", even though the number IS a millimetre count.
 * Canvas resolves a CSS length in the font shorthand against CSS pixels
 * (1mm = 96/25.4px) and only THEN applies the current transform — so asking for
 * "1.41mm" here gets multiplied by 3.78 and again by the mm scale, and the text
 * comes out roughly eight times too big, overlapping everything. A "px" length
 * is one user unit, which under this transform is exactly one millimetre.
 */
const font = (pt: number, bold: boolean) =>
  `${bold ? "700 " : ""}${pt * PT_MM}px Arial, Helvetica, sans-serif`;

/** Draw text clipped to a width, with an ellipsis if it doesn't fit. */
function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxMm: number,
): void {
  if (ctx.measureText(text).width <= maxMm) {
    ctx.fillText(text, x, y);
    return;
  }
  let cut = text;
  while (cut.length > 1 && ctx.measureText(cut + "…").width > maxMm) {
    cut = cut.slice(0, -1);
  }
  ctx.fillText(cut + "…", x, y);
}

/** ISO / YYYY-MM-DD -> "MM/YY", same convention as the HTML label. */
function expMonthYear(expiry: string | null): string {
  if (!expiry) return "";
  const [y, m] = String(expiry).slice(0, 10).split("-");
  if (!y || !m) return "";
  return `${m}/${y.slice(2)}`;
}

const money = (n: number) =>
  `₹${Number(n).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/**
 * One sticker, rendered to a canvas at 203dpi.
 *
 * The layout deliberately walks the same path as the stylesheet in `label.ts`:
 * QR on the left with the text column beside it, Code128 across the full width
 * underneath. Both read their numbers from `labelSpec.ts` so they cannot drift
 * apart silently.
 */
async function drawLabel(
  spec: LabelSpec,
  shopName: string,
): Promise<HTMLCanvasElement> {
  const { canvas, ctx } = ctxFor(LABEL.wMm, LABEL.hMm);
  const t = LABEL.text;
  const band = topBandMm();
  const infoW = infoWidthMm();
  const infoX = LABEL.pad.left + LABEL.qr.colMm + LABEL.qr.gapMm;

  // --- QR, vertically centred in the band, square always ------------------
  const qrCanvas = document.createElement("canvas");
  bwipjs.toCanvas(qrCanvas, { bcid: "qrcode", text: spec.labelCode });
  const qrX = LABEL.pad.left + (LABEL.qr.colMm - LABEL.qr.symbolMm) / 2;
  const qrY = LABEL.pad.top + (band - LABEL.qr.symbolMm) / 2;
  ctx.drawImage(qrCanvas, qrX, qrY, LABEL.qr.symbolMm, LABEL.qr.symbolMm);

  // --- text column, the four rows, vertically centred ----------------------
  const rowH = (pt: number) => pt * PT_MM * t.lineHeight;
  const stack =
    rowH(t.shopPt) +
    LABEL.text.shopRuleMm +
    t.shopRulePadMm +
    t.nameTopMm +
    rowH(t.namePt) +
    t.metaTopMm +
    rowH(t.metaPt) +
    t.mrpTopMm +
    rowH(t.mrpPt);
  let y = LABEL.pad.top + (band - stack) / 2;

  // Baselines sit at ~80% of the line box, which is where a browser puts them
  // for Arial and keeps the two renderers visually identical.
  const baseline = (pt: number) => rowH(pt) * 0.8;

  ctx.font = font(t.shopPt, true);
  fitText(ctx, shopName, infoX, y + baseline(t.shopPt), infoW);
  y += rowH(t.shopPt) + t.shopRulePadMm;
  ctx.fillRect(infoX, y, infoW, LABEL.text.shopRuleMm);
  y += LABEL.text.shopRuleMm;

  y += t.nameTopMm;
  ctx.font = font(t.namePt, true);
  fitText(ctx, spec.productName, infoX, y + baseline(t.namePt), infoW);
  y += rowH(t.namePt);

  // BATCH may truncate; EXP never does — an expiry cut off a medicine sticker
  // is a safety problem, not a cosmetic one.
  y += t.metaTopMm;
  ctx.font = font(t.metaPt, false);
  const exp = expMonthYear(spec.expiry);
  const expText = exp ? `EXP ${exp}` : "";
  const expW = expText ? ctx.measureText(expText).width : 0;
  if (spec.batchNumber) {
    const room = infoW - expW - (expText ? t.metaGapMm : 0);
    fitText(
      ctx,
      `BATCH ${spec.batchNumber}`,
      infoX,
      y + baseline(t.metaPt),
      room,
    );
  }
  if (expText) {
    ctx.fillText(expText, infoX + infoW - expW, y + baseline(t.metaPt));
  }
  y += rowH(t.metaPt);

  y += t.mrpTopMm;
  ctx.font = font(t.mrpPt, true);
  ctx.fillText(`MRP ${money(spec.mrp)}`, infoX, y + baseline(t.mrpPt));

  // --- Code128 across the full width, inside its quiet zones ---------------
  const barCanvas = document.createElement("canvas");
  bwipjs.toCanvas(barCanvas, {
    bcid: "code128",
    text: spec.labelCode,
    height: 7,
    includetext: false,
    paddingwidth: 0,
    paddingheight: 0,
  });
  const barX = LABEL.pad.left + LABEL.barcode.quietMm;
  const barY = LABEL.pad.top + band + LABEL.barcode.padTopMm;
  const barH = LABEL.barcode.bandMm - LABEL.barcode.padTopMm;
  // Stretched in height only. Every bar keeps the same horizontal factor, so
  // the ratios the scanner decodes are untouched.
  ctx.drawImage(barCanvas, barX, barY, barcodeWidthMm(), barH);

  return canvas;
}

/**
 * One sticker as a PNG data URL, at the printer's native resolution.
 *
 * This is the exact bitmap that goes on the paper, which makes it the honest
 * thing to test: decode this and you know whether the printed label scans.
 */
export async function renderLabelPng(
  spec: LabelSpec,
  shopName: string,
): Promise<string> {
  const canvas = await drawLabel(spec, shopName);
  return canvas.toDataURL("image/png");
}

/**
 * Build the print-ready PDF: one exactly-38x15mm page per sticker.
 *
 * `scale` is the shop's size calibration. On this path it should normally be 1
 * — a PDF states its page size outright, so there is far less for a print
 * pipeline to reinterpret — but if a driver still resizes, the same correction
 * applies here as everywhere else.
 */
export async function buildLabelPdf(
  specs: LabelSpec[],
  shopName: string,
  scale = 1,
  maxLabels = 300,
): Promise<Blob> {
  const s = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const pageW = LABEL.wMm * s;
  const pageH = LABEL.hMm * s;

  const doc = new jsPDF({
    unit: "mm",
    format: [pageW, pageH],
    orientation: pageW >= pageH ? "landscape" : "portrait",
    compress: true,
  });

  // One render per DISTINCT label, then repeated — a 100-unit lot shouldn't pay
  // for 100 identical rasterisations.
  const pngByCode = new Map<string, string>();
  let count = 0;
  let first = true;

  for (const spec of specs) {
    if (!pngByCode.has(spec.labelCode)) {
      pngByCode.set(spec.labelCode, await renderLabelPng(spec, shopName));
    }
    const png = pngByCode.get(spec.labelCode)!;
    const copies = Math.max(1, Math.floor(spec.copies || 1));
    for (let i = 0; i < copies && count < maxLabels; i++, count++) {
      if (!first) doc.addPage([pageW, pageH]);
      first = false;
      // Placed edge to edge: the artwork already carries its own margins, and
      // the page IS the sticker.
      doc.addImage(png, "PNG", 0, 0, pageW, pageH);
    }
  }

  return doc.output("blob");
}

/**
 * The measuring sticker, as a PDF.
 *
 * Has to travel the SAME route as a real label — same renderer, same page
 * construction — or the shop would be calibrating one pipeline and printing
 * through another, and the correction would be wrong by whatever differs.
 */
export async function buildCalibrationPdf(
  barMm: number,
  scale = 1,
): Promise<Blob> {
  const s = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const pageW = LABEL.wMm * s;
  const pageH = LABEL.hMm * s;

  const { canvas, ctx } = ctxFor(LABEL.wMm, LABEL.hMm);
  const t = LABEL.text;
  const x = LABEL.pad.left;
  let y = LABEL.pad.top;

  ctx.font = font(t.shopPt, true);
  y += t.shopPt * PT_MM * t.lineHeight * 0.8;
  ctx.fillText("LABEL SIZE TEST", x, y);

  // The bar, exactly barMm as authored, with ticks below so a ruler can be
  // lined up against its true ends rather than guessed at.
  y += 1.6;
  ctx.fillRect(x, y, barMm, 1.6);
  ctx.fillRect(x, y + 1.6, 0.3, 1.2);
  ctx.fillRect(x + barMm - 0.3, y + 1.6, 0.3, 1.2);
  y += 1.6 + 1.2;

  ctx.font = font(t.metaPt, false);
  y += t.metaPt * PT_MM * t.lineHeight * 0.8 + 0.6;
  fitText(
    ctx,
    `Measure the bar. It should be ${barMm} mm.`,
    x,
    y,
    LABEL.wMm - LABEL.pad.left - LABEL.pad.right,
  );

  const doc = new jsPDF({
    unit: "mm",
    format: [pageW, pageH],
    orientation: pageW >= pageH ? "landscape" : "portrait",
    compress: true,
  });
  doc.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, pageW, pageH);
  return doc.output("blob");
}
