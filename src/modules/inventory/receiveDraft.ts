import {
  DraftLine,
  ProductLite,
  ReceiptLineInput,
  ScannedBill,
} from "@modules/inventory/types";

/**
 * Goods-received draft rules.
 *
 * All the decisions the Receive Stock form makes — what a scan may pre-fill,
 * when a line is safe to save, how pack quantities convert to base units — live
 * here as pure functions so they can be reasoned about (and tested) without
 * rendering a screen. The screen stays presentation + wiring.
 */

export type LineTone = "ok" | "warn" | "todo";

export const emptyLine = (): DraftLine => ({
  productId: null,
  batchNumber: "",
  mfgDate: "",
  expiryDate: "",
  unit: null,
  quantity: "",
  freeQuantity: "",
  purchasePrice: "",
  mrp: "",
  discountPct: "",
  gstPct: "",
  locationId: null,
});

/** ISO timestamp -> YYYY-MM-DD for the date fields. */
export const isoToDate = (iso: string | null) =>
  iso ? String(iso).slice(0, 10) : "";

/**
 * Normalise a date cell for the server, which requires a full YYYY-MM-DD. The
 * grid accepts a month-only "YYYY-MM"; expand it (expiry -> last day of month so
 * FEFO/expiry logic is right; mfg -> the 1st). Full dates and blanks pass through.
 */
export function normalizeDateInput(
  s: string,
  kind: "expiry" | "mfg",
): string | undefined {
  const t = (s || "").trim();
  if (!t) return undefined;
  const m = /^(\d{4})-(\d{2})$/.exec(t);
  if (!m) return t; // already YYYY-MM-DD (or something the server will validate)
  const y = +m[1];
  const mo = +m[2];
  const day = kind === "expiry" ? new Date(y, mo, 0).getDate() : 1;
  return `${m[1]}-${m[2]}-${String(day).padStart(2, "0")}`;
}

/** Units this product can be received in: its base unit plus any packs. */
export function unitOptions(
  product?: ProductLite | null,
): { value: string; label: string }[] {
  if (!product) return [];
  return [
    { value: product.baseUnit, label: `${product.baseUnit} (base)` },
    ...(product.packs || []).map((p) => ({
      value: p.unit,
      label: `${p.unit} (×${p.factor} ${product.baseUnit})`,
    })),
  ];
}

/**
 * How many base units one of this line's units is worth. A line received in
 * "cap (×15 tablet)" has a factor of 15; base units and unknown packs are 1.
 */
export function unitFactor(
  line: DraftLine,
  product?: ProductLite | null,
): number {
  if (!product || !line.unit || line.unit === product.baseUnit) return 1;
  return (product.packs || []).find((p) => p.unit === line.unit)?.factor || 1;
}

/**
 * Quantity converted into base units — a pack of 15 tablets is 15, not 1. Free
 * (scheme) units are received too, so they count toward what's put on the shelf.
 */
export function baseQty(line: DraftLine, product?: ProductLite | null): number {
  const qty = (Number(line.quantity) || 0) + (Number(line.freeQuantity) || 0);
  if (!product) return 0;
  return qty * unitFactor(line, product);
}

/** Money to the paisa. Distributor invoices settle at 2dp; so do we. */
const paise = (n: number) =>
  Number.isFinite(n) ? Math.round((n + Number.EPSILON) * 100) / 100 : 0;

/**
 * The line's payable as the BILL states it: qty × the printed rate.
 *
 * The rate cell holds the rate for ONE of the line's units — the same figure
 * the distributor printed — so this multiplies out to the bill's AMOUNT column
 * with no pack arithmetic in between. That is the number the pharmacist is
 * checking against the paper, so it is the number we compute.
 */
export function lineAmount(line: DraftLine): number {
  return paise(
    (Number(line.quantity) || 0) * (Number(line.purchasePrice) || 0),
  );
}

export interface LineTotals {
  /** QTY × RATE — the bill's AMOUNT / VALUE / NET AMT column. */
  gross: number;
  /** AMOUNT × DIS% — the bill's DISC AMT. */
  discount: number;
  /** AMOUNT − DISC AMT — the bill's TAXABLE. */
  taxable: number;
  /** TAXABLE × GST% — split CGST+SGST, or charged whole as IGST. */
  gst: number;
  /** TAXABLE + GST — the bill's TOTAL AMT for this line. */
  total: number;
}

