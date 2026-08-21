import { encode as base64encode } from "base-64";
import { apiClient } from "@api/apiClient";
import {
  Cheque,
  ChequePayload,
  ChequeStatus,
  UpcomingPdc,
  Paginated,
  ChequeRead,
} from "@modules/cheque/types";

export const chequeApi = {
  list: async (params?: {
    page?: number;
    limit?: number;
    direction?: string;
    status?: string;
  }) => {
    const res = await apiClient.get<Paginated<Cheque>>("/cheques", { params });
    return res.data;
  },
  upcoming: async () => {
    const res = await apiClient.get<{ success: boolean; data: UpcomingPdc }>(
      "/cheques/upcoming",
    );
    return res.data.data;
  },
  create: async (payload: ChequePayload) => {
    const res = await apiClient.post<{ success: boolean; data: Cheque }>(
      "/cheques",
      payload,
    );
    return res.data.data;
  },
  setStatus: async (id: string, status: ChequeStatus) => {
    const res = await apiClient.patch<{ success: boolean; data: Cheque }>(
      `/cheques/${id}/status`,
      { status },
    );
    return res.data.data;
  },
  remove: async (id: string) => {
    const res = await apiClient.delete(`/cheques/${id}`);
    return res.data;
  },

  /**
   * Read a cheque with the camera. Returns a DRAFT — the printed fields are
   * safe to fill in, the amount and date are returned for confirmation.
   */
  read: async (file: {
    uri: string;
    name: string;
    mimeType: string;
  }): Promise<ChequeRead> => {
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
    const res = await apiClient.post<{ success: boolean; data: ChequeRead }>(
      "/ocr/cheque",
      form,
      { headers: { "Content-Type": "multipart/form-data" }, timeout: 45000 },
    );
    return res.data.data;
  },

  /** Attach the photo to a saved cheque — the evidence if it ever bounces. */
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
    }>(`/cheques/${id}/image`, form, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 45000,
    });
    return res.data.data;
  },

  /**
   * The attached photo, as a data URI.
   *
   * The endpoint answers either with the bytes (inline store) or a 302 to a
   * short-lived signed CDN link; the HTTP layer follows the redirect, so both
   * land here as bytes. Returned as a data URI rather than a blob/object URL
   * because `<Image source={{uri}}>` takes the same string on web and native,
   * and the Authorization header can't ride on an <img src>.
   */
  image: async (id: string) => {
    const res = await apiClient.get<ArrayBuffer>(`/cheques/${id}/image`, {
      responseType: "arraybuffer",
      timeout: 30000,
    });
    const bytes = new Uint8Array(res.data);
    // Chunked: String.fromCharCode(...bytes) blows the argument limit on a
    // 150 KB photo.
    let binary = "";
    for (let i = 0; i < bytes.length; i += 8192)
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    const mime =
      (res.headers as Record<string, string>)?.["content-type"] || "image/jpeg";
    return `data:${mime};base64,${base64encode(binary)}`;
  },
};
