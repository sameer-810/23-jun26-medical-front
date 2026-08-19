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
    // A printer REMEMBERS its settings, and this one arrived configured by the
    // EPL driver. Every line here states something the format must not inherit:
    //
    //   ^PON  normal orientation. The printer had ^POI stored, so the first
    //         ZPL run came out upside down — correct artwork, rotated 180.
    //   ^MNY  media tracking by web/gap sensing. Die-cut stock has a gap
    //         between stickers; without this the printer treats the roll as
    //         continuous, never learns where a label ends, and lets one label
    //         straddle two stickers with blanks in between.
    //   ^MTD  direct thermal. The GC420d has no ribbon; saying so stops it
    //         waiting on one.
    //   ^LH/^LT/^LS  origin, top offset and shift all zeroed, so the artwork
    //         starts hard at the label's corner and nothing nudges it.
    "^PON",
    "^MNY",
    "^MTD",
    `^PW${canvas.width}`,
    `^LL${canvas.height}`,
    "^LH0,0",
    "^LT0",
    "^LS0",
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
 * One-time printer setup: teach it the media, then have it measure the gap.
 *
 * `~JC` makes the printer feed a few labels and find the gap between them
 * itself. That measurement is what stops a label straddling two stickers, and
 * it cannot be done from artwork — the printer has to see the roll. It is
 * separate from printing because it wastes a few labels and only needs doing
 * when the roll or the printer changes.
 *
 * `^JUS` saves the settings so they survive a power cycle, which matters: the
 * wrong ones were persisted by the EPL driver in the first place.
 */
export function buildPrinterSetupZpl(): string {
  return [
    "^XA",
    "^PON",
    "^MNY",
    "^MTD",
    `^PW${LABEL_DOTS.width}`,
    `^LL${LABEL_DOTS.height}`,
    "^LH0,0",
    "^LT0",
    "^LS0",
    "^JUS",
    "^XZ",
    // Media calibration is its own command, outside a label format.
    "~JC",
  ].join("\n");
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
