export interface StockSummaryItem {
  productId: string;
  name: string;
  sku: string;
  barcode: string;
  baseUnit: string;
  reorderLevel: number;
  sellingPrice: number;
  isActive: boolean;
  onHand: number;
  reserved: number;
  available: number;
  costValue: number;
  /**
   * How many lots of this product hold stock with no purchase price recorded.
   *
   * `costValue` cannot distinguish "cost nothing" from "nobody entered a
   * cost" — both come back as 0. When this is above zero the row's cost is
   * incomplete and must not be rendered as a confident ₹0.
   */
  unpricedLots: number;
  sellValue: number;
  batches: number;
  locations: number;
  isLow: boolean;
}

export interface StockValue {
  costValue: number;
  sellValue: number;
  totalUnits: number;
  products: number;
  /** Lots holding stock with no purchase price — `costValue` is short by these. */
  missingCostLots?: number;
  /** Products holding stock with no selling price — `sellValue` is short by these. */
  missingPriceProducts?: number;
}

export interface BatchLocation {
  locationId: string;
  code: string;
  path: string;
  quantity: number;
}

export interface ProductBatchStock {
  batchId: string;
  batchNumber: string;
  mfgDate: string | null;
  expiryDate: string | null;
  purchasePrice: number;
  expired: boolean;
  onHand: number;
  locations: BatchLocation[];
}

export interface ProductInventory {
  product: {
    id: string;
    name: string;
    sku: string;
    baseUnit: string;
    sellingPrice: number;
    reorderLevel: number;
    prescriptionRequired: boolean;
    scheduleDrug: string;
  };
  summary: {
    onHand: number;
    available: number;
    stockValue: number;
    batches: number;
    locations: number;
  };
  batches: ProductBatchStock[];
}

export interface ReceiptLineInput {
  productId: string;
  batchNumber: string;
  mfgDate?: string;
  expiryDate?: string;
  purchasePrice?: number;
  mrp?: number;
  unit?: string;
  quantity: number;
  /** Scheme / free goods received on top of the paid quantity (same unit). */
  freeQuantity?: number;
  locationId: string;
  /**
   * The two columns every distributor invoice carries beside the rate. Stored
   * so a goods-received note can be reconciled against the paper it came from
   * — without them the GRN total can never match the bill's TOTAL AMT.
   */
  discountPct?: number;
  gstPct?: number;
}

/** The bits of a product the receive flow needs to display and do maths with. */
export interface ProductLite {
  id: string;
  name: string;
  sku: string;
  baseUnit: string;
  packs: { unit: string; factor: number }[];
}

/** One in-progress goods-received line as held by the form. */
/**
 * What the bill printed for this line, kept even when nothing matched.
 *
 * Without it an unmatched row can only say "Choose a product" next to a batch
 * number — useless unless the paper bill is still in your hand. It's also
 * exactly what's needed to create the product, so it's evidence, not clutter.
 */
export interface BillHint {
  productName: string | null;
  pack: string | null;
  hsn: string | null;
  mrp: number | null;
  gstPct: number | null;
}

export interface DraftLine {
  productId: string | null;
  batchNumber: string;
  mfgDate: string;
  expiryDate: string;
  unit: string | null;
  quantity: string;
  /** Free/scheme units (e.g. 10+1) — booked to stock, lower the landed cost. */
  freeQuantity: string;
  purchasePrice: string;
  /** Selling MRP for this lot — prints on the shelf label and prices the sale. */
  mrp: string;
  /** DIS% / TD% / CD% — every distributor invoice prints one of these. */
  discountPct: string;
  /** GST% for the line. Split into CGST+SGST or charged as IGST at the foot. */
  gstPct: string;
  locationId: string | null;
  /** Came from a scanned bill and needs a human look before saving. */
  flagged?: boolean;
  /** What the bill said, for identifying and creating an unmatched product. */
  fromBill?: BillHint;
}

export interface ReceivePayload {
  supplierId?: string | null;
  supplierName?: string;
  referenceNo?: string;
  notes?: string;
  receivedAt?: string;
  /** Intra-state splits GST into CGST+SGST; inter-state charges IGST. */
  taxType?: "intra" | "inter";
  /**
   * How the bill was settled. Anything but "credit" books the receipt as paid in
   * full; "credit" puts it on the supplier's payable. The server defaults to
   * cash when this is omitted, so a credit bill must send it explicitly.
   */
  paymentMode?: "cash" | "card" | "upi" | "credit";
  /** Paid up front on a credit bill. Clamped server-side to the bill total. */
  amountPaid?: number;
  lines: ReceiptLineInput[];
}

