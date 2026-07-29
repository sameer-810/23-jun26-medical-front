import { apiClient } from "@api/apiClient";
import {
  Cheque,
  ChequePayload,
  ChequeStatus,
  UpcomingPdc,
  Paginated,
} from "@modules/cheque/types";

export const chequeApi = {
  list: async (params?: {
    page?: number;
    limit?: number;
    direction?: string;
    status?: string;
  }) => {
    const res = await apiClient.get<Paginated<Cheque>>("/cheques", { params });
    return res.data;
  },
  upcoming: async () => {
    const res = await apiClient.get<{ success: boolean; data: UpcomingPdc }>(
      "/cheques/upcoming",
    );
    return res.data.data;
  },
  create: async (payload: ChequePayload) => {
    const res = await apiClient.post<{ success: boolean; data: Cheque }>(
      "/cheques",
      payload,
    );
    return res.data.data;
  },
  setStatus: async (id: string, status: ChequeStatus) => {
    const res = await apiClient.patch<{ success: boolean; data: Cheque }>(
      `/cheques/${id}/status`,
      { status },
    );
    return res.data.data;
  },
  remove: async (id: string) => {
    const res = await apiClient.delete(`/cheques/${id}`);
    return res.data;
  },
};
