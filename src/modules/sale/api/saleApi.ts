import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiClient } from "@api/apiClient";
import {
  Sale,
  SaleListItem,
  CreateSalePayload,
  CreateReturnPayload,
  ReturnDoc,
  InvoiceProfile,
  Paginated,
} from "@modules/sale/types";

export const saleApi = {
  list: async (params?: {
    search?: string;
    customerId?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) => {
    const res = await apiClient.get<Paginated<SaleListItem>>("/sales", {
      params,
    });
    return res.data;
  },
  get: async (id: string) => {
    const res = await apiClient.get<{ success: boolean; data: Sale }>(
      `/sales/${id}`,
    );
    return res.data.data;
  },
  create: async (payload: CreateSalePayload) => {
    const res = await apiClient.post<{ success: boolean; data: Sale }>(
      "/sales",
      payload,
    );
    return res.data.data;
  },
  createReturn: async (payload: CreateReturnPayload) => {
    const res = await apiClient.post<{ success: boolean; data: ReturnDoc }>(
      "/sales/returns",
      payload,
    );
    return res.data.data;
  },
  /**
   * Last-good-value cached: the profile carries `priceIncludesTax` (changes
   * the till's tax maths) and the company header every printed invoice needs,
   * so an outage must not blank either.
   */
  invoiceProfile: async () => {
    try {
      const res = await apiClient.get<{
        success: boolean;
        data: InvoiceProfile;
      }>("/settings/invoice-profile");
      AsyncStorage.setItem(
        PROFILE_CACHE_KEY,
        JSON.stringify(res.data.data),
      ).catch(() => {});
      return res.data.data;
    } catch (err) {
      const cached = await getCachedInvoiceProfile();
      if (cached) return cached;
      throw err;
    }
  },
};

const PROFILE_CACHE_KEY = "medstock-invoice-profile";

/** The last profile a successful fetch stored, or null. */
export async function getCachedInvoiceProfile(): Promise<InvoiceProfile | null> {
  const cached = await AsyncStorage.getItem(PROFILE_CACHE_KEY).catch(
    () => null,
  );
  if (!cached) return null;
  try {
    return JSON.parse(cached) as InvoiceProfile;
  } catch {
    return null;
  }
}
