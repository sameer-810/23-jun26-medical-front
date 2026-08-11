import {
  useMutation,
  useQuery,
  keepPreviousData,
  useQueryClient,
} from "@tanstack/react-query";
import { inventoryApi } from "@modules/inventory/api/inventoryApi";
import { ReceivePayload } from "@modules/inventory/types";

/** Paged stock list — the catalogue can be huge, so never load it all at once. */
export const useStock = (params?: {
  search?: string;
  lowStockOnly?: boolean;
  page?: number;
  limit?: number;
}) =>
  useQuery({
    queryKey: ["stock", params],
    queryFn: () => inventoryApi.stock(params),
    placeholderData: keepPreviousData,
  });

export const useStockValue = () =>
  useQuery({ queryKey: ["stock-value"], queryFn: () => inventoryApi.value() });

export const useProductInventory = (productId: string) =>
  useQuery({
    queryKey: ["product-inventory", productId],
    queryFn: () => inventoryApi.productInventory(productId),
    enabled: !!productId,
  });

export const useInventorySearch = (
  params: { q?: string; expiringInDays?: number },
  enabled = true,
) =>
  useQuery({
    queryKey: ["inventory-search", params],
    queryFn: () => inventoryApi.search(params),
    enabled,
  });

/** Paged goods-received notes — history grows with every delivery. */
export const useReceipts = (params?: {
  search?: string;
  page?: number;
  limit?: number;
  from?: string;
  to?: string;
}) =>
  useQuery({
    queryKey: ["receipts", params],
    queryFn: () => inventoryApi.receipts(params),
    placeholderData: keepPreviousData,
  });

export const useReceipt = (id: string) =>
  useQuery({
    queryKey: ["receipt", id],
    queryFn: () => inventoryApi.receipt(id),
    enabled: !!id,
  });

export const useReceiveStock = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ReceivePayload) => inventoryApi.receive(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock"] });
      qc.invalidateQueries({ queryKey: ["stock-value"] });
      qc.invalidateQueries({ queryKey: ["receipts"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });
};
