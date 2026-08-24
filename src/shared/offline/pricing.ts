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

export interface OfflinePriceLineInput {
  productName: string;
  sku?: string;
  hsnCode?: string;
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
  opts: { priceIncludesTax: boolean; taxType: "intra" | "inter" },
): OfflinePricedSale {
  const { priceIncludesTax, taxType } = opts;
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

    const taxRate = line.taxRatePct || 0;
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
