import { apiClient } from "@api/apiClient";
import { User } from "@shared/store/useAuthStore";

export const profileApi = {
  me: async () => {
    const res = await apiClient.get<{ success: boolean; data: User }>(
      "/users/me",
    );
    return res.data.data;
  },
  updateMe: async (patch: {
    firstName?: string;
    lastName?: string;
    phone?: string;
  }) => {
    const res = await apiClient.patch<{ success: boolean; data: User }>(
      "/users/me",
      patch,
    );
    return res.data.data;
  },
  changePassword: async (payload: {
    currentPassword: string;
    newPassword: string;
  }) => {
    const res = await apiClient.post("/users/me/change-password", payload);
    return res.data;
  },
  deleteAccount: async (password: string) => {
    const res = await apiClient.delete<{
      success: boolean;
      data: { message: string; workspaceClosed: boolean };
    }>("/users/me", { data: { password } });
    return res.data.data;
  },
};
