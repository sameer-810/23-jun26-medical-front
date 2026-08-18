/**
 * The shelf label's geometry, in millimetres, as ONE set of numbers.
 *
 * There are two renderers for this label and they must agree:
 *
 *   - the HTML/CSS one in `label.ts`, used by the desktop and native print
 *     paths, which hand an exact page size to the print job;
 *   - the canvas one in `labelPdf.ts`, used by browsers, which cannot be
 *     stopped from adding headers and footers to an HTML print but add nothing
 *     to a PDF.
 *
 * Two renderers is a real cost, and the way it usually goes wrong is drift —
 * someone nudges a font in the CSS and the PDF quietly stops matching. That is
 * why the numbers live here rather than in either renderer, and why there is a
 * test (`pdf-vs-dom` in the label rig) that measures both outputs and fails if
 * the QR, the barcode or the label itself differ by more than a printer dot.
 *
 * Every value below was arrived at by decoding printed output at 203dpi, not by
 * eye. Changing one is a print-quality decision — see the notes in `label.ts`.
 */
export const LABEL = {
  wMm: 38,
  hMm: 15,
  /** Matches `.label { padding: .8mm 1.4mm .5mm 1.5mm }`. */
  pad: { top: 0.8, right: 1.4, bottom: 0.5, left: 1.5 },
  qr: {
    /** `.qr` column width — wider than the symbol, and that white IS the quiet zone. */
    colMm: 8.6,
    /** `.qr svg` — 21 modules across this is ~2.8 dots each at 203dpi. */
    symbolMm: 7.2,
    /** `.top { gap }` between the QR column and the text. */
    gapMm: 1.5,
  },
  barcode: {
    /** `.barcode` band height, including its top padding. */
    bandMm: 4.6,
    padTopMm: 0.45,
    /** White each side so a scanner can find the symbol's ends. */
    quietMm: 2,
  },
  text: {
    shopPt: 4,
    namePt: 5,
    metaPt: 4,
    mrpPt: 6,
    /** Arial needs ~1.15em of line box; 1.1 sliced the ascenders. */
    lineHeight: 1.2,
    shopRuleMm: 0.25,
    shopRulePadMm: 0.15,
    nameTopMm: 0.2,
    metaTopMm: 0.15,
    mrpTopMm: 0.1,
    /** Gap between BATCH and EXP on the shared line. */
    metaGapMm: 1.2,
  },
} as const;

/** One PostScript point in millimetres — CSS pt, which the stylesheet uses. */
export const PT_MM = 25.4 / 72;

/**
 * The resolution to rasterise at for the PDF.
 *
 * 203dpi is the native dot pitch of essentially every Indian pharmacy label
 * printer, so rendering at exactly that puts one image pixel on one printer dot
 * — no resampling between us and the paper, which is the whole point of doing
 * this as a bitmap rather than as scalable text. A 300dpi printer resamples
 * cleanly from here; going higher only inflates the file.
 */
export const PRINT_DPI = 203;

/** Width of the text column left of the QR, derived so it can't drift. */
export const infoWidthMm = () =>
  LABEL.wMm -
  LABEL.pad.left -
  LABEL.pad.right -
  LABEL.qr.colMm -
  LABEL.qr.gapMm;

/** Width available to the Code128 bars, inside their quiet zones. */
export const barcodeWidthMm = () =>
  LABEL.wMm - LABEL.pad.left - LABEL.pad.right - LABEL.barcode.quietMm * 2;

/** Height of the upper band holding the QR and the four text rows. */
export const topBandMm = () =>
  LABEL.hMm - LABEL.pad.top - LABEL.pad.bottom - LABEL.barcode.bandMm;
