import { apiClient } from "@api/apiClient";
import { getDeviceId, getDeviceName } from "@api/deviceId";
import {
  AuthResponse,
  MessageResponse,
  LoginPayload,
  SignupPayload,
  ForgotPasswordPayload,
  SessionList,
  ResetPasswordPayload,
} from "@modules/auth/types";

export const authApi = {
  login: async (payload: LoginPayload): Promise<AuthResponse> => {
    const deviceId = await getDeviceId();
    const res = await apiClient.post<AuthResponse>("/auth/login", {
      ...payload,
      deviceId,
      deviceName: getDeviceName(),
    });
    return res.data;
  },
  signup: async (payload: SignupPayload): Promise<AuthResponse> => {
    const deviceId = await getDeviceId();
    const res = await apiClient.post<AuthResponse>("/auth/signup", {
      ...payload,
      deviceId,
      deviceName: getDeviceName(),
    });
    return res.data;
  },
  forgotPassword: async (
    payload: ForgotPasswordPayload,
  ): Promise<MessageResponse> => {
    const res = await apiClient.post("/auth/forgot-password", payload);
    return res.data;
  },
  resetPassword: async (
    payload: ResetPasswordPayload,
  ): Promise<MessageResponse> => {
    const res = await apiClient.post("/auth/reset-password", payload);
    return res.data;
  },
  logout: async (refreshToken: string): Promise<MessageResponse> => {
    const res = await apiClient.post("/auth/logout", { refreshToken });
    return res.data;
  },

  /** Devices this account is signed in on, with the current one flagged. */
  sessions: async (refreshToken: string | null): Promise<SessionList> => {
    const res = await apiClient.get("/auth/sessions", {
      params: refreshToken ? { refreshToken } : undefined,
    });
    return res.data.data as SessionList;
  },

  /**
   * Signs out other devices. `keepCurrent` defaults to true so freeing a stuck
   * slot doesn't also sign out the person doing it.
   */
  logoutAll: async (
    refreshToken: string | null,
    keepCurrent = true,
  ): Promise<{ message: string; signedOut: number }> => {
    const res = await apiClient.post("/auth/logout-all", {
      refreshToken: refreshToken || undefined,
      keepCurrent,
    });
    return res.data.data;
  },
};
