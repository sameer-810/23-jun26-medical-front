import { apiClient } from "@api/apiClient";

export interface ReconciliationTask {
  id: string;
  type: "oversell";
  status: "open" | "resolved";
  productName: string;
  sku: string;
  batchNumber: string;
  qtyShort: number;
  invoiceNo: string;
  deviceId: string;
  note: string;
  resolvedByName: string;
  createdAt: string;
}

export const reconciliationApi = {
  list: async (params?: {
    status?: "open" | "resolved";
    page?: number;
    limit?: number;
  }) => {
    const res = await apiClient.get<{
      success: boolean;
      data: ReconciliationTask[];
      meta: { total: number; pages: number; page: number };
    }>("/reconciliation", { params });
    return res.data;
  },
  resolve: async (id: string, note?: string) => {
    const res = await apiClient.patch<{
      success: boolean;
      data: { id: string; status: string };
    }>(`/reconciliation/${id}/resolve`, { note });
    return res.data.data;
  },
};
