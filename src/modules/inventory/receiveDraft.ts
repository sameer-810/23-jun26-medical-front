import {
  CatalogueHit,
  DraftLine,
  ProductLite,
  ReceiptLineInput,
  ScannedBill,
} from "@modules/inventory/types";
import { fmtDate } from "@shared/format";

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
  schemeAmount: "",
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
 * Pack size printed on a distributor bill: "1X10" -> 10, "10ML" -> 10,
 * "20 GM" -> 20, "15TABS" -> 15. For "AxB" the second number is the content.
 *
 * Mirrors parsePackSize in the server's ocr.units.js, which resolves the unit
 * for lines the scan matched on its own. Keep the two in step: a line matched
 * by hand must come out exactly as one the scan matched.
 */
export function parsePackSize(pack?: string | null): number | null {
  if (!pack) return null;
  const s = String(pack).toUpperCase().replace(/\s+/g, "");
  const multi = /(\d+(?:\.\d+)?)[X*](\d+(?:\.\d+)?)/.exec(s);
  const raw = multi ? multi[2] : /(\d+(?:\.\d+)?)/.exec(s)?.[1];
  const n = Number(raw);
  return raw && Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Which unit the bill's QTY is counted in, for a product picked onto a line.
 *
 * A bill's QTY counts PACKS. Taking the product's base unit instead booked a
 * "1 x 1X10" line as 1 tablet rather than 10 — stock understated tenfold, and
 * the per-strip rate charged against every single tablet.
 *
 * Only an exact match against the product's own pack factors is trusted. When
 * the bill and the product disagree, `unit` is null: the pharmacist chooses,
 * and the line cannot be saved until they do.
 */
/** "20 GM", "10ML", "1X30ML" — a size, not a count. Twin of ocr.units.js. */
export function isMeasurePack(pack?: string | null): boolean {
  return /\d\s*(ML|GM|GMS|G|KG|L|LTR)\b/.test(String(pack || "").toUpperCase());
}

export function unitForBillPack(
  product: ProductLite,
  pack?: string | null,
): { unit: string | null; note: string | null } {
  const packs = product.packs || [];
  // A hand-added row has no bill pack: the base unit is the sensible default.
  if (!pack) return { unit: product.baseUnit, note: null };

  const size = parsePackSize(pack);
  // No packs defined: the base unit is the only unit there is. A measure pack
  // ("20 GM") on a tube/bottle product is just its size — 3 on the bill is
  // 3 pieces, nothing to check.
  if (!packs.length) {
    return {
      unit: product.baseUnit,
      note:
        size && size > 1 && !isMeasurePack(pack)
          ? `Bill sells packs of ${size}, but this product has no pack unit — quantity is taken as ${product.baseUnit}.`
          : null,
    };
  }
  if (size === 1) return { unit: product.baseUnit, note: null };

  const exact =
    size === null ? null : packs.find((p) => Number(p.factor) === size);
  if (exact) return { unit: exact.unit, note: null };

  return {
    unit: null,
    note: `Bill pack "${pack}" doesn't match this product's units — choose the unit.`,
  };
}

/** "ALDIGESIC-TH TAB" and "Aldigesic-TH  tab." are the same bill line. */
function billKey(line: DraftLine): string {
  return (line.fromBill?.productName || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

/**
 * Put a product on a line, and on every other unmatched line the bill printed
 * under the same name.
 *
 * Distributors print one row per batch, so one medicine bought in two batches
 * is two rows with identical names. Matching the first and leaving the second
 * "Set product..." made the pharmacist match the same medicine twice.
 *
 * Each line gets the unit for ITS OWN pack. `row` is the line that asked; null
 * means the top search bar, which fills the first blank line or appends one.
 */
export function applyProductToLines(
  lines: DraftLine[],
  row: number | null,
  product: ProductLite,
  newLineLocation: string | null = null,
): DraftLine[] {
  const fill = (l: DraftLine): DraftLine => {
    const { unit, note } = unitForBillPack(product, l.fromBill?.pack);
    return {
      ...l,
      productId: product.id,
      unit,
      unitNote: note || undefined,
      // A blank row picked up by hand gets the usual rack too.
      locationId: l.locationId ?? newLineLocation,
      flagged: l.flagged || unit === null,
    };
  };

  if (row === null) {
    const blank = lines.findIndex((l) => !l.productId);
    if (blank >= 0) return lines.map((l, k) => (k === blank ? fill(l) : l));
    return [...lines, fill({ ...emptyLine(), locationId: newLineLocation })];
  }

  const key = row < lines.length ? billKey(lines[row]) : "";
  return lines.map((l, k) => {
    if (k === row) return fill(l);
    if (key && !l.productId && billKey(l) === key) return fill(l);
    return l;
  });
}

/**
 * Does the pharmacist have a pack to choose? Not when the bill already settled
 * it: the line reads as printed, and a dropdown there only invites a change
 * that makes the stock and rate wrong. A product with one unit has no choice.
 */
export function packChoiceNeeded(
  line: DraftLine,
  product?: ProductLite | null,
) {
  if (!product || !(product.packs || []).length) return false;
  return !line.fromBill?.pack || !line.unit;
}

/** The line's unit as the bill would write it: "10 tablet", "tube". */
export function packLabel(line: DraftLine, product?: ProductLite | null) {
  const pack = (product?.packs || []).find((p) => p.unit === line.unit);
  if (pack) return `${pack.factor} ${product?.baseUnit}`;
  return line.unit || product?.baseUnit || "";
}

/**
 * A line whose product has pack units but no unit chosen. Saving it would book
 * the quantity as base units, which is the exact mistake unitForBillPack exists
 * to prevent — so it blocks the save rather than defaulting.
 */
export function needsUnit(line: DraftLine, product?: ProductLite | null) {
  return Boolean(
    line.productId && product && (product.packs || []).length && !line.unit,
  );
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
  // Scheme in rupees (SCH AMT) comes off with the percent — same as the server.
  const scheme = Math.max(Number(line.schemeAmount) || 0, 0);
  const discount = paise(Math.min((gross * discPct) / 100 + scheme, gross));
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
export function lineStatus(
  line: DraftLine,
  product?: ProductLite | null,
): { label: string; tone: LineTone } {
  if (!line.productId) return { label: "Product?", tone: "todo" };
  if (needsUnit(line, product)) return { label: "Unit?", tone: "todo" };
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
      unitNote:
        (l.unitResolution?.resolved
          ? l.unitResolution?.note
          : l.unitResolution?.reason) || undefined,
      catalogMatch: l.match ? undefined : l.catalogMatch || undefined,
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

/** Unmatched rows the scanner found in the medicine catalogue, still unfilled. */
export function catalogueRows(
  lines: DraftLine[],
): { row: number; hit: CatalogueHit }[] {
  return lines.flatMap((l, row) =>
    !l.productId && l.catalogMatch ? [{ row, hit: l.catalogMatch }] : [],
  );
}

/** Re-receiving an invoice doubles the stock — this is the sentence that warns. */
/** The GST% on the lines don't rebuild the GST printed on the bill. */
export function gstWarning(bill: ScannedBill): string | null {
  const m = bill.gstMismatch;
  if (!m) return null;
  const printed = m.billTax != null ? `₹${m.billTax}` : "a different amount";
  return `The lines come to ₹${m.lineTax} GST but the bill prints ${printed}. Check the GST% on each line against the bill.`;
}

export function duplicateWarning(bill: ScannedBill): string | null {
  if (!bill.duplicate) return null;
  const when = fmtDate(bill.duplicate.receivedAt);
  return `Invoice ${bill.duplicate.referenceNo} was already received as ${bill.duplicate.receiptNo} on ${when}. Saving again will DOUBLE this stock.`;
}

/** Pharma unit prices run to paise once divided by a pack of 15 or 200. */
const round4 = (n: number) =>
  Number.isFinite(n) ? Math.round(n * 10000) / 10000 : 0;

/** True once any field is filled in, which distinguishes a started row from a blank spare. */
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
 * Started rows that `toReceiptLines` would drop, with the fields each one is
 * missing. A started row must be complete or the save is blocked — partial rows
 * are never submitted.
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
    if (needsUnit(l, l.productId ? byId[l.productId] : null))
      missing.push("unit");
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
        schemeAmount:
          !l.schemeAmount || Number(l.schemeAmount) <= 0
            ? undefined
            : Number(l.schemeAmount),
        gstPct: l.gstPct === "" ? undefined : Number(l.gstPct),
        locationId: l.locationId!,
      };
    });
}