export interface ReceiptListItem {
  id: string;
  receiptNo: string;
  supplierName: string;
  referenceNo: string;
  receivedAt: string;
  receivedByName: string;
  totalQuantity: number;
  totalValue: number;
  /** A voided GRN had its stock and batch costs reversed; it counts towards
   *  nothing, but stays in the history. */
  status: "active" | "void";
  lineCount: number;
  createdAt: string;
}

export interface ReceiptDetail extends ReceiptListItem {
  notes: string;
  voidedAt: string | null;
  voidedByName: string;
  voidReason: string;
  /** The foot of the supplier's bill, stored so the note can be reconciled. */
  taxType: "intra" | "inter";
  totalDiscount: number;
  totalTaxable: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalGst: number;
  grandTotal: number;
  roundOff: number;
  netPayable: number;
  lines: {
    productId: string;
    productName: string;
    sku: string;
    batchId: string | null;
    batchNumber: string;
    locationId: string | null;
    labelCode: string | null;
    mfgDate: string | null;
    expiryDate: string | null;
    purchasePrice: number;
    /** PER BASE UNIT, like `purchasePrice` — not the price on the pack. */
    mrp: number;
    unit: string;
    /** Paid quantity, in `unit` — i.e. a count of PACKS, not base units. */
    quantity: number;
    /** Total received in base units, free goods included. */
    baseQuantity: number;
    /** Scheme goods, in `unit`. Already counted inside `baseQuantity`. */
    freeQuantity: number;
    freeBaseQuantity: number;
    locationCode: string;
    lineValue: number;
    discountPct: number;
    discountAmount: number;
    gstPct: number;
    taxableValue: number;
    gstAmount: number;
  }[];
}

export interface PurchaseReturnPayload {
  receiptId?: string;
  supplierId?: string | null;
  supplierName?: string;
  reason?: string;
  lines: {
    productId: string;
    /**
     * Required here and on the server: a return decrements one exact
     * (product, batch, location) stock cell, and a missing key would match an
     * arbitrary cell of that product instead.
     */
    batchId: string;
    batchNumber?: string;
    locationId: string;
    locationCode?: string;
    baseQuantity: number;
    // No purchasePrice: this value credits the supplier's payable, so the server
    // prices the return from the batch's own cost.
  }[];
}

export interface SearchBatchResult {
  batchId: string;
  productId: string;
  productName: string;
  sku: string;
  baseUnit: string;
  batchNumber: string;
  mfgDate: string | null;
  expiryDate: string | null;
  onHand: number;
  locations: { code: string; path: string; quantity: number }[];
}

export interface SearchResult {
  products: StockSummaryItem[];
  batches: SearchBatchResult[];
}

/** Minimal product shape the scan resolver returns (a full product DTO). */
export interface ScanProduct {
  id: string;
  name: string;
  sku: string;
  baseUnit: string;
  sellingPrice: number;
  mrp: number;
  taxRatePct: number;
  saltComposition?: string;
  packs: { unit: string; factor: number }[];
  prescriptionRequired?: boolean;
  scheduleDrug?: string;
}

/** What a scanned shelf-label or product barcode resolves to at the till. */
export interface ScanResult {
  kind: "batch" | "product";
  product: ScanProduct | null;
  available: number;
  /** Present when a shelf label (specific lot) was scanned. */
  batch?: {
    id: string;
    batchNumber: string;
    mfgDate: string | null;
    expiryDate: string | null;
    mrp: number;
    purchasePrice: number;
    labelCode: string;
    expired: boolean;
  };
  /** Present when a product barcode was scanned — its lots, FEFO order. */
  batches?: {
    batchId: string;
    batchNumber: string;
    expiryDate: string | null;
    mrp: number;
    available: number;
  }[];
}

export interface Paginated<T> {
  success: boolean;
  data: T[];
  meta: { total: number; pages: number; page: number };
}

/* ---------------- Medicine ledger + ShortBook ---------------- */

export interface LedgerRow {
  id: string;
  date: string;
  type: string;
  in: number;
  out: number;
  balance: number;
  batchNumber: string;
  party: string;
}

export interface LedgerProduct {
  id: string;
  name: string;
  sku: string;
  saltComposition: string;
  brandName: string;
  baseUnit: string;
  reorderLevel: number;
  hsnCode: string;
  taxRatePct: number;
  mrp: number;
}

export interface ProductLedgerResult {
  success: boolean;
  data: { product: LedgerProduct; currentStock: number; rows: LedgerRow[] };
  meta: { total: number; pages: number; page: number };
}

