/**
 * Builds a printable Sale document for a bill captured offline.
 *
 * The pharmacist hands the customer a bill NOW; the server's copy arrives
 * whenever the queue drains. Every figure is computed with the same rounding
 * the server uses (see shared/offline/pricing.ts), the invoice number is the
 * one the device's registered series reserved, and the header comes from the
 * cached invoice profile — so the provisional print and the synced invoice
 * are the same piece of paper.
 *
 * Returns null when the local catalogue can't fully resolve the lines (a
 * device that never synced) — the caller then shows the queued notice
 * without a print offer rather than printing a wrong bill.
 */
import { CreateSalePayload, Sale } from "@modules/sale/types";
import { getCachedInvoiceProfile } from "@modules/sale/api/saleApi";
import { localCatalog, LocalProduct } from "@shared/offline/localCatalog";
import {
  priceSaleLocally,
  round,
  OfflinePriceLineInput,
} from "@shared/offline/pricing";
import { useAuthStore } from "@shared/store/useAuthStore";

function unitFactor(product: LocalProduct, unit?: string): number | null {
  if (!unit || unit.toLowerCase() === (product.baseUnit || "").toLowerCase())
    return 1;
  const pack = (product.packs || []).find(
    (p) => p.unit.toLowerCase() === unit.toLowerCase(),
  );
  return pack ? pack.factor : null;
}

export async function buildOfflineSaleDoc(
  payload: CreateSalePayload,
  displayNo: string | null,
): Promise<Sale | null> {
  if (!localCatalog.ready) return null;

  const profile = await getCachedInvoiceProfile();
  const priceIncludesTax = Boolean(profile?.tax?.priceIncludesTax);
  const taxType: "intra" | "inter" =
    payload.taxType === "inter" ? "inter" : "intra";

  const inputs: OfflinePriceLineInput[] = [];
  for (const l of payload.lines) {
    const product = localCatalog.productById(l.productId);
    if (!product) return null;
    const factor = unitFactor(product, l.unit);
    if (factor == null) return null;
    inputs.push({
      productName: product.name,
      sku: product.sku,
      hsnCode: product.hsnCode || "",
      mrp: round((product.mrp || 0) * factor),
      manufacturerName: product.manufacturerName || "",
      brandName: product.brandName || "",
      baseUnit: product.baseUnit,
      unit: l.unit || product.baseUnit,
      factor,
      quantity: l.quantity,
      unitPrice:
        typeof l.unitPrice === "number"
          ? l.unitPrice
          : round(product.sellingPrice * factor),
      discountAmount: l.discountAmount,
      discountPct: l.discountPct,
      taxRatePct:
        typeof l.taxRatePct === "number" ? l.taxRatePct : product.taxRatePct,
    });
  }

  const priced = priceSaleLocally(inputs, { priceIncludesTax, taxType });
  const customer = payload.customerId
    ? localCatalog.customerById(payload.customerId)
    : undefined;
  const prefix = profile?.tax?.invoicePrefix || "INV";

  const doc = {
    invoiceNo: displayNo ? `${prefix}-${displayNo}` : `${prefix}-PENDING`,
    saleDate: payload.saleDate || new Date().toISOString(),
    taxType,
    priceIncludesTax,
    customerName: customer?.name || payload.customerName || "Walk-in",
    customerMobile: customer?.mobile || payload.customerMobile || "",
    customerGstin: customer?.gstin || "",
    customerAddress: customer?.address || payload.customerAddress || "",
    doctorName: payload.doctorName || "",
    paymentMode: payload.paymentMode || "cash",
    createdByName: useAuthStore.getState().user?.fullName || "",
    ...priced,
  };
  // invoice.ts reads a subset of Sale; every field it touches is present.
  return doc as unknown as Sale;
}
