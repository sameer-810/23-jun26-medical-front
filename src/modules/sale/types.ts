export type SaleStatus = "completed" | "partially_returned" | "returned";

export interface SaleAllocation {
  batchNumber: string;
  locationCode: string;
  baseQty: number;
  returnedQty: number;
}

export interface SaleLine {
  id: string;
  productId: string;
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
  taxType?: "intra" | "inter";
  paymentMode?: "cash" | "card" | "upi" | "credit";
  notes?: string;
  lines: SaleLineInput[];
}

export interface CreateReturnPayload {
  saleId: string;
  reason?: string;
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
    gstin: string;
    /** Data URI of the owner signature / shop stamp, printed on the invoice. */
    signatureImage?: string;
    signatureLabel?: string;
  };
  tax: {
    defaultRatePct: number;
    invoicePrefix: string;
    priceIncludesTax?: boolean;
  };
  currency: string;
}

export interface Paginated<T> {
  success: boolean;
  data: T[];
  meta: { total: number; pages: number; page: number };
}
