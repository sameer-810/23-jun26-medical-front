/**
 * Outbox engine — drains queued bills and keeps the connectivity verdict.
 *
 * Reachability is inferred from real traffic (apiClient reports every
 * success/network-failure here) plus a cheap /health probe while offline.
 * No native dependency: the same code judges Chrome, Electron and Expo.
 *
 * Draining is strictly in-order per device: bills replay in the sequence the
 * counter issued them. A server VERDICT (4xx/5xx) parks the op for a human —
 * retrying a rejected bill forever would jam every bill behind it. A network
 * death mid-drain just stops; the op stays pending for the next pass.
 */
import axios from "axios";
import type { QueryClient } from "@tanstack/react-query";
import { environment } from "@config/env";
import { apiClient, apiErrorMessage } from "@api/apiClient";
import { getDeviceId, getDeviceName } from "@api/deviceId";
import { useAuthStore } from "../store/useAuthStore";
import { useOfflineStore } from "./useOfflineStore";
import { localCatalog, TABLES, TableName } from "./localCatalog";

const PROBE_MS = 20_000;
const DRAIN_MS = 30_000;

const healthUrl = environment.apiUrl.replace(/\/api\/v1\/?$/, "") + "/health";

/** Axios error with no HTTP response = the wire itself failed. */
export const isNetworkError = (err: unknown) =>
  axios.isAxiosError(err) && !err.response;

let started = false;
let draining = false;
let registering = false;
let engineQueryClient: QueryClient | null = null;

/** Manual "sync now" (the review screen's Retry): push, then refresh pull. */
export async function requestSync() {
  if (!engineQueryClient) return;
  await probe();
  await drain(engineQueryClient);
  await pullCatalog(true);
}

export function reportOnline() {
  useOfflineStore.getState().setOnline(true);
}

export function reportNetworkFailure() {
  useOfflineStore.getState().setOnline(false);
}

async function probe() {
  try {
    await axios.get(healthUrl, { timeout: 5000 });
    reportOnline();
  } catch {
    reportNetworkFailure();
  }
}

/**
 * Ensures this device owns an invoice series for the signed-in org, and
 * reconciles the local counter with the server's high-water mark. Idempotent
 * and cheap — safe to call on every reconnect.
 */
export async function ensureSeriesRegistered() {
  const { user, isAuthenticated } = useAuthStore.getState();
  const { online } = useOfflineStore.getState();
  if (!isAuthenticated || !user || !online || registering) return;
  registering = true;
  try {
    const deviceId = await getDeviceId();
    const rs = await apiClient.post<{
      data: { seriesCode: string; lastSeq: number };
    }>("/invoice-series/register", { deviceId, label: getDeviceName() });
    const { seriesCode, lastSeq } = rs.data.data;
    useOfflineStore
      .getState()
      .setSeries(user.organizationId, seriesCode, lastSeq);
  } catch {
    // Offline or not yet permitted — the next reconnect tries again.
  } finally {
    registering = false;
  }
}

/** One page of /sync/pull. */
interface SyncPage {
  docs: { _id: string }[];
  more: boolean;
  nextSince: string;
  nextId?: string | null;
  serverTime?: string;
}

/** Server table name per local table — 1:1 today. */
const PULL_TABLES: TableName[] = TABLES;

let pulling = false;
let lastPullAt = 0;
const PULL_EVERY_MS = 60_000;

/**
 * Delta-pulls the tenant working set into the local catalog. Cursor per
 * collection, pages until the server says no more. Failing quietly is
 * correct: a pull that dies resumes from its cursor next round.
 */
export async function pullCatalog(force = false) {
  const { user, isAuthenticated } = useAuthStore.getState();
  const { online } = useOfflineStore.getState();
  if (!isAuthenticated || !user || !online || pulling) return;
  if (!force && Date.now() - lastPullAt < PULL_EVERY_MS) return;
  pulling = true;
  try {
    await localCatalog.hydrate(user.organizationId);
    let skewSample: number | null = null;
    const incomplete: string[] = [];
    for (const table of PULL_TABLES) {
      let since: string | null = localCatalog.getCursor(table);
      /**
       * The _id half of the cursor. Deliberately not persisted: it only exists
       * mid-page, and a pull that dies mid-page resumes from the stored
       * `updatedAt` on the server's overlap branch, which re-reads one page and
       * hands back a fresh id. Nothing to migrate, nothing to lose.
       */
      let sinceId: string | null = null;
      let drained = false;
      // Guard: a table never pages forever in one pass.
      let page = 0;
      for (; page < 50; page++) {
        const rs = await apiClient.get<{ data: SyncPage }>("/sync/pull", {
          params: {
            collection: table,
            ...(since ? { since } : {}),
            ...(sinceId ? { sinceId } : {}),
          },
        });
        // Landed in its own annotated const on purpose: destructuring straight
        // off `rs` makes the cursors' types infer through the response that
        // they themselves parameterise, and TypeScript gives up (TS7022).
        const body: SyncPage = rs.data.data;
        const { docs, more, nextSince, nextId, serverTime } = body;
        if (serverTime && skewSample == null) {
          // One sample per round is plenty — this flags a till clock that is
          // minutes wrong (printed bill times), not network jitter.
          skewSample = Date.now() - new Date(serverTime).getTime();
        }
        await localCatalog.applyPage(table, docs);
        await localCatalog.setCursor(table, nextSince);
        since = nextSince;
        sinceId = nextId ?? null;
        if (!more) {
          drained = true;
          break;
        }
      }
      // Hitting the guard means the mirror is incomplete — the till would
      // search a partial catalogue and look like stock had vanished. Say so
      // rather than reporting a clean sync; the next round resumes the cursor.
      if (!drained) {
        console.warn(
          `[sync] ${table}: stopped after ${page} pages with more to pull`,
        );
        incomplete.push(table);
      }
    }
    lastPullAt = Date.now();
    useOfflineStore.getState().setSyncMeta({
      lastSyncAt: new Date().toISOString(),
      ...(skewSample != null ? { clockSkewMs: skewSample } : {}),
      incompleteTables: incomplete,
    });
  } catch {
    // Offline or a 4xx mid-pull — cursors already hold real progress.
  } finally {
    pulling = false;
  }
}

