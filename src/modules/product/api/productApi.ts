import { apiClient } from "@api/apiClient";
import {
  Product,
  ProductListItem,
  ProductPayload,
  Category,
  Brand,
  Paginated,
  MedicineGuide,
  ProductGuide,
} from "@modules/product/types";
import {
  withLocalFallback,
  localProductList,
} from "@shared/offline/offlineFallbacks";

export const productApi = {
  list: async (params?: {
    search?: string;
    categoryId?: string;
    brandId?: string;
    page?: number;
    limit?: number;
  }) =>
    // Offline, the local mirror answers (name/SKU/barcode/salt search) so the
    // till keeps finding medicines with no server.
    withLocalFallback(
      async () => {
        const res = await apiClient.get<Paginated<ProductListItem>>(
          "/products",
          { params },
        );
        return res.data;
      },
      () => localProductList(params) as Paginated<ProductListItem>,
    ),
  get: async (id: string) => {
    const res = await apiClient.get<{ success: boolean; data: Product }>(
      `/products/${id}`,
    );
    return res.data.data;
  },
  /** The customer-facing Medicine Guide for one product. */
  guide: async (id: string) => {
    const res = await apiClient.get<{ success: boolean; data: ProductGuide }>(
      `/products/${id}/guide`,
    );
    return res.data.data;
  },
  /** Guides for the products on one bill, keyed by product id. */
  guides: async (ids: string[]) => {
    if (!ids.length) return {} as Record<string, MedicineGuide>;
    const res = await apiClient.get<{
      success: boolean;
      data: Record<string, MedicineGuide>;
    }>("/products/guides", { params: { ids: ids.join(",") } });
    return res.data.data;
  },
  create: async (payload: ProductPayload) => {
    const res = await apiClient.post<{ success: boolean; data: Product }>(
      "/products",
      payload,
    );
    return res.data.data;
  },
  update: async (id: string, payload: ProductPayload) => {
    const res = await apiClient.patch<{ success: boolean; data: Product }>(
      `/products/${id}`,
      payload,
    );
    return res.data.data;
  },
  /**
   * Take a product off the reorder list.
   *
   * A reorder level of zero is what "low stock" is measured against, so
   * clearing it removes the product from that list without touching its stock,
   * its batches or its history. Deliberately a separate call from `update`,
   * which takes a whole product payload — this one must not be able to carry
   * anything else along with it.
   */
  stopReordering: async (id: string) => {
    const res = await apiClient.patch<{ success: boolean; data: Product }>(
      `/products/${id}`,
      { reorderLevel: 0 },
    );
    return res.data.data;
  },
  remove: async (id: string) => {
    const res = await apiClient.delete(`/products/${id}`);
    return res.data;
  },
};

export const categoryApi = {
  list: async () => {
    const res = await apiClient.get<Paginated<Category>>("/categories", {
      params: { limit: 200 },
    });
    return res.data.data;
  },
  create: async (name: string) => {
    const res = await apiClient.post<{ success: boolean; data: Category }>(
      "/categories",
      { name },
    );
    return res.data.data;
  },
  update: async (id: string, patch: { name?: string; isActive?: boolean }) => {
    const res = await apiClient.patch<{ success: boolean; data: Category }>(
      `/categories/${id}`,
      patch,
    );
    return res.data.data;
  },
  remove: async (id: string) => {
    const res = await apiClient.delete(`/categories/${id}`);
    return res.data;
  },
};

export const brandApi = {
  list: async () => {
    const res = await apiClient.get<Paginated<Brand>>("/brands", {
      params: { limit: 200 },
    });
    return res.data.data;
  },
  create: async (name: string) => {
    const res = await apiClient.post<{ success: boolean; data: Brand }>(
      "/brands",
      { name },
    );
    return res.data.data;
  },
  update: async (id: string, patch: { name?: string; isActive?: boolean }) => {
    const res = await apiClient.patch<{ success: boolean; data: Brand }>(
      `/brands/${id}`,
      patch,
    );
    return res.data.data;
  },
  remove: async (id: string) => {
    const res = await apiClient.delete(`/brands/${id}`);
    return res.data;
  },
};
