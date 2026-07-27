import axios from "axios";
import { environment } from "@config/env";
import { adminApiClient } from "@shared/api/adminApiClient";
import type {
  AdminOrg,
  AdminOverview,
  ListMeta,
  CreatePharmacyInput,
} from "../types";

const ADMIN_URL = `${environment.apiUrl}/admin`;

export interface ListOrgsParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: "active" | "suspended";
}

export const adminApi = {
  // Login uses a bare axios call — there is no token yet.
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

  suspend: (id: string) =>
    adminApiClient
      .post(`/organizations/${id}/suspend`)
      .then((r) => r.data.data as AdminOrg),

  reactivate: (id: string) =>
    adminApiClient
      .post(`/organizations/${id}/reactivate`)
      .then((r) => r.data.data as AdminOrg),
};
