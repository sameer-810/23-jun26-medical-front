import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi, ListOrgsParams, ListParams } from "../api/adminApi";
import type { CatalogProduct, Plan, UpdatePharmacyInput } from "../types";

const invalidate = (qc: ReturnType<typeof useQueryClient>) =>
  qc.invalidateQueries({ queryKey: ["admin"] });

// ---- Overview ----
export function useAdminOverview() {
  return useQuery({
    queryKey: ["admin", "overview"],
    queryFn: adminApi.overview,
  });
}

// ---- Pharmacies ----
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
    mutationFn: adminApi.createOrganization,
    onSuccess: () => invalidate(qc),
  });
}
export function useUpdatePharmacy(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdatePharmacyInput) =>
      adminApi.updateOrganization(id, body),
    onSuccess: () => invalidate(qc),
  });
}
export function useArchivePharmacy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.archiveOrganization(id),
    onSuccess: () => invalidate(qc),
  });
}
export function useAssignPlan(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { planCode?: string; status?: string }) =>
      adminApi.assignPlan(id, body),
    onSuccess: () => invalidate(qc),
  });
}
export function useSetSuspended() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, suspend }: { id: string; suspend: boolean }) =>
      suspend ? adminApi.suspend(id) : adminApi.reactivate(id),
    onSuccess: () => invalidate(qc),
  });
}

// ---- Pharmacy users ----
export function useOrgUsers(id: string | undefined) {
  return useQuery({
    queryKey: ["admin", "org-users", id],
    queryFn: () => adminApi.listOrgUsers(id as string),
    enabled: Boolean(id),
  });
}
export function useResetUserPassword(orgId: string) {
  return useMutation({
    mutationFn: ({ userId, password }: { userId: string; password: string }) =>
      adminApi.resetOrgUserPassword(orgId, userId, password),
  });
}
export function useSetUserActive(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      adminApi.setOrgUserActive(orgId, userId, isActive),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["admin", "org-users", orgId] }),
  });
}

// ---- Catalog ----
export function useCatalogStats() {
  return useQuery({
    queryKey: ["admin", "catalog-stats"],
    queryFn: adminApi.catalogStats,
  });
}
export function useCatalog(params: ListParams) {
  return useQuery({
    queryKey: ["admin", "catalog", params],
    queryFn: () => adminApi.listCatalog(params),
  });
}
export function useCatalogProduct(id: string | undefined) {
  return useQuery({
    queryKey: ["admin", "catalog-item", id],
    queryFn: () => adminApi.getCatalog(id as string),
    enabled: Boolean(id),
  });
}
export function useCreateCatalog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: Partial<CatalogProduct>) => adminApi.createCatalog(b),
    onSuccess: () => invalidate(qc),
  });
}
export function useUpdateCatalog(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: Partial<CatalogProduct>) => adminApi.updateCatalog(id, b),
    onSuccess: () => invalidate(qc),
  });
}
export function useDeleteCatalog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteCatalog(id),
    onSuccess: () => invalidate(qc),
  });
}

// ---- Plans ----
export function usePlans(includeInactive = false) {
  return useQuery({
    queryKey: ["admin", "plans", includeInactive],
    queryFn: () => adminApi.listPlans(includeInactive),
  });
}
export function useCreatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: Partial<Plan>) => adminApi.createPlan(b),
    onSuccess: () => invalidate(qc),
  });
}
export function useUpdatePlan(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: Partial<Plan>) => adminApi.updatePlan(id, b),
    onSuccess: () => invalidate(qc),
  });
}
export function useDeletePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.deletePlan(id),
    onSuccess: () => invalidate(qc),
  });
}

// ---- Platform admins ----
export function useAdmins() {
  return useQuery({
    queryKey: ["admin", "admins"],
    queryFn: adminApi.listAdmins,
  });
}
export function useCreateAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: { name: string; email: string; password: string }) =>
      adminApi.createAdmin(b),
    onSuccess: () => invalidate(qc),
  });
}
export function useUpdateAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: { name?: string; password?: string; isActive?: boolean };
    }) => adminApi.updateAdmin(id, body),
    onSuccess: () => invalidate(qc),
  });
}
export function useRemoveAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.removeAdmin(id),
    onSuccess: () => invalidate(qc),
  });
}

// ---- Audit ----
export function useAudit(params: {
  page?: number;
  limit?: number;
  action?: string;
}) {
  return useQuery({
    queryKey: ["admin", "audit", params],
    queryFn: () => adminApi.listAudit(params),
  });
}

/** Devices signed in to one pharmacy. */
export function useOrgSessions(id: string | undefined) {
  return useQuery({
    queryKey: ["admin", "org-sessions", id],
    queryFn: () => adminApi.orgSessions(id as string),
    enabled: Boolean(id),
  });
}

/**
 * Force sign-out for a pharmacy, one staff member, or one device.
 *
 * Invalidates the pharmacy row too — its device count is shown there, and a
 * stale number after a revoke would look like the action didn't work.
 */
export function useRevokeOrgSessions(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { userId?: string; sessionId?: string } = {}) =>
      adminApi.revokeOrgSessions(id, body),
    onSuccess: () => invalidate(qc),
  });
}
