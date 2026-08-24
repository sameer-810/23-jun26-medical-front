import axios, { InternalAxiosRequestConfig } from "axios";
import { environment } from "@config/env";
import { useAuthStore } from "../store/useAuthStore";
import { useOfflineStore } from "../offline/useOfflineStore";

interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

export const apiClient = axios.create({
  baseURL: environment.apiUrl,
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    // Every completed round-trip is proof of reachability — the cheapest
    // connectivity detector there is, and it can never disagree with reality.
    useOfflineStore.getState().setOnline(true);
    return response;
  },
  async (error) => {
    // An HTTP error still travelled the wire; only a missing response means
    // the network itself is gone.
    if (error.response) useOfflineStore.getState().setOnline(true);
    else if (axios.isAxiosError(error))
      useOfflineStore.getState().setOnline(false);

    const originalRequest = error.config as CustomAxiosRequestConfig;
    if (!originalRequest) return Promise.reject(error);

    if (
      originalRequest.url?.includes("/auth/refresh") ||
      originalRequest._retry
    ) {
      return Promise.reject(error);
    }

    const { token, refreshToken } = useAuthStore.getState();
    if (!token && !refreshToken) return Promise.reject(error);

    if (error.response?.status === 401) {
      originalRequest._retry = true;
      /**
       * refreshSession is the sole judge of whether this session dies: it
       * logs out only when the server actually rejects the refresh token
       * (401/403). A null here can also mean the network was unreachable —
       * logging out on that turned every power cut into a lockout the
       * pharmacist couldn't recover from, because logging back in needs the
       * very server that just went away.
       */
      const newToken = await useAuthStore.getState().refreshSession();
      if (newToken) {
        originalRequest.headers.Authorization = "Bearer " + newToken;
        return apiClient(originalRequest);
      }
    }
    return Promise.reject(error);
  },
);

/** Extracts a human-friendly message from an axios error. */
/** Field name out of a zod path: ["body","lines",0,"batchNumber"] -> "Line 1 batchNumber". */
function fieldLabel(path: (string | number)[]) {
  const parts = path.filter(
    (p) => p !== "body" && p !== "query" && p !== "params",
  );
  const idx = parts.findIndex((p) => typeof p === "number");
  const name = parts.filter((p) => typeof p === "string").pop();
  if (!name) return "";
  return idx >= 0 ? `Line ${Number(parts[idx]) + 1} ${name}` : String(name);
}

/**
 * The server's machine-readable error code, when it sent one.
 *
 * Screens branch on this rather than on the message text — a pending workspace
 * needs a calm "we're reviewing it" panel and a wrong password needs a red
 * error, and matching on wording breaks the first time somebody rewrites the
 * sentence.
 */
export function apiErrorCode(err: unknown): string | undefined {
  return (err as { response?: { data?: { error?: { code?: string } } } })
    ?.response?.data?.error?.code;
}

export function apiErrorMessage(
  err: unknown,
  fallback = "Something went wrong",
) {
  const e = err as {
    response?: {
      data?: {
        error?: {
          message?: string;
          details?: {
            issues?: { path: (string | number)[]; message: string }[];
          };
        };
      };
    };
  };
  const error = e?.response?.data?.error;
  /**
   * Not everything reaching here is an axios failure. The native report export
   * inspects the response itself and throws a plain Error; without this its
   * message was thrown away and the user saw only the generic fallback.
   */
  const plain =
    !error && err instanceof Error && err.message ? err.message : "";
  const message = error?.message || plain || fallback;

  /**
   * Validation failures already name the offending field on the wire — this
   * used to drop it and show only "Validation error", which told the user
   * nothing and left the developer reading server logs to find out which field
   * a 25-line goods-received note was unhappy about.
   */
  const issues = error?.details?.issues;
  if (issues?.length) {
    const seen = new Set<string>();
    const detail = issues
      .map((i) => {
        const label = fieldLabel(i.path || []);
        return label ? `${label}: ${i.message}` : i.message;
      })
      .filter((d) => !seen.has(d) && seen.add(d))
      // More than a handful is noise; the first few are what gets fixed first.
      .slice(0, 4)
      .join(" · ");
    if (detail) {
      const more = issues.length > 4 ? ` (+${issues.length - 4} more)` : "";
      return `${message} — ${detail}${more}`;
    }
  }
  return message;
}
