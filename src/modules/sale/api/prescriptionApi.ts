import { apiClient } from "@api/apiClient";

export interface Prescription {
  id: string;
  customerId: string | null;
  patientName: string;
  patientAddress: string;
  patientAge: string;
  doctorName: string;
  doctorRegNo: string;
  doctorAddress: string;
  prescribedOn: string;
  validUntil: string;
  status: "pending" | "verified" | "rejected";
  verifiedByName: string;
  verifiedAt: string | null;
  notes: string;
  hasImage: boolean;
  saleCount: number;
  createdByName: string;
  createdAt: string;
}

export interface CreatePrescriptionPayload {
  customerId?: string | null;
  patientName?: string;
  patientAddress?: string;
  patientAge?: string;
  doctorName: string;
  doctorRegNo?: string;
  doctorAddress?: string;
  /** YYYY-MM-DD; today when omitted. */
  prescribedOn?: string;
  notes?: string;
  /** The pharmacist holding the paper verifies as they record it. */
  verified?: boolean;
}

/** One line of the Schedule H / H1 register (Rule 65). */
export interface RxRegisterRow {
  saleId: string;
  date: string;
  invoiceNo: string;
  patientName: string;
  patientAddress: string;
  patientAge: string;
  doctorName: string;
  doctorRegNo: string;
  doctorAddress: string;
  prescriptionId: string | null;
  prescriptionStatus: string;
  drug: string;
  schedule: string;
  quantity: number;
  unit: string;
  baseQuantity: number;
  batchNumber: string;
  soldBy: string;
}

export const prescriptionApi = {
  create: async (payload: CreatePrescriptionPayload) => {
    const res = await apiClient.post<{ success: boolean; data: Prescription }>(
      "/prescriptions",
      payload,
    );
    return res.data.data;
  },

  /** Attach the photo / PDF — the paper the register points back to. */
  attachImage: async (
    id: string,
    file: { uri: string; name: string; mimeType: string },
  ) => {
    const form = new FormData();
    if (file.uri.startsWith("data:") || file.uri.startsWith("blob:")) {
      const blob = await (await fetch(file.uri)).blob();
      form.append("file", new File([blob], file.name, { type: file.mimeType }));
    } else {
      form.append("file", {
        uri: file.uri,
        name: file.name,
        type: file.mimeType,
      } as unknown as Blob);
    }
    const res = await apiClient.post<{
      success: boolean;
      data: { size: number; uploadedAt: string };
    }>(`/prescriptions/${id}/image`, form, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 45000,
    });
    return res.data.data;
  },

  /** This customer's prescriptions a sale may still be dispensed against. */
  validFor: async (customerId: string) => {
    const res = await apiClient.get<{ success: boolean; data: Prescription[] }>(
      `/prescriptions/valid/${customerId}`,
    );
    return res.data.data;
  },

  setStatus: async (
    id: string,
    body: { status: "verified" | "rejected"; notes?: string },
  ) => {
    const res = await apiClient.patch<{ success: boolean; data: Prescription }>(
      `/prescriptions/${id}/status`,
      body,
    );
    return res.data.data;
  },

  register: async (params: {
    from?: string;
    to?: string;
    schedule?: "H" | "H1" | "X";
    page?: number;
    limit?: number;
  }) => {
    const res = await apiClient.get<{
      success: boolean;
      data: RxRegisterRow[];
      meta: { total: number; pages: number; page: number };
    }>("/prescriptions/register", { params });
    return res.data;
  },
};
