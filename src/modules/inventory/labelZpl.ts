import type { LabelSpec } from "@modules/inventory/label";
import {
  drawLabel,
  drawCalibrationLabel,
  LABEL_DOTS,
} from "@modules/inventory/labelCanvas";

/**
 * Labels as ZPL, for talking to a Zebra directly.
 *
 * This is the end of the road for the printing problem. Every other path hands
 * artwork to something that gets an opinion about it — a print dialog with a
 * scale setting, a driver with a paper size, a browser that adds its own header
 * and footer. ZPL has no such layer: the printer is told which dots to burn,
 * and it burns them. No page size to mismatch, nothing to scale, nothing to
 * rotate, no dialog to get wrong.
 *
 * The label goes over as a ^GFA graphic rather than as ZPL text and barcode
 * commands. That is deliberate: it is the very bitmap the decode tests read, so
 * what the shop sticks on a box is dot-for-dot what was verified, with no
 * second layout in a language whose fonts and barcode defaults would drift from
 * the other two renderers.
 */

/** Bytes per row once the bitmap is packed 8 dots to a byte. */
const rowBytes = (widthDots: number) => Math.ceil(widthDots / 8);

/**
 * Canvas -> 1-bit rows, packed MSB-first, which is how ^GFA reads them.
 *
 * A thermal head has no grey: every dot is burned or not. Anything darker than
 * mid-grey becomes a dot, which matches the threshold the print tests use.
 */
function monoRows(canvas: HTMLCanvasElement): Uint8Array {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context unavailable");
  const { width, height } = canvas;
  const src = ctx.getImageData(0, 0, width, height).data;
  const stride = rowBytes(width);
  const out = new Uint8Array(stride * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      // Alpha 0 is the untouched white background, not black.
      const lum =
        src[i + 3] === 0
          ? 255
          : 0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2];
      if (lum < 128) out[y * stride + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }
  return out;
}

const hex = (bytes: Uint8Array) => {
  let s = "";
  for (const b of bytes) s += b.toString(16).padStart(2, "0").toUpperCase();
  return s;
};

/**
 * One ^XA…^XZ format for a bitmap, printed `copies` times.
 *
 * ^PW and ^LL state the label's exact width and length in dots, so the printer
 * does not fall back to whatever its last job or its driver believed. ^LH0,0
 * and ^FO0,0 put the artwork hard against the label's origin — the design
 * already carries its own margins.
 */
function zplForBitmap(canvas: HTMLCanvasElement, copies: number): string {
  const rows = monoRows(canvas);
  const stride = rowBytes(canvas.width);
  const total = rows.length;
  const qty = Math.max(1, Math.floor(copies));
  return [
    "^XA",
    `^PW${canvas.width}`,
    `^LL${canvas.height}`,
    "^LH0,0",
    "^LT0",
    `^FO0,0^GFA,${total},${total},${stride},${hex(rows)}^FS`,
    // Quantity handled by the printer: one format down the wire, N stickers
    // out, rather than repeating a 4.5KB graphic for every copy.
    qty > 1 ? `^PQ${qty},0,1,Y` : "",
    "^XZ",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * The whole run as ZPL.
 *
 * One format per DISTINCT label with ^PQ for its copies — a 100-unit receipt is
 * one graphic and a quantity, not a hundred graphics.
 */
export async function buildLabelZpl(
  specs: LabelSpec[],
  shopName: string,
  maxLabels = 300,
): Promise<string> {
  const parts: string[] = [];
  let count = 0;

  for (const spec of specs) {
    if (count >= maxLabels) break;
    const copies = Math.min(
      Math.max(1, Math.floor(spec.copies || 1)),
      maxLabels - count,
    );
    parts.push(zplForBitmap(await drawLabel(spec, shopName), copies));
    count += copies;
  }
  return parts.join("\n");
}

/** The measuring sticker, as ZPL. */
export function buildCalibrationZpl(barMm: number): string {
  return zplForBitmap(drawCalibrationLabel(barMm), 1);
}

/** Dots the printer is being told to use — handy when reporting what was sent. */
export const ZPL_LABEL_DOTS = LABEL_DOTS;
