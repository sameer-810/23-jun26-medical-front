/**
 * Where the offline mirror lives: IndexedDB on web, AsyncStorage on native.
 *
 * AsyncStorage on web IS localStorage, capped at about 5 MB per origin. A shop
 * of 5,000 products and 10,000 stock rows is far past that, so half the mirror
 * failed to save. IndexedDB has no such ceiling worth worrying about, and one
 * transaction commits rows and their cursor together or not at all.
 *
 * Every method rejects on failure. A mirror that silently fails to save looks
 * like a healthy sync right up until the till needs it.
 */

export interface KvStore {
  getMany(keys: string[]): Promise<(readonly [string, string | null])[]>;
  setMany(pairs: [string, string][]): Promise<void>;
  removeMany(keys: string[]): Promise<void>;
}

const DB_NAME = "plusveda-mirror";
const OBJECT_STORE = "kv";

function openDb(idb: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = idb.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(OBJECT_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("Offline storage is blocked"));
  });
}

export function idbStore(idb: IDBFactory): KvStore {
  let conn: Promise<IDBDatabase> | null = null;
  const db = () => {
    conn ??= openDb(idb)
      .then((d) => {
        // The browser can close it under us; the next call reopens.
        d.onclose = () => {
          conn = null;
        };
        return d;
      })
      .catch((e) => {
        conn = null;
        throw e;
      });
    return conn;
  };
  /** Settles when the transaction commits, not when a request is queued. */
  const write = async (work: (s: IDBObjectStore) => void) => {
    const d = await db();
    await new Promise<void>((resolve, reject) => {
      const tx = d.transaction(OBJECT_STORE, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error ?? new Error("Offline write aborted"));
      tx.onerror = () => reject(tx.error ?? new Error("Offline write failed"));
      work(tx.objectStore(OBJECT_STORE));
    });
  };
  return {
    async getMany(keys) {
      const d = await db();
      const store = d.transaction(OBJECT_STORE).objectStore(OBJECT_STORE);
      return Promise.all(
        keys.map(
          (k) =>
            new Promise<readonly [string, string | null]>((resolve, reject) => {
              const req = store.get(k);
              req.onsuccess = () => resolve([k, req.result ?? null]);
              req.onerror = () => reject(req.error);
            }),
        ),
      );
    },
    setMany: (pairs) => write((s) => pairs.forEach(([k, v]) => s.put(v, k))),
    removeMany: (keys) => write((s) => keys.forEach((k) => s.delete(k))),
  };
}

let active: KvStore | null = null;

/** Tests hand in a fake; production resolves on first use. */
export function setKvStore(store: KvStore | null) {
  active = store;
}

/** Frees the old mirror: it shares localStorage with the bill outbox. */
function purgeLegacyMirror() {
  try {
    const stale: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith("medstock-cat:")) stale.push(k);
    }
    stale.forEach((k) => localStorage.removeItem(k));
  } catch {
    // Blocked storage has nothing to free.
  }
}

function resolveStore(): KvStore {
  if (active) return active;
  if (typeof indexedDB !== "undefined") {
    purgeLegacyMirror();
    active = idbStore(indexedDB);
    return active;
  }
  // Required here, not imported, so this file loads outside React Native.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const AsyncStorage = require("@react-native-async-storage/async-storage")
    .default as {
    multiGet(
      k: string[],
    ): Promise<readonly (readonly [string, string | null])[]>;
    multiSet(p: [string, string][]): Promise<void>;
    multiRemove(k: string[]): Promise<void>;
  };
  active = {
    getMany: async (keys) => [...(await AsyncStorage.multiGet(keys))],
    setMany: (pairs) => AsyncStorage.multiSet(pairs),
    removeMany: (keys) => AsyncStorage.multiRemove(keys),
  };
  return active;
}

export const kvStore: KvStore = {
  getMany: (keys) => resolveStore().getMany(keys),
  setMany: (pairs) => resolveStore().setMany(pairs),
  removeMany: (keys) => resolveStore().removeMany(keys),
};
