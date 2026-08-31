export type SaleStatus = "completed" | "partially_returned" | "returned";

export interface SaleAllocation {
  batchId: string | null;
  batchNumber: string;
  locationId: string | null;
  locationCode: string;
  expiryDate?: string | null;
  baseQty: number;
  returnedQty: number;
}

/** An invoice that sold from a scanned lot, with the lines that came from it. */
export interface ScanReturnMatch extends SaleListItem {
  matchedLineIds: string[];
}

export interface SaleLine {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  hsnCode: string;
  /** Bill snapshots (absent on sales written before they existed). */
  mrp?: number;
  manufacturerName?: string;
  brandName?: string;
  baseUnit?: string;
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
  returnedBaseQty: number;
  allocations: SaleAllocation[];
}

export interface ReturnLine {
  productName: string;
  sku: string;
  baseQty: number;
  refundTaxable: number;
  refundTax: number;
  refundTotal: number;
}

export interface ReturnDoc {
  id: string;
  returnNo: string;
  saleId: string;
  invoiceNo: string;
  customerName: string;
  reason: string;
  lines: ReturnLine[];
  totalRefundTaxable: number;
  totalRefundTax: number;
  totalRefund: number;
  createdByName: string;
  createdAt: string;
}

export interface Sale {
  id: string;
  invoiceNo: string;
  customerId: string | null;
  customerName: string;
  customerMobile: string;
  customerGstin: string;
  customerAddress?: string;
  doctorName?: string;
  prescriptionId?: string | null;
  saleDate: string;
  taxType: "intra" | "inter";
  priceIncludesTax: boolean;
  status: SaleStatus;
  paymentMode: string;
  notes: string;
  lines: SaleLine[];
  subtotal: number;
  totalDiscount: number;
  totalTaxable: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalTax: number;
  roundOff: number;
  grandTotal: number;
  totalReturned: number;
  createdByName: string;
  createdAt: string;
  returns?: ReturnDoc[];
}

export interface SaleListItem {
  id: string;
  invoiceNo: string;
  customerName: string;
  customerMobile: string;
  saleDate: string;
  status: SaleStatus;
  itemCount: number;
  grandTotal: number;
  totalReturned: number;
  paymentMode: string;
  createdAt: string;
}

export interface SaleLineInput {
  productId: string;
  /** Set when the line came from a scanned label — sell that exact lot. */
  batchId?: string;
  unit?: string;
  quantity: number;
  unitPrice?: number;
  discountAmount?: number;
  discountPct?: number;
  taxRatePct?: number;
}

export interface CreateSalePayload {
  customerId?: string | null;
  customerName?: string;
  customerMobile?: string;
  customerAddress?: string;
  /** "Doct:" on the bill; the Schedule H register's prescriber. */
  doctorName?: string;
  prescriptionId?: string | null;
  taxType?: "intra" | "inter";
  paymentMode?: "cash" | "card" | "upi" | "credit";
  notes?: string;
  /** Idempotency key stamped by the client — a replayed request (outbox
   *  drain, network retry) returns the original sale instead of re-selling. */
  clientOpId?: string;
  /** With invoiceSeq: this device printed the bill from its own registered
   *  invoice series while offline. Both or neither. */
  deviceId?: string;
  invoiceSeq?: number;
  /** Marks a bill replayed from the outbox: the server records a shortfall
   *  as negative stock + a recount task instead of rejecting the sale. */
  offlineCapture?: boolean;
  /** The sale's real moment — a bill queued during an outage keeps the time
   *  it was made at the counter, not the time the queue drained. */
  saleDate?: string;
  lines: SaleLineInput[];
}

/** What useCreateSale returns when the bill was captured offline. */
export interface QueuedSaleResult {
  queued: true;
  opId: string;
  /** "T1-0007", or null when this device has no registered series yet. */
  displayNo: string | null;
  /** Locally-priced document for provisional printing; null when the
   *  offline catalogue couldn't resolve every line. */
  printableSale: Sale | null;
}

export interface CreateReturnPayload {
  saleId: string;
  reason?: string;
  clientOpId?: string;
  lines: { lineId: string; baseQty: number }[];
}

export interface InvoiceProfile {
  company: {
    legalName: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    state: string;
    pincode: string;
    phone: string;
    email: string;
    drugLicenseNo: string;
    drugLicenseNo2?: string;
    gstin: string;
    jurisdiction?: string;
    pharmacistName?: string;
    mobile?: string;
    /** Data URI of the owner signature / shop stamp, printed on the invoice. */
    signatureImage?: string;
    signatureLabel?: string;
  };
  tax: {
    defaultRatePct: number;
    invoicePrefix: string;
    priceIncludesTax?: boolean;
  };
  print?: PrintSettings;
  rx?: { enforce: boolean; validityMonths: number };
  currency: string;
}

export interface PrintSettings {
  /** Legal document type — a fact about the GST registration, not a look. */
  documentType: "tax_invoice" | "bill_of_supply";
  /** A4 page, or 80-column text for a dot-matrix printer. */
  layout: "a4" | "text80";
  copies: "single" | "duplicate";
  guideOnBill: boolean;
}

export interface Paginated<T> {
  success: boolean;
  data: T[];
  meta: { total: number; pages: number; page: number };
}
