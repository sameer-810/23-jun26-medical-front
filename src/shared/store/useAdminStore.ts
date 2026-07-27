/**
 * useAdminStore — the platform-admin (superadmin) session, kept entirely
 * separate from the tenant `useAuthStore`. Different storage key, different
 * tokens, different API namespace (`/admin`). A pharmacy user and a platform
 * admin can even be "logged in" side by side in the same browser without
 * colliding, because neither store knows about the other.
 */
import { create } from "zustand";
import { persist, createJSONStorage, StateStorage } from "zustand/middleware";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import axios from "axios";
import { environment } from "@config/env";
import { isTokenExpired } from "./useAuthStore";

export interface PlatformAdmin {
  id: string;
  name: string;
  email: string;
}

interface AdminState {
  admin: PlatformAdmin | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  isAuthChecked: boolean;
  setAuth: (admin: PlatformAdmin, token: string, refreshToken: string) => void;
  updateTokens: (token: string, refreshToken: string) => void;
  logout: () => Promise<void>;
  initializeAuth: () => Promise<void>;
  refreshSession: () => Promise<string | null>;
}

const secureStorage: StateStorage = {
  getItem: async (name) => {
    if (Platform.OS === "web") return localStorage.getItem(name);
    return await SecureStore.getItemAsync(name);
  },
  setItem: async (name, value) => {
    if (Platform.OS === "web") localStorage.setItem(name, value);
    else await SecureStore.setItemAsync(name, value);
  },
  removeItem: async (name) => {
    if (Platform.OS === "web") localStorage.removeItem(name);
    else await SecureStore.deleteItemAsync(name);
  },
};

let refreshPromise: Promise<string | null> | null = null;
const STORAGE_KEY = "medstock-admin-storage";
const ADMIN_URL = `${environment.apiUrl}/admin`;

export const useAdminStore = create<AdminState>()(
  persist(
    (set, get) => ({
      admin: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isHydrated: false,
      isAuthChecked: false,

      setAuth: (admin, token, refreshToken) =>
        set({ admin, token, refreshToken, isAuthenticated: true }),

      updateTokens: (token, refreshToken) =>
        set({ token, refreshToken, isAuthenticated: true }),

      logout: async () => {
        const { refreshToken } = get();
        if (refreshToken) {
          try {
            await axios.post(`${ADMIN_URL}/auth/logout`, { refreshToken });
          } catch {
            // ignore — local sign-out proceeds regardless
          }
        }
        await secureStorage.removeItem(STORAGE_KEY);
        set({
          admin: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
        });
      },

      refreshSession: async () => {
        if (refreshPromise) return refreshPromise;
        refreshPromise = (async () => {
          try {
            const { refreshToken, updateTokens, logout } = get();
            if (!refreshToken || isTokenExpired(refreshToken)) {
              await logout();
              return null;
            }
            const rs = await axios.post(`${ADMIN_URL}/auth/refresh`, {
              refreshToken,
            });
            const { accessToken, refreshToken: newRefreshToken } = rs.data.data;
            updateTokens(accessToken, newRefreshToken);
            return accessToken;
          } catch {
            await get().logout();
            return null;
          } finally {
            refreshPromise = null;
          }
        })();
        return refreshPromise;
      },

      initializeAuth: async () => {
        const { token, refreshToken, refreshSession, logout } = get();
        if (!token && !refreshToken) {
          set({ isAuthChecked: true });
          return;
        }
        if (!isTokenExpired(token)) {
          set({ isAuthenticated: true, isAuthChecked: true });
          return;
        }
        if (refreshToken && !isTokenExpired(refreshToken)) {
          const newToken = await refreshSession();
          if (newToken) {
            set({ isAuthenticated: true, isAuthChecked: true });
            return;
          }
        }
        await logout();
        set({ isAuthChecked: true });
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => secureStorage),
      partialize: (state) => ({
        admin: state.admin,
        token: state.token,
        refreshToken: state.refreshToken,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) state.isHydrated = true;
      },
    },
  ),
);
