import {
  useMutation,
  useQuery,
  keepPreviousData,
  useQueryClient,
} from "@tanstack/react-query";
import { saleApi } from "@modules/sale/api/saleApi";
import {
  CreateSalePayload,
  CreateReturnPayload,
  QueuedSaleResult,
  Sale,
} from "@modules/sale/types";
import {
  useOfflineStore,
  genOpId,
  pad4,
  type OutboxOp,
} from "@shared/offline/useOfflineStore";
import { isNetworkError } from "@shared/offline/outboxEngine";
import { localCatalog } from "@shared/offline/localCatalog";
import { buildOfflineSaleDoc } from "@modules/sale/offlineInvoice";
import { getDeviceId } from "@api/deviceId";
import { useAuthStore } from "@shared/store/useAuthStore";

/** Paged invoice history — grows without bound, so load a page at a time. */
export const useSales = (params?: {
  search?: string;
  customerId?: string;
  status?: string;
  page?: number;
  limit?: number;
}) =>
  useQuery({
    queryKey: ["sales", params],
    queryFn: () => saleApi.list(params),
    placeholderData: keepPreviousData,
  });

export const useSale = (id: string) =>
  useQuery({
    queryKey: ["sale", id],
    queryFn: () => saleApi.get(id),
    enabled: !!id,
  });

export const useInvoiceProfile = () =>
  useQuery({
    queryKey: ["invoice-profile"],
    queryFn: () => saleApi.invoiceProfile(),
  });

const invalidateAll = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ["sales"] });
  qc.invalidateQueries({ queryKey: ["stock"] });
  qc.invalidateQueries({ queryKey: ["stock-value"] });
  qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
};

/**
 * Captures a bill offline: claims the device's next invoice number (if a
 * series is registered) and parks the full payload in the durable outbox.
 * To the counter this IS a completed sale — the drain is bookkeeping.
 */
async function enqueueOfflineSale(
  payload: CreateSalePayload & { clientOpId: string },
): Promise<QueuedSaleResult> {
  /**
   * Schedule X (the narcotics-adjacent class) never sells offline: its
   * register must be airtight and a queued record that might park or be
   * discarded is not airtight. H/H1 stay sellable — refusing everyday
   * prescription drugs during a power cut would make offline mode useless —
   * and every offline sale is fully reconstructible from the outbox anyway.
   */
  for (const l of payload.lines) {
    const p = localCatalog.productById(l.productId);
    if (p?.scheduleDrug === "X") {
      throw new Error(
        `${p.name} is a Schedule X medicine — it can only be billed while connected.`,
      );
    }
  }
  const orgId = useAuthStore.getState().user?.organizationId || "";
  const alloc = useOfflineStore.getState().allocate(orgId);
  const deviceId = await getDeviceId();
  const op: OutboxOp = {
    opId: payload.clientOpId,
    type: "sale.create",
    payloadVersion: 1,
    payload: {
      ...payload,
      saleDate: payload.saleDate || new Date().toISOString(),
      offlineCapture: true,
      // deviceId always (attributes any recount task to this till);
      // invoiceSeq only when a registered series actually numbered the bill.
      deviceId,
      ...(alloc ? { invoiceSeq: alloc.seq } : {}),
    },
    displayNo: alloc ? `${alloc.seriesCode}-${pad4(alloc.seq)}` : null,
    createdAt: new Date().toISOString(),
    status: "pending",
    attempts: 0,
  };
  const printableSale = await buildOfflineSaleDoc(
    op.payload,
    op.displayNo,
  ).catch(() => null);
  op.itemCount = payload.lines.length;
  op.totalAmount = printableSale?.grandTotal ?? null;
  op.customerName = printableSale?.customerName || "";
  useOfflineStore.getState().enqueue(op);
  return {
    queued: true,
    opId: op.opId,
    displayNo: op.displayNo,
    printableSale,
  };
}

export const useCreateSale = () => {
  const qc = useQueryClient();
  return useMutation<Sale | QueuedSaleResult, unknown, CreateSalePayload>({
    mutationFn: async (payload) => {
      // Stamped before the first attempt, so an online try that dies on the
      // wire and the queued replay of it are the SAME operation to the server.
      const body = { ...payload, clientOpId: genOpId() };
      if (useOfflineStore.getState().online) {
        try {
          return await saleApi.create(body);
        } catch (err) {
          if (!isNetworkError(err)) throw err;
          // The wire died mid-request — fall through to the outbox rather
          // than make the pharmacist retype a bill that was already rung up.
        }
      }
      return await enqueueOfflineSale(body);
    },
    onSuccess: (result) => {
      if (!("queued" in result)) invalidateAll(qc);
    },
  });
};

export const useCreateReturn = () => {
  const qc = useQueryClient();
  return useMutation({
    // clientOpId: a return double-submitted over a flaky connection restocks
    // once, not twice (returns stay online-only in Phase 1).
    mutationFn: (payload: CreateReturnPayload) =>
      saleApi.createReturn({ ...payload, clientOpId: genOpId() }),
    onSuccess: (_d, vars) => {
      invalidateAll(qc);
      qc.invalidateQueries({ queryKey: ["sale", vars.saleId] });
    },
  });
};
