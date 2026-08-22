import {
  useMutation,
  useQuery,
  keepPreviousData,
  useQueryClient,
} from "@tanstack/react-query";
import { customerApi } from "@modules/customer/api/customerApi";
import { CustomerPayload } from "@modules/customer/types";

/** Paged customer list. */
export const useCustomers = (params?: {
  search?: string;
  page?: number;
  limit?: number;
  /** "inactive" lists deactivated customers so they can be restored. */
  status?: "active" | "inactive";
}) =>
  useQuery({
    queryKey: ["customers", params],
    queryFn: () => customerApi.list(params),
    placeholderData: keepPreviousData,
  });

export const useCustomer = (id: string) =>
  useQuery({
    queryKey: ["customer", id],
    queryFn: () => customerApi.get(id),
    enabled: !!id,
  });

export const useCreateCustomer = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CustomerPayload) => customerApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });
};

export const useUpdateCustomer = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<CustomerPayload> & { isActive?: boolean }) =>
      customerApi.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["customer", id] });
    },
  });
};

export const useRemoveCustomer = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => customerApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
  });
};