async function drain(queryClient: QueryClient) {
  if (draining) return;
  const store = useOfflineStore.getState();
  if (!store.online) return;
  // Two browser tabs share one outbox; only one may replay it or the same
  // bill posts twice in flight (idempotency would catch it, but why race).
  const locks = (globalThis.navigator as { locks?: LockManager } | undefined)
    ?.locks;
  if (locks) {
    await locks.request(
      "medstock-outbox-drain",
      { ifAvailable: true },
      async (lock) => {
        if (lock) await drainInner(queryClient);
      },
    );
    return;
  }
  await drainInner(queryClient);
}

async function drainInner(queryClient: QueryClient) {
  if (draining) return;
  draining = true;
  let synced = 0;
  try {
    // Snapshot ids, re-read each op live — a retry click mid-drain must win.
    const ids = useOfflineStore
      .getState()
      .ops.filter((o) => o.status === "pending")
      .map((o) => o.opId);
    for (const opId of ids) {
      const op = useOfflineStore
        .getState()
        .ops.find((o) => o.opId === opId && o.status === "pending");
      if (!op) continue;
      useOfflineStore.getState().bumpAttempt(opId);
      try {
        await apiClient.post("/sales", op.payload);
        useOfflineStore.getState().remove(opId);
        synced += 1;
      } catch (err) {
        if (isNetworkError(err)) {
          reportNetworkFailure();
          break; // still offline — everything stays pending
        }
        const status = axios.isAxiosError(err)
          ? err.response?.status
          : undefined;
        // Session death is not a verdict on the bill: the op stays pending
        // and the next login's drain delivers it.
        if (status === 401) break;
        // A 409 can be transient contention ("stock changed, retry") — give
        // it a few rounds before parking, bounded so a permanent conflict
        // (reused invoice number) still surfaces within ~2 minutes.
        if (status === 409) {
          const current = useOfflineStore
            .getState()
            .ops.find((o) => o.opId === opId);
          if ((current?.attempts ?? 0) < 3) continue;
        }
        // The server judged this bill and said no. Park it for the
        // reconciliation screen; later bills are independent, keep going.
        useOfflineStore
          .getState()
          .markFailed(opId, apiErrorMessage(err, "Rejected by server"));
      }
    }
  } finally {
    draining = false;
    if (synced > 0) {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["stock"] });
      queryClient.invalidateQueries({ queryKey: ["stock-value"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    }
  }
}

/** Wire the engine once at app start. */
export function startOfflineEngine(queryClient: QueryClient) {
  if (started) return;
  started = true;
  engineQueryClient = queryClient;

  // The browser's own signal is a hint (it only proves LAN, not the server) —
  // treat "offline" as authoritative, "online" as a reason to probe.
  if (typeof window !== "undefined" && window.addEventListener) {
    window.addEventListener("offline", () => reportNetworkFailure());
    window.addEventListener("online", () => void probe());
  }

  // Web: ask the browser not to evict the mirror and the outbox under disk
  // pressure. Chrome grants this silently for installed/engaged origins.
  const storage = (
    globalThis.navigator as { storage?: { persist?: () => Promise<boolean> } }
  )?.storage;
  if (storage?.persist) void storage.persist().catch(() => {});

  setInterval(
    () => {
      const { online, ops } = useOfflineStore.getState();
      if (!online) void probe();
      else {
        if (ops.some((o) => o.status === "pending")) void drain(queryClient);
        // Keeps the offline mirror at most a minute stale while powered.
        void pullCatalog();
      }
    },
    Math.min(PROBE_MS, DRAIN_MS),
  );

  // Reconnect reaction: the moment we're judged online, register the series
  // (first run) and drain whatever the outage accumulated.
  useOfflineStore.subscribe((s, prev) => {
    if (s.online && !prev.online) {
      void ensureSeriesRegistered();
      // Push before pull: our bills reach the server, then the mirror
      // returns them as truth.
      void drain(queryClient).then(() => pullCatalog(true));
    }
  });

  // Login reaction: a fresh session needs its series (and may have a queue
  // from before a token expiry).
  useAuthStore.subscribe((s, prev) => {
    if (s.isAuthenticated && !prev.isAuthenticated) {
      // Hydrate unconditionally — an offline-grace boot (power cut restart)
      // must read yesterday's mirror even though no pull can run.
      if (s.user) void localCatalog.hydrate(s.user.organizationId);
      void ensureSeriesRegistered();
      void drain(queryClient).then(() => pullCatalog(true));
    }
  });

  // Boot: hydrate the mirror immediately (an offline start must still read
  // yesterday's catalogue), then sync if the wire allows.
  const orgId = useAuthStore.getState().user?.organizationId;
  if (orgId) void localCatalog.hydrate(orgId);
  void ensureSeriesRegistered();
  void drain(queryClient).then(() => pullCatalog(true));
}
