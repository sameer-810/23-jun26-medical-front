import bwipjs from "bwip-js/browser";
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
 * The label, drawn on the printer's own dot grid.
 *
 * One renderer, two consumers: the PDF path (`labelPdf.ts`) for browsers
 * printing through a dialog, and the ZPL path (`labelZpl.ts`) for talking to a
 * Zebra directly. Both want the identical bitmap — the whole reason this is a
 * bitmap and not text is that it removes every chance for a driver, a font or a
 * page setting to reinterpret the artwork between here and the paper.
 *
 * At 203dpi one canvas pixel IS one printer dot, so what the decode tests read
 * off this canvas is literally what gets burned into the sticker.
 */

const dots = (mm: number) => Math.round((mm / 25.4) * PRINT_DPI);

/** Canvas size of one label, in printer dots. */
export const LABEL_DOTS = {
  width: dots(LABEL.wMm),
  height: dots(LABEL.hMm),
};

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
export async function drawLabel(
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
 * The measuring sticker.
 *
 * Drawn here, beside the real label, so it travels the same renderer on the
 * same dot grid — calibrating through one pipeline and printing through another
 * would build the difference between them into the correction.
 */
export function drawCalibrationLabel(barMm: number): HTMLCanvasElement {
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
