import { apiClient } from "@api/apiClient";
import {
  Supplier,
  SupplierPayload,
  SupplierPurchase,
  Paginated,
} from "@modules/supplier/types";

export interface SupplierStatementRow {
  date: string;
  type: string;
  ref: string;
  debit: number;
  credit: number;
  balance: number;
  note: string;
}

export interface SupplierStatement {
  success: boolean;
  data: {
    supplier: Supplier;
    outstanding: number;
    rows: SupplierStatementRow[];
  };
  meta: { total: number; pages: number; page: number };
}

export interface SupplierOutstanding {
  totalOutstanding: number;
  suppliers: {
    supplierId: string;
    supplierName: string;
    outstanding: number;
  }[];
}

export const supplierApi = {
  list: async (params?: { search?: string; page?: number; limit?: number }) => {
    const res = await apiClient.get<Paginated<Supplier>>("/suppliers", {
      params,
    });
    return res.data;
  },
  get: async (id: string) => {
    const res = await apiClient.get<{ success: boolean; data: Supplier }>(
      `/suppliers/${id}`,
    );
    return res.data.data;
  },
  purchases: async (id: string) => {
    const res = await apiClient.get<{
      success: boolean;
      data: SupplierPurchase[];
    }>(`/suppliers/${id}/purchases`);
    return res.data.data;
  },
  create: async (payload: SupplierPayload) => {
    const res = await apiClient.post<{ success: boolean; data: Supplier }>(
      "/suppliers",
      payload,
    );
    return res.data.data;
  },
  update: async (
    id: string,
    payload: Partial<SupplierPayload> & { isActive?: boolean },
  ) => {
    const res = await apiClient.patch<{ success: boolean; data: Supplier }>(
      `/suppliers/${id}`,
      payload,
    );
    return res.data.data;
  },
  remove: async (id: string) => {
    const res = await apiClient.delete(`/suppliers/${id}`);
    return res.data;
  },

  /** Supplier account statement — credit purchases + payments + running balance. */
  statement: async (id: string, params?: { page?: number; limit?: number }) => {
    const res = await apiClient.get<SupplierStatement>(
      `/suppliers/${id}/statement`,
      { params },
    );
    return res.data;
  },

  recordPayment: async (
    id: string,
    body: { amount: number; mode?: string; note?: string },
  ) => {
    const res = await apiClient.post<{
      success: boolean;
      data: { id: string; amount: number };
    }>(`/suppliers/${id}/payments`, body);
    return res.data.data;
  },

  outstanding: async () => {
    const res = await apiClient.get<{
      success: boolean;
      data: SupplierOutstanding;
    }>("/suppliers/outstanding");
    return res.data.data;
  },
};
