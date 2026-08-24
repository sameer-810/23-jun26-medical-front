/**
 * Local answers in server response shapes.
 *
 * The api layer calls `withLocalFallback(serverCall, localAnswer)`: online it
 * is a pass-through; when the wire is down (or dies mid-request) the answer
 * comes from the local catalog in EXACTLY the shape the server would have
 * sent — so every screen already consuming these endpoints works offline
 * with zero screen changes. The catalog must be hydrated, else the original
 * network error propagates (a device that never synced has nothing to say).
 */
import { useOfflineStore } from "./useOfflineStore";
import { useAuthStore } from "../store/useAuthStore";
import { isNetworkError } from "./outboxEngine";
import { isExpiredLot } from "../format";
import {
  localCatalog,
  LocalProduct,
  LocalBatch,
  LocalCustomer,
} from "./localCatalog";

async function catalogReady(): Promise<boolean> {
  if (localCatalog.ready) return true;
  // Race guard: a query can land before the engine's hydrate finished
  // (or before it ran at all on an odd boot order).
  const orgId = useAuthStore.getState().user?.organizationId;
  if (!orgId) return false;
  await localCatalog.hydrate(orgId);
  return localCatalog.ready;
}

export async function withLocalFallback<T>(
  serverCall: () => Promise<T>,
  localAnswer: () => T,
): Promise<T> {
  if (!useOfflineStore.getState().online && (await catalogReady())) {
    return localAnswer();
  }
  try {
    return await serverCall();
  } catch (err) {
    if (isNetworkError(err) && (await catalogReady())) return localAnswer();
    throw err;
  }
}

// The server's rule, not a second one — see isExpiredLot. Comparing against
// the current instant refused a lot that expires today, which the server
// happily sells.
const isExpired = (b: LocalBatch) => isExpiredLot(b.expiryDate);

// ---- Shape builders ------------------------------------------------------

/** ProductListItem — what GET /products rows look like. */
export function toProductListItem(p: LocalProduct) {
  return {
    id: p._id,
    name: p.name,
    sku: p.sku,
    barcode: p.barcode ?? null,
    saltComposition: p.saltComposition || "",
    categoryName: p.categoryName || "",
    brandName: p.brandName || "",
    baseUnit: p.baseUnit,
    packs: p.packs || [],
    sellingPrice: p.sellingPrice,
    mrp: p.mrp,
    taxRatePct: p.taxRatePct,
    reorderLevel: p.reorderLevel ?? 0,
    prescriptionRequired: Boolean(p.prescriptionRequired),
    scheduleDrug: (p.scheduleDrug || "") as never,
    isActive: p.isActive,
    createdAt: "",
  };
}

export function localProductList(params?: { search?: string; limit?: number }) {
  const limit = params?.limit ?? 50;
  const rows = params?.search
    ? localCatalog.searchProducts(params.search, limit)
    : localCatalog.browseProducts(limit);
  return {
    success: true,
    data: rows.map(toProductListItem),
    meta: { total: rows.length, pages: 1, page: 1 },
  };
}

/** ScanResult — what GET /inventory/scan/:code answers. */
export function localScan(code: string) {
  const toScanProduct = (p: LocalProduct) => ({
    id: p._id,
    name: p.name,
    sku: p.sku,
    baseUnit: p.baseUnit,
    sellingPrice: p.sellingPrice,
    mrp: p.mrp,
    taxRatePct: p.taxRatePct,
    saltComposition: p.saltComposition || "",
    packs: p.packs || [],
    prescriptionRequired: Boolean(p.prescriptionRequired),
    scheduleDrug: (p.scheduleDrug || "") as never,
  });

  const batch =
    localCatalog.findBatchByLabelCode(code) ??
    localCatalog.findBatchByNumber(code);
  if (batch) {
    const product = localCatalog.productById(String(batch.productId));
    if (!product) throw new Error("Scanned lot's product is not synced yet");
    return {
      kind: "batch" as const,
      product: toScanProduct(product),
      available: localCatalog.availableForBatch(batch._id),
      batch: {
        id: batch._id,
        batchNumber: batch.batchNumber,
        mfgDate: batch.mfgDate ?? null,
        expiryDate: batch.expiryDate ?? null,
        mrp: batch.mrp ?? 0,
        purchasePrice: batch.purchasePrice ?? 0,
        labelCode: batch.labelCode ?? null,
        expired: isExpired(batch),
      },
    };
  }

  const product = localCatalog.productByBarcode(code);
  if (product) {
    return {
      kind: "product" as const,
      product: toScanProduct(product),
      available: localCatalog.availableForProduct(product._id),
      batches: localCatalog.fefoCandidates(product._id).map((c) => ({
        batchId: c.batch._id,
        batchNumber: c.batch.batchNumber,
        expiryDate: c.batch.expiryDate ?? null,
        mrp: c.batch.mrp ?? 0,
        available: c.available,
      })),
    };
  }

  throw new Error("Nothing in the offline catalogue matches that code");
}

/** ProductInventory — what GET /inventory/products/:id answers. The sale
 *  screen reads only summary.available; the rest is best-effort so the
 *  inventory detail screen stays usable offline. */
export function localProductInventory(productId: string) {
  const p = localCatalog.productById(productId);
  if (!p) throw new Error("Product not in the offline catalogue yet");
  const lots = localCatalog.batchesWithStock(productId);
  const onHand = lots.reduce((t, l) => t + l.onHand, 0);
  const locations = new Set<string>();
  return {
    product: toProductListItem(p),
    summary: {
      onHand,
      available: localCatalog.availableForProduct(productId),
      stockValue: lots.reduce(
        (t, l) => t + l.onHand * (l.batch.purchasePrice || 0),
        0,
      ),
      batches: lots.length,
      locations: locations.size,
    },
    batches: lots
      .map((l) => ({
        batchId: l.batch._id,
        batchNumber: l.batch.batchNumber,
        mfgDate: l.batch.mfgDate ?? null,
        expiryDate: l.batch.expiryDate ?? null,
        purchasePrice: l.batch.purchasePrice ?? 0,
        expired: isExpired(l.batch),
        onHand: l.onHand,
        locations: [],
      }))
      .sort((a, b) => {
        const ea = a.expiryDate ? new Date(a.expiryDate).getTime() : Infinity;
        const eb = b.expiryDate ? new Date(b.expiryDate).getTime() : Infinity;
        return ea - eb;
      }),
  };
}

/** Paginated<Customer> — what GET /customers answers. */
export function localCustomerList(params?: {
  search?: string;
  limit?: number;
}) {
  const toCustomer = (c: LocalCustomer) => ({
    id: c._id,
    name: c.name,
    mobile: c.mobile ?? null,
    email: c.email || "",
    address: c.address || "",
    gstin: c.gstin || "",
    isActive: c.isActive !== false,
    createdAt: "",
  });
  const rows = localCatalog.searchCustomers(
    params?.search || "",
    params?.limit ?? 20,
  );
  return {
    success: true,
    data: rows.map(toCustomer),
    meta: { total: rows.length, pages: 1, page: 1 },
  };
}
