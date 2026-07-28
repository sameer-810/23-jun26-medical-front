import { apiClient } from "@api/apiClient";
import { DashboardSummary, DashboardFinance } from "@modules/dashboard/types";

export const dashboardApi = {
  summary: async () => {
    const res = await apiClient.get<{
      success: boolean;
      data: DashboardSummary;
    }>("/dashboard/summary");
    return res.data.data;
  },
  finance: async () => {
    const res = await apiClient.get<{
      success: boolean;
      data: DashboardFinance;
    }>("/dashboard/finance");
    return res.data.data;
  },
};
