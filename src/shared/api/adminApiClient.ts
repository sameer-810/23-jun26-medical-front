import axios, { InternalAxiosRequestConfig } from "axios";
import { environment } from "@config/env";
import { useAdminStore } from "../store/useAdminStore";

interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

/**
 * Axios instance for the platform-admin console. Base URL is the `/admin`
 * namespace, and it injects the ADMIN token (never the tenant token). On a 401
 * it transparently refreshes the admin session once, mirroring the tenant
 * apiClient.
 */
export const adminApiClient = axios.create({
  baseURL: `${environment.apiUrl}/admin`,
  headers: { "Content-Type": "application/json" },
});

adminApiClient.interceptors.request.use((config) => {
  const token = useAdminStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

adminApiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as CustomAxiosRequestConfig;
    if (!originalRequest) return Promise.reject(error);

    if (
      originalRequest.url?.includes("/auth/refresh") ||
      originalRequest._retry
    ) {
      return Promise.reject(error);
    }

    const { token, refreshToken } = useAdminStore.getState();
    if (!token && !refreshToken) return Promise.reject(error);

    if (error.response?.status === 401) {
      originalRequest._retry = true;
      try {
        const newToken = await useAdminStore.getState().refreshSession();
        if (newToken) {
          originalRequest.headers.Authorization = "Bearer " + newToken;
          return adminApiClient(originalRequest);
        }
        await useAdminStore.getState().logout();
      } catch (refreshError) {
        await useAdminStore.getState().logout();
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  },
);