/**
 * One line, worked the way every invoice in `All Bills` works it.
 *
 * The chain is the same on all of them, whatever the column headings say:
 *
 *   QTY × RATE = AMOUNT        (SHREE PIONEER: 5 × 111.25 = 556.25)
 *   AMOUNT − DIS%  = TAXABLE   (556.25 − 16.69 = 539.56)
 *   TAXABLE × GST% = GST       (539.56 × 5% = 26.98, printed as 13.49 + 13.49)
 *
 * Free goods are deliberately absent: they arrive and go on the shelf, but a
 * "10 + 1" line is billed for ten. Every bill reviewed does the same.
 */
export function lineTotals(line: DraftLine): LineTotals {
  const gross = lineAmount(line);
  const discPct = Math.min(Math.max(Number(line.discountPct) || 0, 0), 100);
  const discount = paise((gross * discPct) / 100);
  const taxable = paise(gross - discount);
  const gst = paise((taxable * (Number(line.gstPct) || 0)) / 100);
  return { gross, discount, taxable, gst, total: paise(taxable + gst) };
}

export interface BillTotals extends LineTotals {
  /** Half the GST each, the way an intra-state invoice prints it. */
  cgst: number;
  sgst: number;
  /** The whole GST in one column — inter-state supply. */
  igst: number;
  /** What the invoice calls "Round Off" / "P. Off" — never silently applied. */
  roundOff: number;
  /** TOTAL AMT after the round-off. The bill's "TO PAY" / "Grand Total". */
  payable: number;
}

/**
 * The foot of the bill.
 *
 * Both halves are kept: the exact total to the paisa AND the round-off that
 * takes it to rupees. That is not a nicety — every invoice reviewed prints the
 * pair (SAFE LIFE: TOTAL AMT 572.34, RoundOff −0.34, TO PAY 572.00), and a
 * pharmacist reconciling a payment needs to see which of the two we mean.
 */
export function billTotals(
  lines: DraftLine[],
  taxType: "intra" | "inter" = "intra",
): BillTotals {
  const sum = lines.reduce(
    (acc, l) => {
      const t = lineTotals(l);
      return {
        gross: acc.gross + t.gross,
        discount: acc.discount + t.discount,
        taxable: acc.taxable + t.taxable,
        gst: acc.gst + t.gst,
        total: acc.total + t.total,
      };
    },
    { gross: 0, discount: 0, taxable: 0, gst: 0, total: 0 },
  );

  const gst = paise(sum.gst);
  const total = paise(sum.total);
  const payable = Math.round(total);
  return {
    gross: paise(sum.gross),
    discount: paise(sum.discount),
    taxable: paise(sum.taxable),
    gst,
    total,
    cgst: taxType === "intra" ? paise(gst / 2) : 0,
    sgst: taxType === "intra" ? paise(gst / 2) : 0,
    igst: taxType === "inter" ? gst : 0,
    roundOff: paise(payable - total),
    payable,
  };
}

export function totalBaseUnits(
  lines: DraftLine[],
  byId: Record<string, ProductLite>,
): number {
  return lines.reduce(
    (sum, l) => sum + baseQty(l, l.productId ? byId[l.productId] : null),
    0,
  );
}

/**
 * What a collapsed row should say. A line is only "Ready" once it has
 * everything the server requires — otherwise the row names the gap, so 25 lines
 * can be triaged without opening 25 forms.
 */
export function lineStatus(line: DraftLine): { label: string; tone: LineTone } {
  if (!line.productId) return { label: "Product?", tone: "todo" };
  if (!line.batchNumber.trim()) return { label: "Batch?", tone: "todo" };
  if (!(Number(line.quantity) > 0)) return { label: "Qty?", tone: "todo" };
  if (!line.locationId) return { label: "Location?", tone: "todo" };
  if (line.flagged) return { label: "Check", tone: "warn" };
  return { label: "Ready", tone: "ok" };
}

/**
 * What to call this row.
 *
 * A matched product wins. Failing that the bill's own wording is far better
 * than "Choose a product": it's how the pharmacist finds the line on the paper
 * in front of them. Only a hand-added row has genuinely no name yet.
 */
export function lineTitle(
  line: DraftLine,
  product?: ProductLite | null,
): { text: string; matched: boolean } {
  if (product) return { text: product.name, matched: true };
  const billName = line.fromBill?.productName?.trim();
  if (billName) return { text: billName, matched: false };
  return { text: "Choose a product", matched: false };
}

