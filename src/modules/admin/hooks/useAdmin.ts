import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi, ListOrgsParams } from "../api/adminApi";
import type { CreatePharmacyInput } from "../types";

export function useAdminOverview() {
  return useQuery({
    queryKey: ["admin", "overview"],
    queryFn: adminApi.overview,
  });
}

export function useAdminOrganizations(params: ListOrgsParams) {
  return useQuery({
    queryKey: ["admin", "orgs", params],
    queryFn: () => adminApi.listOrganizations(params),
  });
}

export function useAdminOrganization(id: string | undefined) {
  return useQuery({
    queryKey: ["admin", "org", id],
    queryFn: () => adminApi.getOrganization(id as string),
    enabled: Boolean(id),
  });
}

export function useCreatePharmacy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreatePharmacyInput) =>
      adminApi.createOrganization(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin"] }),
  });
}

export function useSetSuspended() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, suspend }: { id: string; suspend: boolean }) =>
      suspend ? adminApi.suspend(id) : adminApi.reactivate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin"] }),
  });
}
