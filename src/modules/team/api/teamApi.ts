import { apiClient } from "@api/apiClient";
import {
  TeamUser,
  CreateUserPayload,
  UpdateMemberPayload,
  PermissionCatalogue,
  ActivityLog,
  Paginated,
  TeamLimits,
} from "@modules/team/types";

export const teamApi = {
  list: async (params?: { search?: string; role?: string; page?: number }) => {
    const res = await apiClient.get<Paginated<TeamUser>>("/users", { params });
    return res.data;
  },
  get: async (id: string) => {
    const res = await apiClient.get<{ success: boolean; data: TeamUser }>(
      `/users/${id}`,
    );
    return res.data.data;
  },
  create: async (payload: CreateUserPayload) => {
    const res = await apiClient.post<{ success: boolean; data: TeamUser }>(
      "/users",
      payload,
    );
    return res.data.data;
  },
  /** Admin-side correction of a member's contact details (PATCH /users/:id). */
  updateMember: async (id: string, payload: UpdateMemberPayload) => {
    const res = await apiClient.patch<{ success: boolean; data: TeamUser }>(
      `/users/${id}`,
      payload,
    );
    return res.data.data;
  },
  updatePermissions: async (
    id: string,
    payload: { roleLabel?: string; permissions?: string[] },
  ) => {
    const res = await apiClient.patch<{ success: boolean; data: TeamUser }>(
      `/users/${id}/permissions`,
      payload,
    );
    return res.data.data;
  },
  setActive: async (id: string, isActive: boolean) => {
    const res = await apiClient.patch<{ success: boolean; data: TeamUser }>(
      `/users/${id}/active`,
      { isActive },
    );
    return res.data.data;
  },
  resetPassword: async (id: string, newPassword: string) => {
    const res = await apiClient.post(`/users/${id}/reset-password`, {
      newPassword,
    });
    return res.data;
  },
  remove: async (id: string) => {
    const res = await apiClient.delete(`/users/${id}`);
    return res.data;
  },
  permissionCatalogue: async () => {
    const res = await apiClient.get<{
      success: boolean;
      data: PermissionCatalogue;
    }>("/users/permission-catalogue");
    return res.data.data;
  },
  auditLogs: async (params?: {
    search?: string;
    action?: string;
    page?: number;
    limit?: number;
  }) => {
    const res = await apiClient.get<Paginated<ActivityLog>>("/activity-logs", {
      params,
    });
    return res.data;
  },

  /** Seat and device limits this pharmacy has set, plus the plan ceiling. */
  limits: async () => {
    const res = await apiClient.get<{ success: boolean; data: TeamLimits }>(
      "/organization/limits",
    );
    return res.data.data;
  },
  updateLimits: async (payload: {
    maxUsers?: number;
    maxDevicesPerUser?: number;
  }) => {
    const res = await apiClient.patch<{ success: boolean; data: TeamLimits }>(
      "/organization/limits",
      payload,
    );
    return res.data.data;
  },
};
