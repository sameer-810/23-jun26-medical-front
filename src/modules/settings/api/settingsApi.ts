import { apiClient } from "@api/apiClient";
import { Settings, SettingsPatch } from "@modules/settings/types";

export const settingsApi = {
  get: async () => {
    const res = await apiClient.get<{ success: boolean; data: Settings }>(
      "/settings",
    );
    return res.data.data;
  },
  update: async (patch: SettingsPatch) => {
    const res = await apiClient.patch<{ success: boolean; data: Settings }>(
      "/settings",
      patch,
    );
    return res.data.data;
  },
  /**
   * Builds a full backup of this pharmacy's data server-side and emails it to
   * the signed-in admin's address. Slow by nature (the server zips the whole
   * dataset) — the button shows a spinner, not a toast-and-forget.
   */
  emailBackup: async () => {
    const res = await apiClient.post<{
      success: boolean;
      data: { emailedTo: string; fileName: string; sizeBytes: number };
    }>("/backup/email");
    return res.data.data;
  },
};
