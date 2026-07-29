import { apiClient } from "@api/apiClient";
import type { Medicine, MedGuideMeta } from "@modules/medguide/types";

export const medguideApi = {
  search: async (params: {
    search?: string;
    page?: number;
    limit?: number;
  }) => {
    const res = await apiClient.get<{
      success: boolean;
      data: Medicine[];
      meta: MedGuideMeta;
    }>("/medguide", { params });
    return res.data;
  },
  get: async (id: string) => {
    const res = await apiClient.get<{ success: boolean; data: Medicine }>(
      `/medguide/${id}`,
    );
    return res.data.data;
  },

  /** Copy a catalogue medicine into this pharmacy's own product list. */
  addToStore: async (catalogProductId: string) => {
    const res = await apiClient.post<{
      success: boolean;
      data: { id: string; name: string };
    }>("/products/from-catalog", { catalogProductId });
    return res.data.data;
  },
};
