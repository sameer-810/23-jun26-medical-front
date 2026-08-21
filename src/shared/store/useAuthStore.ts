import { create } from "zustand";
import { persist, createJSONStorage, StateStorage } from "zustand/middleware";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { decode } from "base-64";
import axios from "axios";
import { environment } from "@config/env";

// Some RN engines lack `atob` (used for base64 JWT decoding below).
const runtimeGlobal = globalThis as unknown as { atob?: typeof decode };
if (!runtimeGlobal.atob) runtimeGlobal.atob = decode;

export type Role = "admin" | "staff";

export interface Organization {
  id: string;
  name: string;
  industry: string;
}

export interface User {
  id: string;
  organizationId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  avatar?: string;
  role: Role;
  roleLabel: string;
  permissions: string[];
  isActive: boolean;
}

interface AuthState {
  user: User | null;
  organization: Organization | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  isAuthChecked: boolean;
  setAuth: (
    user: User,
    organization: Organization,
    token: string,
    refreshToken: string,
  ) => void;
  updateUser: (patch: Partial<User>) => void;
  updateOrganization: (patch: Partial<Organization>) => void;
  updateTokens: (token: string, refreshToken: string) => void;
  logout: () => Promise<void>;
  initializeAuth: () => Promise<void>;
  refreshSession: () => Promise<string | null>;
  hasPermission: (permission: string) => boolean;
  isAdmin: () => boolean;
}

export const isTokenExpired = (token: string | null) => {
  if (!token) return true;
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );
    const { exp } = JSON.parse(jsonPayload);
    return exp * 1000 < Date.now() + 30000; // 30s buffer
  } catch {
    return true;
  }
};

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
const STORAGE_KEY = "medstock-auth-storage";

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      organization: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isHydrated: false,
      isAuthChecked: false,

      setAuth: (user, organization, token, refreshToken) =>
        set({ user, organization, token, refreshToken, isAuthenticated: true }),

      updateUser: (patch) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...patch } : null,
        })),

      updateOrganization: (patch) =>
        set((state) => ({
          organization: state.organization
            ? { ...state.organization, ...patch }
            : null,
        })),

      updateTokens: (token, refreshToken) =>
        set({ token, refreshToken, isAuthenticated: true }),

      logout: async () => {
        // Tell the server to drop this device's session so its slot frees up
        // immediately (best-effort — local sign-out proceeds regardless).
        const { refreshToken } = get();
        if (refreshToken) {
          try {
            await axios.post(`${environment.apiUrl}/auth/logout`, {
              refreshToken,
            });
          } catch {
            // ignore network/expiry errors — the TTL will reclaim the slot
          }
        }
        await secureStorage.removeItem(STORAGE_KEY);
        set({
          user: null,
          organization: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
        });
      },

      hasPermission: (permission) => {
        const { user } = get();
        if (!user) return false;
        if (user.role === "admin") return true;
        return user.permissions.includes(permission);
      },

      isAdmin: () => get().user?.role === "admin",

      refreshSession: async () => {
        if (refreshPromise) return refreshPromise;
        refreshPromise = (async () => {
          try {
            const { refreshToken, updateTokens, logout } = get();
            if (!refreshToken || isTokenExpired(refreshToken)) {
              await logout();
              return null;
            }
            const rs = await axios.post(`${environment.apiUrl}/auth/refresh`, {
              refreshToken,
            });
            const { accessToken, refreshToken: newRefreshToken } = rs.data.data;
            updateTokens(accessToken, newRefreshToken);
            return accessToken;
          } catch (err) {
            /**
             * Only a rejected token logs you out — not a bad connection.
             *
             * This used to log out on ANY failure, which threw away a
             * still-valid seven-day refresh token whenever the shop's internet
             * hiccuped or the API cold-started. The pharmacist then had to sign
             * in again, and that re-login consumed another device slot — which
             * is how a flaky line walked an account into the device-limit
             * lockout without anyone doing anything wrong.
             *
             * A network error means "we could not ask", not "the answer was
             * no": keep the token and let the next attempt succeed.
             */
            const status = (err as { response?: { status?: number } })?.response
              ?.status;
            const rejected = status === 401 || status === 403;
            if (rejected) await get().logout();
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
        user: state.user,
        organization: state.organization,
        token: state.token,
        refreshToken: state.refreshToken,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) state.isHydrated = true;
      },
    },
  ),
);
