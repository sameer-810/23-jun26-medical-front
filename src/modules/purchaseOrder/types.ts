export type PoStatus = "draft" | "placed" | "received" | "cancelled";

export interface OrderLine {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  estimatedPrice: number;
  note?: string;
}

export interface PurchaseOrder {
  _id: string;
  orderNo: string;
  supplierId: string | null;
  supplierName: string;
  status: PoStatus;
  lines: OrderLine[];
  totalQuantity: number;
  estimatedValue: number;
  note: string;
  expectedDate: string | null;
  placedAt: string | null;
  receivedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
}

export interface CreateOrderInput {
  supplierId?: string | null;
  supplierName?: string;
  status?: "draft" | "placed";
  note?: string;
  lines: {
    productId: string;
    quantity: number;
    estimatedPrice?: number;
  }[];
}

export interface OrderListMeta {
  total: number;
  pages: number;
  page: number;
}

/** Lines handed to the order form (e.g. seeded from ShortBook). */
export interface SeededLine {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
}
