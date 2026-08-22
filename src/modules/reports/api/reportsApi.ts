import { Platform } from "react-native";
// Legacy entrypoint keeps documentDirectory + downloadAsync (SDK 56 moved the
// default export to the new File API).
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { apiClient } from "@api/apiClient";
import { environment } from "@config/env";
import { useAuthStore } from "@shared/store/useAuthStore";

export type ReportType =
  | "inventory"
  | "sales"
  | "gst"
  | "expiry"
  | "batch"
  | "stock-movement"
  | "warehouse"
  | "purchase"
  | "user-activity";

export interface ReportColumn {
  key: string;
  label: string;
  type?: "money" | "number" | "date";
}

export interface ReportData {
  type: ReportType;
  title: string;
  generatedAt: string;
  range: { from?: string; to?: string };
  columns: ReportColumn[];
  rows: Record<string, unknown>[];
  summary?: Record<string, number | string>;
}

export const reportsApi = {
  get: async (type: ReportType, params: { from?: string; to?: string }) => {
    const res = await apiClient.get<{ success: boolean; data: ReportData }>(
      `/reports/${type}`,
      { params },
    );
    return res.data.data;
  },

  /** Downloads the report file (xlsx/pdf) — browser download on web, share sheet on native. */
  download: async (
    type: ReportType,
    format: "excel" | "pdf",
    params: { from?: string; to?: string },
  ) => {
    const ext = format === "pdf" ? "pdf" : "xlsx";
    const filename = `${type}-report-${new Date().toISOString().slice(0, 10)}.${ext}`;

    if (Platform.OS === "web") {
      const res = await apiClient.get(`/reports/${type}/export`, {
        params: { ...params, format },
        responseType: "blob",
      });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      return;
    }

    const token = useAuthStore.getState().token;
    /**
     * Build the query by hand, skipping blanks.
     *
     * `new URLSearchParams({ from: undefined })` does not drop the key — it
     * writes the literal text "from=undefined", which the server rejects with
     * "Use YYYY-MM-DD". Four report types never render date inputs at all, so
     * every export of those failed on native while the web path (axios, which
     * omits undefined) worked. That is the whole reason this only broke on
     * phones.
     */
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...params, format })) {
      if (value != null && String(value).trim() !== "")
        qs.set(key, String(value));
    }
    const uri = `${environment.apiUrl}/reports/${type}/export?${qs.toString()}`;
    const target =
      (FileSystem.documentDirectory || FileSystem.cacheDirectory) + filename;
    const dl = await FileSystem.downloadAsync(uri, target, {
      headers: { Authorization: `Bearer ${token}` },
    });

    /**
     * downloadAsync writes whatever came back, status and all. Without this
     * check a 400 JSON body was saved as "inventory-report.xlsx" and handed to
     * the share sheet — the file opened as one row of raw JSON, which reads as
     * a broken spreadsheet rather than a failed request.
     */
    if (dl.status < 200 || dl.status >= 300) {
      let message = `Export failed (${dl.status})`;
      try {
        const body = await FileSystem.readAsStringAsync(dl.uri);
        const parsed = JSON.parse(body) as {
          error?: {
            message?: string;
            details?: { issues?: { message: string }[] };
          };
        };
        const issues = parsed.error?.details?.issues;
        message =
          [parsed.error?.message, issues?.map((i) => i.message).join(", ")]
            .filter(Boolean)
            .join(" — ") || message;
      } catch {
        // Not JSON — keep the status-code message.
      }
      await FileSystem.deleteAsync(dl.uri, { idempotent: true });
      throw new Error(message);
    }

    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(dl.uri);
  },
};
