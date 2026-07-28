import { apiClient } from "@api/apiClient";
import type {
  PurchaseOrder,
  CreateOrderInput,
  OrderListMeta,
  PoStatus,
} from "@modules/purchaseOrder/types";

export const purchaseOrderApi = {
  list: async (params?: {
    status?: PoStatus;
    page?: number;
    limit?: number;
  }) => {
    const res = await apiClient.get<{
      success: boolean;
      data: PurchaseOrder[];
      meta: OrderListMeta;
    }>("/purchase-orders", { params });
    return res.data;
  },

  get: async (id: string) => {
    const res = await apiClient.get<{ success: boolean; data: PurchaseOrder }>(
      `/purchase-orders/${id}`,
    );
    return res.data.data;
  },

  create: async (payload: CreateOrderInput) => {
    const res = await apiClient.post<{ success: boolean; data: PurchaseOrder }>(
      "/purchase-orders",
      payload,
    );
    return res.data.data;
  },

  setStatus: async (
    id: string,
    status: "placed" | "received" | "cancelled",
  ) => {
    const res = await apiClient.post<{ success: boolean; data: PurchaseOrder }>(
      `/purchase-orders/${id}/status`,
      { status },
    );
    return res.data.data;
  },
};
