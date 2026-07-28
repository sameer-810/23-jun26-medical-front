import { apiClient } from "@api/apiClient";
import { Customer, CustomerPayload, Paginated } from "@modules/customer/types";

export interface StatementRow {
  date: string;
  type: string;
  ref: string;
  debit: number;
  credit: number;
  balance: number;
  note: string;
}

export interface CustomerStatement {
  success: boolean;
  data: { customer: Customer; outstanding: number; rows: StatementRow[] };
  meta: { total: number; pages: number; page: number };
}

export interface OutstandingResult {
  totalOutstanding: number;
  customers: {
    customerId: string;
    customerName: string;
    outstanding: number;
  }[];
}

export const customerApi = {
  list: async (params?: { search?: string; page?: number; limit?: number }) => {
    const res = await apiClient.get<Paginated<Customer>>("/customers", {
      params,
    });
    return res.data;
  },
  get: async (id: string) => {
    const res = await apiClient.get<{ success: boolean; data: Customer }>(
      `/customers/${id}`,
    );
    return res.data.data;
  },
  create: async (payload: CustomerPayload) => {
    const res = await apiClient.post<{ success: boolean; data: Customer }>(
      "/customers",
      payload,
    );
    return res.data.data;
  },
  update: async (
    id: string,
    payload: Partial<CustomerPayload> & { isActive?: boolean },
  ) => {
    const res = await apiClient.patch<{ success: boolean; data: Customer }>(
      `/customers/${id}`,
      payload,
    );
    return res.data.data;
  },
  remove: async (id: string) => {
    const res = await apiClient.delete(`/customers/${id}`);
    return res.data;
  },

  /** Customer account statement — credit invoices + payments + running balance. */
  statement: async (id: string, params?: { page?: number; limit?: number }) => {
    const res = await apiClient.get<CustomerStatement>(
      `/customers/${id}/statement`,
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
    }>(`/customers/${id}/payments`, body);
    return res.data.data;
  },

  outstanding: async () => {
    const res = await apiClient.get<{
      success: boolean;
      data: OutstandingResult;
    }>("/customers/outstanding");
    return res.data.data;
  },
};