/** One-line gist of a row while it's collapsed. */
export function summaryLine(line: DraftLine, product?: ProductLite | null) {
  const bits: string[] = [
    line.batchNumber.trim() ? `Batch ${line.batchNumber.trim()}` : "no batch",
  ];
  if (Number(line.quantity) > 0) {
    bits.push(`${line.quantity} ${line.unit || product?.baseUnit || "units"}`);
  }
  if (line.expiryDate) bits.push(`exp ${line.expiryDate}`);
  return bits.join(" · ");
}

/**
 * Turns a scanned bill into form lines.
 *
 * Two deliberate rules:
 *  1. Only values both OCR passes AGREED on are pre-filled — anything disputed
 *     is left BLANK so it must be typed rather than rubber-stamped.
 *  2. The bill's QTY counts PACKS and its RATE is the price of one PACK. Both
 *     are carried across EXACTLY as printed — the rate cell is per the line's
 *     unit, so qty × rate reproduces the bill's AMOUNT column and the screen
 *     can be read against the paper. The conversion to our per-base-unit cost
 *     happens once, on save (see toReceiptLines).
 *
 *     This used to divide the rate by the pack size before showing it, and
 *     blank it entirely whenever the pack couldn't be resolved. A bill printing
 *     ₹241.39 for a 15-cap pack showed ₹16.09 — or, more often, nothing at all.
 *     The rate is printed on the bill; there is no reason to compute it.
 */
export function linesFromScan(bill: ScannedBill): DraftLine[] {
  return bill.lines.map((l) => {
    const trust = <T>(f: { value: T; confidence: "high" | "low" }) =>
      f.confidence === "high" ? f.value : null;

    const batch = trust(l.fields.batchNo);
    const qty = trust(l.fields.quantity);
    const expiryOk = l.fields.expiry.confidence === "high";
    const unit = l.unitResolution?.resolved ? l.unitResolution.unit : null;

    // Rate and MRP come straight off the bill. Both are printed in plain figures
    // in their own columns, so a disputed read is worth showing and flagging —
    // a pharmacist can correct a digit against the paper in front of them, but
    // cannot recover a value we chose to blank.
    const rate = l.fields.rate.value;
    const rateOk = l.fields.rate.confidence === "high";
    const mrpOk = l.fields.mrp.confidence === "high";

    return {
      productId: l.match?.id || null,
      batchNumber: batch ? String(batch) : "",
      mfgDate: "",
      expiryDate: expiryOk ? isoToDate(l.expiryDate) : "",
      unit,
      quantity: qty != null ? String(qty) : "",
      freeQuantity: l.freeQty > 0 ? String(l.freeQty) : "",
      purchasePrice: rate != null ? String(rate) : "",
      mrp: l.mrp != null ? String(l.mrp) : "",
      // DIS% and GST% print on every bill and the reader already extracts them;
      // they were simply being thrown away. Without them the goods-received
      // note can never add up to the bill's TOTAL AMT.
      discountPct: l.discountPct != null ? String(l.discountPct) : "",
      gstPct: l.gstPct != null ? String(l.gstPct) : "",
      locationId: null,
      flagged: l.needsReview || !l.match || !rateOk || !mrpOk,
      // Kept regardless of whether we matched: it names the row for a human,
      // and it's what fills the form if this product has to be created.
      fromBill: {
        productName: l.productName,
        pack: l.pack,
        hsn: l.hsn,
        mrp: l.mrp,
        gstPct: l.gstPct,
      },
    };
  });
}

/** Every product the scan resolved, keyed by id — seeds the picker's cache. */
export function productsFromScan(
  bill: ScannedBill,
): Record<string, ProductLite> {
  const map: Record<string, ProductLite> = {};
  for (const l of bill.lines) {
    if (!l.match) continue;
    map[l.match.id] = {
      id: l.match.id,
      name: l.match.name,
      sku: l.match.sku,
      baseUnit: l.match.baseUnit,
      packs: l.match.packs || [],
    };
  }
  return map;
}

/** The note shown after a scan: how many lines, and how many need attention. */
export function scanSummary(bill: ScannedBill): string {
  const from = bill.supplierName || "the bill";
  const flagged = bill.lines.filter((l) => l.needsReview || !l.match).length;
  return flagged > 0
    ? `${bill.stats.total} lines from ${from} — ${flagged} need a check (unclear values were left blank). Pick a storage location for each line.`
    : `${bill.stats.total} lines from ${from} read cleanly. Pick a storage location for each line.`;
}

