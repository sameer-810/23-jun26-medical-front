import { apiClient } from "@api/apiClient";
import {
  StockSummaryItem,
  StockValue,
  ProductInventory,
  ReceivePayload,
  ReceiptDetail,
  ReceiptListItem,
  SearchResult,
  ScanResult,
  Paginated,
  ProductLedgerResult,
  ShortbookItem,
  AlternativesResult,
  PurchaseReturnPayload,
} from "@modules/inventory/types";

export const inventoryApi = {
  stock: async (params?: {
    search?: string;
    lowStockOnly?: boolean;
    page?: number;
    limit?: number;
  }) => {
    const res = await apiClient.get<Paginated<StockSummaryItem>>(
      "/inventory/stock",
      { params },
    );
    return res.data;
  },
  value: async () => {
    const res = await apiClient.get<{ success: boolean; data: StockValue }>(
      "/inventory/value",
    );
    return res.data.data;
  },
  productInventory: async (productId: string) => {
    const res = await apiClient.get<{
      success: boolean;
      data: ProductInventory;
    }>(`/inventory/products/${productId}`);
    return res.data.data;
  },
  search: async (params: { q?: string; expiringInDays?: number }) => {
    const res = await apiClient.get<{ success: boolean; data: SearchResult }>(
      "/inventory/search",
      {
        params,
      },
    );
    return res.data.data;
  },
  /** Resolve a scanned shelf-label or product barcode to a sellable lot. */
  scan: async (code: string): Promise<ScanResult> => {
    const res = await apiClient.get<{ success: boolean; data: ScanResult }>(
      `/inventory/scan/${encodeURIComponent(code)}`,
    );
    return res.data.data;
  },

  receive: async (payload: ReceivePayload) => {
    const res = await apiClient.post<{ success: boolean; data: ReceiptDetail }>(
      "/inventory/receipts",
      payload,
    );
    return res.data.data;
  },
  receipts: async (params?: {
    search?: string;
    page?: number;
    limit?: number;
  }) => {
    const res = await apiClient.get<Paginated<ReceiptListItem>>(
      "/inventory/receipts",
      { params },
    );
    return res.data;
  },
  receipt: async (id: string) => {
    const res = await apiClient.get<{ success: boolean; data: ReceiptDetail }>(
      `/inventory/receipts/${id}`,
    );
    return res.data.data;
  },

  /** Medicine ledger — running-balance transaction history for a product. */
  productLedger: async (
    id: string,
    params?: { page?: number; limit?: number },
  ) => {
    const res = await apiClient.get<ProductLedgerResult>(
      `/inventory/products/${id}/ledger`,
      { params },
    );
    return res.data;
  },

  /** ShortBook — low-stock reorder worklist. */
  shortbook: async (params?: {
    search?: string;
    page?: number;
    limit?: number;
  }) => {
    const res = await apiClient.get<Paginated<ShortbookItem>>(
      "/inventory/shortbook",
      { params },
    );
    return res.data;
  },

  /**
   * Put a medicine on the ShortBook — including one this pharmacy has never
   * stocked, straight from the global catalogue. Creates the product if needed
   * and records how many to keep on the shelf.
   */
  addToShortbook: async (body: {
    productId?: string;
    catalogProductId?: string;
    quantity?: number;
  }) => {
    const res = await apiClient.post<{
      success: boolean;
      data: {
        product: { id: string; name: string; sku: string };
        created: boolean;
        reorderLevel: number;
        onHand: number;
        need: number;
      };
    }>("/inventory/shortbook", body);
    return res.data.data;
  },

  /** Alternative medicines (same molecule, in stock). */
  alternatives: async (
    productId: string,
    sort?: "expiry" | "price" | "margin",
  ) => {
    const res = await apiClient.get<{
      success: boolean;
      data: AlternativesResult;
    }>(`/inventory/products/${productId}/alternatives`, { params: { sort } });
    return res.data.data;
  },

  /** Record a purchase return (goods sent back to a supplier). */
  purchaseReturn: async (payload: PurchaseReturnPayload) => {
    const res = await apiClient.post<{
      success: boolean;
      data: { _id: string; returnNo: string };
    }>("/purchase-returns", payload);
    return res.data.data;
  },
};
