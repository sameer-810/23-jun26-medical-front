import { jsPDF } from "jspdf";
import type { LabelSpec } from "@modules/inventory/label";
import { LABEL } from "@modules/inventory/labelSpec";
import {
  drawCalibrationLabel,
  renderLabelPng,
} from "@modules/inventory/labelCanvas";

export { renderLabelPng };

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

  const canvas = drawCalibrationLabel(barMm);

  const doc = new jsPDF({
    unit: "mm",
    format: [pageW, pageH],
    orientation: pageW >= pageH ? "landscape" : "portrait",
    compress: true,
  });
  doc.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, pageW, pageH);
  return doc.output("blob");
}