/** Re-receiving an invoice doubles the stock — this is the sentence that warns. */
export function duplicateWarning(bill: ScannedBill): string | null {
  if (!bill.duplicate) return null;
  const when = new Date(bill.duplicate.receivedAt).toLocaleDateString();
  return `Invoice ${bill.duplicate.referenceNo} was already received as ${bill.duplicate.receiptNo} on ${when}. Saving again will DOUBLE this stock.`;
}

/** Pharma unit prices run to paise once divided by a pack of 15 or 200. */
const round4 = (n: number) =>
  Number.isFinite(n) ? Math.round(n * 10000) / 10000 : 0;

/** A row the pharmacist has begun filling in — as opposed to a blank spare. */
function isStarted(l: DraftLine): boolean {
  return Boolean(
    l.productId ||
    l.fromBill ||
    l.batchNumber.trim() ||
    String(l.quantity).trim() ||
    l.locationId,
  );
}

/**
 * Started rows that `toReceiptLines` would drop on the floor.
 *
 * Only complete lines get sent, which is right — but they used to be discarded
 * in silence: a 12-line bill with 3 unmatched products saved 9, reset the form
 * and reported success. Those goods were on the shelf and in no GRN, and the
 * receipt could never reconcile against the paper bill. Callers use this to
 * block the save and say exactly which rows still need work.
 */
export function incompleteLines(
  lines: DraftLine[],
  byId: Record<string, ProductLite> = {},
): { i: number; name: string; missing: string[] }[] {
  const out: { i: number; name: string; missing: string[] }[] = [];
  lines.forEach((l, i) => {
    if (!isStarted(l)) return;
    const missing: string[] = [];
    if (!l.productId) missing.push("product");
    if (!l.batchNumber.trim()) missing.push("batch");
    if (!(Number(l.quantity) > 0)) missing.push("quantity");
    if (!l.locationId) missing.push("location");
    if (!missing.length) return;
    const name =
      (l.productId ? byId[l.productId]?.name : null) ||
      l.fromBill?.productName ||
      `Line ${i + 1}`;
    out.push({ i, name, missing });
  });
  return out;
}

/**
 * Only complete lines are sent; the rest are still being worked on.
 *
 * This is the one place the bill's per-PACK figures become the per-BASE-unit
 * `purchasePrice` and `mrp` the server stores — stock valuation multiplies both
 * by a base-unit quantity, so a per-pack MRP inflated stock-at-MRP 15-fold the
 * same way a per-pack rate inflated stock value. Keeping the conversion here —
 * rather than at scan time — means the grid always shows the figures the
 * distributor printed, and the arithmetic happens once, against the unit the
 * pharmacist actually chose.
 */
export function toReceiptLines(
  lines: DraftLine[],
  byId: Record<string, ProductLite> = {},
): ReceiptLineInput[] {
  return lines
    .filter(
      (l) =>
        l.productId &&
        l.batchNumber.trim() &&
        Number(l.quantity) > 0 &&
        l.locationId,
    )
    .map((l) => {
      const factor = unitFactor(l, l.productId ? byId[l.productId] : null);
      return {
        productId: l.productId!,
        batchNumber: l.batchNumber.trim(),
        mfgDate: normalizeDateInput(l.mfgDate, "mfg"),
        expiryDate: normalizeDateInput(l.expiryDate, "expiry"),
        purchasePrice:
          l.purchasePrice === ""
            ? undefined
            : round4(Number(l.purchasePrice) / factor),
        mrp: l.mrp === "" ? undefined : round4(Number(l.mrp) / factor),
        unit: l.unit || undefined,
        quantity: Number(l.quantity),
        freeQuantity:
          l.freeQuantity === "" || Number(l.freeQuantity) <= 0
            ? undefined
            : Number(l.freeQuantity),
        // Percentages, not money — they describe the line whatever unit it was
        // received in, so unlike rate and MRP they need no pack conversion.
        discountPct: l.discountPct === "" ? undefined : Number(l.discountPct),
        gstPct: l.gstPct === "" ? undefined : Number(l.gstPct),
        locationId: l.locationId!,
      };
    });
}
