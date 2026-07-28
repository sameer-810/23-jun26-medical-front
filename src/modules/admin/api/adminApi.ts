import axios from "axios";
import { environment } from "@config/env";
import { adminApiClient } from "@shared/api/adminApiClient";
import type {
  AdminOrg,
  AdminOverview,
  ListMeta,
  CreatePharmacyInput,
  OrgUser,
  CatalogProduct,
  CatalogStats,
  Plan,
  PlatformAdminRow,
  AuditEntry,
} from "../types";

const ADMIN_URL = `${environment.apiUrl}/admin`;

export interface ListOrgsParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: "active" | "suspended";
}

export interface ListParams {
  page?: number;
  limit?: number;
  search?: string;
}

export const adminApi = {
  // ---- Auth ----
  login: (email: string, password: string) =>
    axios.post(`${ADMIN_URL}/auth/login`, { email, password }).then(
      (r) =>
        r.data.data as {
          admin: { id: string; name: string; email: string };
          accessToken: string;
          refreshToken: string;
        },
    ),

  overview: () =>
    adminApiClient.get("/overview").then((r) => r.data.data as AdminOverview),

  // ---- Pharmacies ----
  listOrganizations: (params: ListOrgsParams) =>
    adminApiClient
      .get("/organizations", { params })
      .then((r) => r.data as { data: AdminOrg[]; meta: ListMeta }),

  getOrganization: (id: string) =>
    adminApiClient
      .get(`/organizations/${id}`)
      .then((r) => r.data.data as AdminOrg),

  createOrganization: (body: CreatePharmacyInput) =>
    adminApiClient
      .post("/organizations", body)
      .then((r) => r.data.data as AdminOrg),

  updateOrganization: (id: string, body: Partial<AdminOrg>) =>
    adminApiClient
      .patch(`/organizations/${id}`, body)
      .then((r) => r.data.data as AdminOrg),

  archiveOrganization: (id: string) =>
    adminApiClient.delete(`/organizations/${id}`).then((r) => r.data.data),

  assignPlan: (
    id: string,
    body: { planCode?: string; status?: string; trialEndsAt?: string },
  ) =>
    adminApiClient
      .post(`/organizations/${id}/plan`, body)
      .then((r) => r.data.data as AdminOrg),

  suspend: (id: string) =>
    adminApiClient
      .post(`/organizations/${id}/suspend`)
      .then((r) => r.data.data as AdminOrg),

  reactivate: (id: string) =>
    adminApiClient
      .post(`/organizations/${id}/reactivate`)
      .then((r) => r.data.data as AdminOrg),

  // ---- Pharmacy users ----
  listOrgUsers: (id: string) =>
    adminApiClient
      .get(`/organizations/${id}/users`)
      .then((r) => r.data.data as OrgUser[]),

  resetOrgUserPassword: (id: string, userId: string, password: string) =>
    adminApiClient
      .post(`/organizations/${id}/users/${userId}/reset-password`, { password })
      .then((r) => r.data.data),

  setOrgUserActive: (id: string, userId: string, isActive: boolean) =>
    adminApiClient
      .post(`/organizations/${id}/users/${userId}/active`, { isActive })
      .then((r) => r.data.data),

  // ---- Catalog ----
  catalogStats: () =>
    adminApiClient
      .get("/catalog/stats")
      .then((r) => r.data.data as CatalogStats),

  listCatalog: (params: ListParams) =>
    adminApiClient
      .get("/catalog", { params })
      .then((r) => r.data as { data: CatalogProduct[]; meta: ListMeta }),

  getCatalog: (id: string) =>
    adminApiClient
      .get(`/catalog/${id}`)
      .then((r) => r.data.data as CatalogProduct),

  createCatalog: (body: Partial<CatalogProduct>) =>
    adminApiClient
      .post("/catalog", body)
      .then((r) => r.data.data as CatalogProduct),

  updateCatalog: (id: string, body: Partial<CatalogProduct>) =>
    adminApiClient
      .patch(`/catalog/${id}`, body)
      .then((r) => r.data.data as CatalogProduct),

  deleteCatalog: (id: string) =>
    adminApiClient.delete(`/catalog/${id}`).then((r) => r.data.data),

  restoreCatalog: (id: string) =>
    adminApiClient.post(`/catalog/${id}/restore`).then((r) => r.data.data),

  // ---- Plans ----
  listPlans: (includeInactive = false) =>
    adminApiClient
      .get("/plans", { params: { includeInactive } })
      .then((r) => r.data.data as Plan[]),

  createPlan: (body: Partial<Plan>) =>
    adminApiClient.post("/plans", body).then((r) => r.data.data as Plan),

  updatePlan: (id: string, body: Partial<Plan>) =>
    adminApiClient.patch(`/plans/${id}`, body).then((r) => r.data.data as Plan),

  deletePlan: (id: string) =>
    adminApiClient.delete(`/plans/${id}`).then((r) => r.data.data),

  // ---- Platform admins ----
  listAdmins: () =>
    adminApiClient
      .get("/admins")
      .then((r) => r.data.data as PlatformAdminRow[]),

  createAdmin: (body: { name: string; email: string; password: string }) =>
    adminApiClient.post("/admins", body).then((r) => r.data.data),

  updateAdmin: (
    id: string,
    body: { name?: string; password?: string; isActive?: boolean },
  ) => adminApiClient.patch(`/admins/${id}`, body).then((r) => r.data.data),

  removeAdmin: (id: string) =>
    adminApiClient.delete(`/admins/${id}`).then((r) => r.data.data),

  // ---- Audit ----
  listAudit: (params: { page?: number; limit?: number; action?: string }) =>
    adminApiClient
      .get("/audit", { params })
      .then((r) => r.data as { data: AuditEntry[]; meta: ListMeta }),
};
