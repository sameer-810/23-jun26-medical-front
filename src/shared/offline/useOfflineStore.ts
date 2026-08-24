/**
 * Offline outbox + device invoice series — Phase 1 of offline billing.
 *
 * A sale made with no server reachable is not an error; it is a bill that
 * already happened at the counter. It lands here — durably, in the same
 * persisted store the auth session uses — and the engine drains it when the
 * network returns. Ops carry a clientOpId, so a drain that dies halfway and
 * runs again cannot sell stock twice (the server answers a replay with the
 * original document).
 *
 * The invoice series is the device's own (CGST Rule 46(b): multiple series
 * are legal; each must stay consecutive). The server registers `T{n}` per
 * device; this store allocates `nextSeq` locally so a till in a power cut
 * still hands over a numbered bill.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CreateSalePayload } from "@modules/sale/types";

export interface OutboxOp {
  opId: string; // uuid — doubles as the server-side idempotency key
  type: "sale.create";
  /** Shape version of `payload` — lets a future build transform ops queued
   *  by an older one before replaying them (store-level `migrate` keys off
   *  this; absent = 1, the Phase 1 shape). */
  payloadVersion?: number;
  payload: CreateSalePayload;
  /** Display number promised at the counter ("T1-0007"), null when the
   *  device had no registered series yet (server numbers it at sync). */
  displayNo: string | null;
  createdAt: string;
  status: "pending" | "failed";
  attempts: number;
  lastError?: string;
  // Display metadata for the review screen — captured at enqueue because the
  // catalogue that priced the bill may have moved on by review time.
  itemCount?: number;
  totalAmount?: number | null;
  customerName?: string;
}

interface SeriesState {
  seriesCode: string; // "T1"
  nextSeq: number; // next number THIS device may print
}

interface OfflineState {
  /** Volatile: last-known reachability, inferred from real traffic. */
  online: boolean;
  ops: OutboxOp[];
  /** Keyed by organizationId — one device can serve several logins. */
  seriesByOrg: Record<string, SeriesState>;
  /** When the catalog mirror last completed a full pull round (ISO). */
  lastSyncAt: string | null;
  /** Device clock minus server clock, ms. Positive = device runs fast. */
  clockSkewMs: number;
  /** Tables whose mirror is known incomplete after the last pull. */
  incompleteTables: string[];

  setOnline: (v: boolean) => void;
  setSyncMeta: (meta: {
    lastSyncAt?: string;
    clockSkewMs?: number;
    incompleteTables?: string[];
  }) => void;
  setSeries: (orgId: string, seriesCode: string, serverLastSeq: number) => void;
  /** Claims the next local invoice sequence, or null if unregistered. */
  allocate: (orgId: string) => { seriesCode: string; seq: number } | null;
  enqueue: (op: OutboxOp) => void;
  markFailed: (opId: string, message: string) => void;
  bumpAttempt: (opId: string) => void;
  remove: (opId: string) => void;
  /** A parked op the pharmacist chose to retry re-enters the queue. */
  retry: (opId: string) => void;
}

export const genOpId = (): string =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });

export const pad4 = (n: number) => String(n).padStart(4, "0");

export const useOfflineStore = create<OfflineState>()(
  persist(
    (set, get) => ({
      online: true,
      ops: [],
      seriesByOrg: {},
      lastSyncAt: null,
      clockSkewMs: 0,
      incompleteTables: [],

      setOnline: (v) => {
        if (get().online !== v) set({ online: v });
      },

      setSyncMeta: (meta) => set(meta),

      setSeries: (orgId, seriesCode, serverLastSeq) =>
        set((s) => {
          const current = s.seriesByOrg[orgId];
          // The queue may hold allocations the server hasn't seen yet, so the
          // local counter only ever moves FORWARD on reconcile — taking the
          // server's smaller figure would hand out a number twice.
          const nextSeq = Math.max(
            current?.seriesCode === seriesCode ? current.nextSeq : 1,
            serverLastSeq + 1,
          );
          return {
            seriesByOrg: {
              ...s.seriesByOrg,
              [orgId]: { seriesCode, nextSeq },
            },
          };
        }),

      allocate: (orgId) => {
        const series = get().seriesByOrg[orgId];
        if (!series) return null;
        set((s) => ({
          seriesByOrg: {
            ...s.seriesByOrg,
            [orgId]: { ...series, nextSeq: series.nextSeq + 1 },
          },
        }));
        return { seriesCode: series.seriesCode, seq: series.nextSeq };
      },

      enqueue: (op) => set((s) => ({ ops: [...s.ops, op] })),

      markFailed: (opId, message) =>
        set((s) => ({
          ops: s.ops.map((o) =>
            o.opId === opId
              ? { ...o, status: "failed" as const, lastError: message }
              : o,
          ),
        })),

      bumpAttempt: (opId) =>
        set((s) => ({
          ops: s.ops.map((o) =>
            o.opId === opId ? { ...o, attempts: o.attempts + 1 } : o,
          ),
        })),

      remove: (opId) =>
        set((s) => ({ ops: s.ops.filter((o) => o.opId !== opId) })),

      retry: (opId) =>
        set((s) => ({
          ops: s.ops.map((o) =>
            o.opId === opId
              ? { ...o, status: "pending" as const, lastError: undefined }
              : o,
          ),
        })),
    }),
    {
      name: "medstock-offline-outbox",
      storage: createJSONStorage(() => AsyncStorage),
      /**
       * Schema version of the persisted outbox. The queue is the ONLY copy
       * of unsynced bills, so an old shape must always be migrated forward,
       * never wiped — add a case here for every version bump.
       */
      version: 1,
      migrate: (persisted, fromVersion) => {
        const state = persisted as Partial<OfflineState>;
        if (fromVersion < 1) {
          // v0 (unversioned Phase 1/2 builds) lacked sync metadata; ops and
          // series carry over unchanged.
          state.lastSyncAt = state.lastSyncAt ?? null;
          state.clockSkewMs = state.clockSkewMs ?? 0;
        }
        return state as OfflineState;
      },
      // `online` is a live judgement, never state to restore.
      partialize: (s) => ({
        ops: s.ops,
        seriesByOrg: s.seriesByOrg,
        lastSyncAt: s.lastSyncAt,
        clockSkewMs: s.clockSkewMs,
      }),
    },
  ),
);

/** Pending + failed counts for badges/banners. */
/**
 * Queued and parked bill counts.
 *
 * Two primitive selectors, not one that builds `{pending, failed}`. zustand v5
 * dropped the equality function and compares snapshots with `Object.is`, so a
 * selector returning a fresh object is a different snapshot on every read —
 * `useSyncExternalStore` re-renders, reads again, and React eventually throws
 * "Maximum update depth exceeded". That took out the offline banner and the
 * Offline & Sync screen: the exact two places a pharmacist looks when the
 * connection drops. Numbers compare by value and cannot regress this way.
 */
export function useQueueCounts(): { pending: number; failed: number } {
  const pending = useOfflineStore(
    (s) => s.ops.filter((o) => o.status === "pending").length,
  );
  const failed = useOfflineStore(
    (s) => s.ops.filter((o) => o.status === "failed").length,
  );
  return { pending, failed };
}
