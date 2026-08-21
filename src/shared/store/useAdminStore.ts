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

/**
 * Platform-admin session storage.
 *
 * On web this uses sessionStorage, NOT localStorage. These tokens are the
 * control plane: they reach every tenant's data, and the refresh token is good
 * for seven days. In localStorage that credential outlives the browser session
 * on whatever machine an operator happened to use, and any script that ever
 * runs on the origin can read it.
 *
 * sessionStorage keeps the ergonomics that matter — a reload does not sign you
 * out — while scoping the credential to the tab it was created in and clearing
 * it when that tab closes. The tenant app deliberately keeps localStorage: a
 * pharmacy counter stays signed in all day by design, and it is not the control
 * plane. Native keeps SecureStore in both stores.
 */
const secureStorage: StateStorage = {
  getItem: async (name) => {
    if (Platform.OS === "web") {
      // Purge any admin session an earlier build wrote to disk. Deliberately a
      // purge rather than a migration: that token has been sitting in
      // localStorage where a script could read it, so it should be retired, not
      // carried forward. It costs the operator one sign-in.
      try {
        if (localStorage.getItem(name)) localStorage.removeItem(name);
      } catch {
        /* private mode / storage disabled */
      }
      return sessionStorage.getItem(name);
    }
    return await SecureStore.getItemAsync(name);
  },
  setItem: async (name, value) => {
    if (Platform.OS === "web") sessionStorage.setItem(name, value);
    else await SecureStore.setItemAsync(name, value);
  },
  removeItem: async (name) => {
    if (Platform.OS === "web") {
      sessionStorage.removeItem(name);
      // Clear anything a previous build left in localStorage, so an existing
      // long-lived admin token stops sitting on disk after this deploy.
      try {
        localStorage.removeItem(name);
      } catch {
        /* private mode / storage disabled — nothing to clean up */
      }
    } else await SecureStore.deleteItemAsync(name);
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
