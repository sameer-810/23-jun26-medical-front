/**
 * Client-side port of the server's sale pricing (sale.service.js priceLine +
 * totals). Exists for ONE purpose: printing a provisional invoice for a bill
 * captured offline. The server reprices every line at sync and remains the
 * authority — this must round exactly the way the server rounds, or the
 * printed bill and the synced invoice disagree by a paisa.
 */

export const round = (n: number) =>
  Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const round3 = (n: number) =>
  Math.round((Number(n) + Number.EPSILON) * 1000) / 1000;

/** A line may land one paisa over: both sides are rounded to the paisa. */
export const MRP_TOLERANCE = 0.01;

/** The rates the till's GST box may switch a line to. */
export const GST_SLABS = [0, 5, 12, 18, 28];

/**
 * Port of the server's sale/mrpCeiling.js. MRP is GST-inclusive and legally the
 * most a customer can pay; lot MRPs are per BASE unit. Highest price per SALE
 * unit it allows, four decimals, floored: ₹22 for 15 tablets is ₹1.4667 each.
 */
export function maxUnitPrice(
  mrpPerBase: number,
  factor: number,
  taxRate: number,
  priceIncludesTax: boolean,
) {
  const ceiling = mrpPerBase * factor;
  const beforeTax = priceIncludesTax ? ceiling : ceiling / (1 + taxRate / 100);
  return Math.floor(beforeTax * 10000 + 1e-6) / 10000;
}

/** True when the rate, tax-inclusive and before discount, is above the MRP. */
export function aboveMrp(l: {
  unitPrice: number;
  quantity: number;
  baseQuantity: number;
  mrpPerBase: number;
  taxRate: number;
  priceIncludesTax: boolean;
}) {
  const gross = round(l.unitPrice * l.quantity);
  const charged = l.priceIncludesTax
    ? gross
    : round(gross + round((gross * l.taxRate) / 100));
  return round(charged - round(l.mrpPerBase * l.baseQuantity)) > MRP_TOLERANCE;
}

export interface OfflinePriceLineInput {
  productName: string;
  sku?: string;
  hsnCode?: string;
  mrp?: number;
  manufacturerName?: string;
  brandName?: string;
  baseUnit?: string;
  unit: string;
  /** Base units per sale unit (1 when selling the base unit). */
  factor: number;
  quantity: number;
  unitPrice: number;
  discountAmount?: number;
  discountPct?: number;
  taxRatePct: number;
}

export interface OfflinePricedSale {
  lines: {
    productName: string;
    sku: string;
    hsnCode: string;
    mrp: number;
    manufacturerName: string;
    brandName: string;
    baseUnit: string;
    unit: string;
    quantity: number;
    baseQuantity: number;
    unitPrice: number;
    grossAmount: number;
    discountAmount: number;
    taxableAmount: number;
    taxRatePct: number;
    cgst: number;
    sgst: number;
    igst: number;
    taxAmount: number;
    lineTotal: number;
  }[];
  subtotal: number;
  totalDiscount: number;
  totalTaxable: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalTax: number;
  roundOff: number;
  grandTotal: number;
}

export function priceSaleLocally(
  lines: OfflinePriceLineInput[],
  opts: {
    priceIncludesTax: boolean;
    taxType: "intra" | "inter";
    /** Settings → Tax Enabled; off charges no GST on any line. */
    taxEnabled?: boolean;
  },
): OfflinePricedSale {
  const { priceIncludesTax, taxType, taxEnabled = true } = opts;
  const out: OfflinePricedSale = {
    lines: [],
    subtotal: 0,
    totalDiscount: 0,
    totalTaxable: 0,
    totalCgst: 0,
    totalSgst: 0,
    totalIgst: 0,
    totalTax: 0,
    roundOff: 0,
    grandTotal: 0,
  };

  for (const line of lines) {
    const gross = round(line.unitPrice * line.quantity);
    let discount = 0;
    if (typeof line.discountAmount === "number") discount = line.discountAmount;
    else if (typeof line.discountPct === "number")
      discount = round((gross * line.discountPct) / 100);
    discount = Math.min(Math.max(discount, 0), gross);

    const taxRate = taxEnabled ? line.taxRatePct || 0 : 0;
    const net = round(gross - discount);

    let taxable: number;
    let tax: number;
    if (priceIncludesTax) {
      taxable = round(net / (1 + taxRate / 100));
      tax = round(net - taxable);
    } else {
      taxable = net;
      tax = round((taxable * taxRate) / 100);
    }
    const cgst = taxType === "intra" ? round(tax / 2) : 0;
    const sgst = taxType === "intra" ? round(tax - cgst) : 0;
    const igst = taxType === "inter" ? tax : 0;
    const lineTotal = round(taxable + tax);

    out.lines.push({
      productName: line.productName,
      sku: line.sku || "",
      hsnCode: line.hsnCode || "",
      mrp: line.mrp || 0,
      manufacturerName: line.manufacturerName || "",
      brandName: line.brandName || "",
      baseUnit: line.baseUnit || "",
      unit: line.unit,
      quantity: line.quantity,
      baseQuantity: round3(line.quantity * line.factor),
      unitPrice: line.unitPrice,
      grossAmount: gross,
      discountAmount: discount,
      taxableAmount: taxable,
      taxRatePct: taxRate,
      cgst,
      sgst,
      igst,
      taxAmount: tax,
      lineTotal,
    });

    out.subtotal = round(out.subtotal + gross);
    out.totalDiscount = round(out.totalDiscount + discount);
    out.totalTaxable = round(out.totalTaxable + taxable);
    out.totalCgst = round(out.totalCgst + cgst);
    out.totalSgst = round(out.totalSgst + sgst);
    out.totalIgst = round(out.totalIgst + igst);
    out.totalTax = round(out.totalTax + tax);
  }

  const rawGrand = round(out.totalTaxable + out.totalTax);
  out.grandTotal = Math.round(rawGrand);
  out.roundOff = round(out.grandTotal - rawGrand);
  return out;
}
