import { apiClient } from "@api/apiClient";
import { getDeviceId, getDeviceName } from "@api/deviceId";
import {
  AuthResponse,
  MessageResponse,
  LoginPayload,
  SignupPayload,
  SignupResponse,
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
  /**
   * Registers a workspace. Does NOT sign you in — the account is queued for
   * admin approval and login is refused until then.
   */
  signup: async (payload: SignupPayload): Promise<SignupResponse> => {
    const res = await apiClient.post<SignupResponse>("/auth/signup", payload);
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