export interface ShortbookItem {
  productId: string;
  name: string;
  sku: string;
  brandName: string;
  baseUnit: string;
  reorderLevel: number;
  onHand: number;
  /** Gap back to the reorder level (min-fill quantity). */
  need: number;
  /** Net units sold in the last 30 days. */
  sold30: number;
  /** Average units sold per day over that window. */
  dailyVelocity: number;
  /** How many days current stock lasts at that velocity (null = no sales). */
  daysCover: number | null;
  /** Computed reorder qty — covers a month of demand, never below `need`. */
  suggested: number;
}

export interface AlternativeItem {
  productId: string;
  name: string;
  sku: string;
  saltComposition: string;
  brandName: string;
  baseUnit: string;
  mrp: number;
  sellingPrice: number;
  available: number;
  nearestExpiry: string | null;
  margin: number;
}

export interface AlternativesResult {
  molecule: string;
  items: AlternativeItem[];
}

/* ---------------- Bill scan (OCR) ---------------- */

/** One extracted value plus how much we trust it. */
export interface OcrField<T = string | number | null> {
  value: T;
  /** "high" = the value passed the rule checks; "low" = a rule flagged it. */
  confidence: "high" | "low";
  /** A rival reading to suggest, when we have one. */
  alternative: T | null;
  reason: string | null;
}

export interface OcrProductRef {
  id: string;
  name: string;
  sku: string;
  baseUnit: string;
  packs: { unit: string; factor: number }[];
  mrp: number;
  taxRatePct: number;
  score?: number;
}

/** How the bill's QTY unit maps onto the product's own units. */
export interface UnitResolution {
  /** false = we could not prove the unit; the pharmacist must pick it. */
  resolved: boolean;
  unit: string | null;
  factor: number | null;
  /** Why it couldn't be resolved (blocks the line). */
  reason: string | null;
  /** Advisory — resolved, but worth a second look (doesn't block). */
  note: string | null;
}

export interface ScannedLine {
  productName: string | null;
  pack: string | null;
  hsn: string | null;
  batchNo: string | null;
  expiry: string | null;
  expiryDate: string | null;
  quantity: number | null;
  mrp: number | null;
  rate: number | null;
  /** DIS% / TD% / CD% off the bill. */
  discountPct: number | null;
  gstPct: number | null;
  /** The bill's QTY counts PACKS — this says which pack unit that is. */
  unitResolution: UnitResolution;
  /** Bill RATE is per pack; this is the per-base-unit cost (null if unresolved). */
  costPerBaseUnit: number | null;
  /** Free goods on the bill — physically arrive, so the human decides. */
  freeQty: number;
  fields: {
    batchNo: OcrField<string | null>;
    expiry: OcrField<string | null>;
    quantity: OcrField<number | null>;
    mrp: OcrField<number | null>;
    rate: OcrField<number | null>;
    gstPct: OcrField<number | null>;
    pack: OcrField<string | null>;
  };
  /** Catalogue link — null when we couldn't match confidently. */
  match: OcrProductRef | null;
  matchScore: number;
  suggestions: OcrProductRef[];
  needsReview: boolean;
  criticalIssues: string[];
  lowFields: string[];
  missing: string[];
}

export interface ScannedBill {
  supplierName: string | null;
  /** Existing supplier this bill confidently came from, if any. */
  supplierMatch: { id: string; name: string; score: number } | null;
  invoiceNo: string | null;
  invoiceDate: string | null;
  rotation: number;
  /** Set when this invoice number was already received — re-saving doubles stock. */
  duplicate: {
    receiptNo: string;
    referenceNo: string;
    receivedAt: string;
    supplierName: string;
  } | null;
  lines: ScannedLine[];
  stats: {
    total: number;
    matched: number;
    needsReview: number;
    confident: number;
    readScore: number;
  };
}

/** What the camera made out on a pack — before anything is matched to stock. */
export interface PackTextRead {
  batchNumber: string | null;
  expiryDate: string | null;
  mfgDate: string | null;
  mrp: number | null;
  productName: string | null;
}

/** One resolved lot, same shape the barcode/label scan returns. */
export interface PackBatchMatch {
  kind: "batch";
  product: { id: string; name: string; sku: string; baseUnit: string } | null;
  batch: {
    id: string;
    batchNumber: string;
    mfgDate: string | null;
    expiryDate: string | null;
    mrp: number;
    labelCode?: string;
    expired: boolean;
  };
  available: number;
}

export interface PackRead {
  read: PackTextRead;
  /** Set only when the batch number matched a lot exactly. */
  match: PackBatchMatch | null;
  /** Near-matches to confirm when OCR misread a character. */
  candidates: PackBatchMatch[];
  message: string | null;
}
