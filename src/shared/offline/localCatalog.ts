/**
 * Local mirror of the tenant working set (Phase 2 of offline billing).
 *
 * Five server collections — products, batches, stock, customers, locations —
 * kept on-device so the till can search, price and allocate a sale with no
 * server. Reads are answered from in-memory Maps (a pharmacy's working set is
 * a few thousand rows — linear scans are sub-millisecond); durability comes
 * from AsyncStorage, sharded into 16 hash buckets per table because Android
 * caps a single AsyncStorage value at ~2 MB and one JSON blob per table would
 * hit it at catalogue scale.
 *
 * The server is the only truth: rows arrive exclusively via /sync/pull deltas
 * (cursor = server updatedAt), tombstones (`isDeleted`) delete locally, and
 * nothing here is ever pushed back.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

export type TableName =
  | "products"
  | "batches"
  | "stock"
  | "customers"
  | "locations";

export const TABLES: TableName[] = [
  "products",
  "batches",
  "stock",
  "customers",
  "locations",
];

interface BaseRow {
  _id: string;
  updatedAt?: string;
  isDeleted?: boolean;
}

export interface LocalProduct extends BaseRow {
  name: string;
  sku: string;
  barcode?: string | null;
  saltComposition?: string;
  categoryName?: string;
  brandName?: string;
  baseUnit: string;
  packs: { unit: string; factor: number }[];
  sellingPrice: number;
  mrp: number;
  taxRatePct: number;
  hsnCode?: string;
  reorderLevel?: number;
  prescriptionRequired?: boolean;
  scheduleDrug?: string;
  isActive: boolean;
}

export interface LocalBatch extends BaseRow {
  productId: string;
  productName?: string;
  sku?: string;
  batchNumber: string;
  mfgDate?: string | null;
  expiryDate?: string | null;
  purchasePrice?: number;
  mrp?: number;
  labelCode?: string | null;
  supplierName?: string;
}

export interface LocalStockItem extends BaseRow {
  productId: string;
  batchId: string;
  locationId: string;
  quantity: number;
  reservedQuantity: number;
}

export interface LocalCustomer extends BaseRow {
  name: string;
  mobile?: string | null;
  email?: string;
  address?: string;
  gstin?: string;
  isActive?: boolean;
}

export interface LocalLocation extends BaseRow {
  type: string;
  name?: string;
  code: string;
  pathName?: string;
  isActive?: boolean;
}

const BUCKETS = 16;
/**
 * Bump when a table's row shape or bucketing changes incompatibly. Unlike
 * the outbox (sole copy of real bills — always migrated), the catalog is a
 * MIRROR: on mismatch the org's slice is wiped and cursors reset, and the
 * next pull rebuilds it from the server. Cheap, and cannot lose anything.
 */
const CAT_SCHEMA_VERSION = 1;
const keyOf = (orgId: string, table: TableName, bucket: number) =>
  `medstock-cat:${orgId}:${table}:${bucket}`;
const cursorKey = (orgId: string, table: TableName) =>
  `medstock-cat:${orgId}:cursor:${table}`;
const schemaKey = (orgId: string) => `medstock-cat:${orgId}:schema`;
// Last hex char spreads Mongo ObjectIds evenly (it's counter-driven).
const bucketOf = (id: string) => parseInt(id.slice(-1), 16) % BUCKETS;

class LocalCatalog {
  private orgId: string | null = null;
  private tables = new Map<TableName, Map<string, BaseRow>>();
  private cursors = new Map<TableName, string | null>();
  private hydrating: Promise<void> | null = null;

  /** True once hydrate() finished for the signed-in org. */
  ready = false;

  /**
   * Loads the org's mirror into memory. Cheap to call repeatedly; switching
   * orgs (same device, different login) swaps the whole working set.
   */
  async hydrate(orgId: string): Promise<void> {
    if (this.orgId === orgId && (this.ready || this.hydrating)) {
      return this.hydrating ?? Promise.resolve();
    }
    this.orgId = orgId;
    this.ready = false;
    // Fresh per-org state — a login switch must not inherit the previous
    // org's cursors or rows.
    this.cursors = new Map();
    this.tables = new Map();
    this.hydrating = (async () => {
      const storedVersion = await AsyncStorage.getItem(schemaKey(orgId)).catch(
        () => null,
      );
      if (Number(storedVersion) !== CAT_SCHEMA_VERSION) {
        const stale = TABLES.flatMap((t) => [
          ...Array.from({ length: BUCKETS }, (_, b) => keyOf(orgId, t, b)),
          cursorKey(orgId, t),
        ]);
        await AsyncStorage.multiRemove(stale).catch(() => {});
        await AsyncStorage.setItem(
          schemaKey(orgId),
          String(CAT_SCHEMA_VERSION),
        ).catch(() => {});
      }

      const rowKeys = TABLES.flatMap((t) =>
        Array.from({ length: BUCKETS }, (_, b) => keyOf(orgId, t, b)),
      );
      const curKeys = TABLES.map((t) => cursorKey(orgId, t));
      const pairs = await AsyncStorage.multiGet([...rowKeys, ...curKeys]);
      const byKey = new Map(pairs);

      for (const t of TABLES) {
        const map = new Map<string, BaseRow>();
        for (let b = 0; b < BUCKETS; b++) {
          const raw = byKey.get(keyOf(orgId, t, b));
          if (!raw) continue;
          try {
            const rows = JSON.parse(raw) as Record<string, BaseRow>;
            for (const id of Object.keys(rows)) map.set(id, rows[id]);
          } catch {
            // A corrupt bucket loses its rows, not the app — the next full
            // pull rebuilds them (cursor reset below forces it).
            this.cursors.set(t, null);
          }
        }
        this.tables.set(t, map);
        if (!this.cursors.has(t)) {
          this.cursors.set(t, byKey.get(cursorKey(orgId, t)) ?? null);
        }
      }
      this.ready = true;
    })();
    try {
      await this.hydrating;
    } finally {
      this.hydrating = null;
    }
  }

  getCursor(table: TableName): string | null {
    return this.cursors.get(table) ?? null;
  }

  async setCursor(table: TableName, iso: string): Promise<void> {
    if (!this.orgId) return;
    this.cursors.set(table, iso);
    await AsyncStorage.setItem(cursorKey(this.orgId, table), iso).catch(
      () => {},
    );
  }

  /**
   * Applies one /sync/pull page: upserts live rows, deletes tombstones, and
   * persists only the buckets the page touched.
   */
  async applyPage(table: TableName, docs: BaseRow[]): Promise<void> {
    if (!this.orgId || docs.length === 0) return;
    const map = this.tables.get(table) ?? new Map<string, BaseRow>();
    this.tables.set(table, map);

    const dirty = new Set<number>();
    for (const doc of docs) {
      const id = String(doc._id);
      if (doc.isDeleted) map.delete(id);
      else map.set(id, { ...doc, _id: id });
      dirty.add(bucketOf(id));
    }

    const writes: [string, string][] = [];
    for (const b of dirty) {
      const rows: Record<string, BaseRow> = {};
      for (const [id, row] of map) {
        if (bucketOf(id) === b) rows[id] = row;
      }
      writes.push([keyOf(this.orgId, table, b), JSON.stringify(rows)]);
    }
    await AsyncStorage.multiSet(writes).catch(() => {});
  }

  // ---- Queries the till needs ------------------------------------------

  private all<T extends BaseRow>(table: TableName): T[] {
    return Array.from((this.tables.get(table) ?? new Map()).values()) as T[];
  }

  private get<T extends BaseRow>(table: TableName, id: string): T | undefined {
    return this.tables.get(table)?.get(String(id)) as T | undefined;
  }

  counts(): Record<TableName, number> {
    const out = {} as Record<TableName, number>;
    for (const t of TABLES) out[t] = this.tables.get(t)?.size ?? 0;
    return out;
  }

  productById(id: string): LocalProduct | undefined {
    return this.get<LocalProduct>("products", id);
  }

  /** Name / SKU / barcode / salt search, actives only — the POS search box. */
  searchProducts(q: string, limit = 25): LocalProduct[] {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    const hits: { p: LocalProduct; rank: number }[] = [];
    for (const p of this.all<LocalProduct>("products")) {
      if (!p.isActive) continue;
      const name = (p.name || "").toLowerCase();
      const sku = (p.sku || "").toLowerCase();
      const barcode = (p.barcode || "").toLowerCase();
      const salt = (p.saltComposition || "").toLowerCase();
      let rank = -1;
      if (barcode && barcode === needle) rank = 0;
      else if (name.startsWith(needle) || sku.startsWith(needle)) rank = 1;
      else if (name.includes(needle) || sku.includes(needle)) rank = 2;
      else if (salt.includes(needle)) rank = 3;
      if (rank >= 0) hits.push({ p, rank });
    }
    hits.sort((a, b) => a.rank - b.rank || a.p.name.localeCompare(b.p.name));
    return hits.slice(0, limit).map((h) => h.p);
  }

  /** Unfiltered first page — the search box before anything is typed. */
  browseProducts(limit = 50): LocalProduct[] {
    return this.all<LocalProduct>("products")
      .filter((p) => p.isActive)
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
      .slice(0, limit);
  }

  batchById(id: string): LocalBatch | undefined {
    return this.get<LocalBatch>("batches", id);
  }

  findBatchByLabelCode(code: string): LocalBatch | undefined {
    const needle = code.trim();
    if (!needle) return undefined;
    for (const b of this.all<LocalBatch>("batches")) {
      if (b.labelCode === needle) return b;
    }
    return undefined;
  }

  /** OCR "read pack" hands back a raw batch number when no label exists. */
  findBatchByNumber(batchNumber: string): LocalBatch | undefined {
    const needle = batchNumber.trim().toLowerCase();
    if (!needle) return undefined;
    for (const b of this.all<LocalBatch>("batches")) {
      if ((b.batchNumber || "").toLowerCase() === needle) return b;
    }
    return undefined;
  }

  productByBarcode(code: string): LocalProduct | undefined {
    const needle = code.trim();
    if (!needle) return undefined;
    for (const p of this.all<LocalProduct>("products")) {
      if (p.barcode === needle && p.isActive) return p;
    }
    return undefined;
  }

  /** Available units of ONE batch (no expiry judgement — callers flag it). */
  availableForBatch(batchId: string): number {
    let total = 0;
    for (const s of this.all<LocalStockItem>("stock")) {
      if (String(s.batchId) !== String(batchId)) continue;
      total += Math.max(0, (s.quantity || 0) - (s.reservedQuantity || 0));
    }
    return total;
  }

  /** Every lot of a product holding stock, expired ones included. */
  batchesWithStock(productId: string): { batch: LocalBatch; onHand: number }[] {
    const sums = new Map<string, number>();
    for (const s of this.all<LocalStockItem>("stock")) {
      if (String(s.productId) !== String(productId)) continue;
      if ((s.quantity || 0) <= 0) continue;
      const k = String(s.batchId);
      sums.set(k, (sums.get(k) || 0) + (s.quantity || 0));
    }
    const out: { batch: LocalBatch; onHand: number }[] = [];
    for (const [batchId, onHand] of sums) {
      const batch = this.batchById(batchId);
      if (batch) out.push({ batch, onHand });
    }
    return out;
  }

  /** On-hand available units (quantity − reserved) summed per batch. */
  private availableByBatch(productId: string): Map<string, number> {
    const sums = new Map<string, number>();
    for (const s of this.all<LocalStockItem>("stock")) {
      if (String(s.productId) !== String(productId)) continue;
      const avail = (s.quantity || 0) - (s.reservedQuantity || 0);
      if (avail <= 0) continue;
      const k = String(s.batchId);
      sums.set(k, (sums.get(k) || 0) + avail);
    }
    return sums;
  }

  /** Total sellable units for a product (expired lots excluded). */
  availableForProduct(productId: string): number {
    const now = Date.now();
    let total = 0;
    for (const [batchId, avail] of this.availableByBatch(productId)) {
      const batch = this.batchById(batchId);
      if (!batch) continue;
      if (batch.expiryDate && new Date(batch.expiryDate).getTime() <= now)
        continue;
      total += avail;
    }
    return total;
  }

  /**
   * FEFO order for a product — the same contract the server's
   * fefoCandidates query answers: non-expired lots with availability,
   * earliest expiry first (no-expiry lots last).
   */
  fefoCandidates(
    productId: string,
  ): { batch: LocalBatch; available: number }[] {
    const now = Date.now();
    const out: { batch: LocalBatch; available: number }[] = [];
    for (const [batchId, avail] of this.availableByBatch(productId)) {
      const batch = this.batchById(batchId);
      if (!batch) continue;
      if (batch.expiryDate && new Date(batch.expiryDate).getTime() <= now)
        continue;
      out.push({ batch, available: avail });
    }
    out.sort((a, b) => {
      const ea = a.batch.expiryDate
        ? new Date(a.batch.expiryDate).getTime()
        : Infinity;
      const eb = b.batch.expiryDate
        ? new Date(b.batch.expiryDate).getTime()
        : Infinity;
      return ea - eb;
    });
    return out;
  }

  customerById(id: string): LocalCustomer | undefined {
    return this.get<LocalCustomer>("customers", id);
  }

  searchCustomers(q: string, limit = 15): LocalCustomer[] {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    const hits: LocalCustomer[] = [];
    for (const c of this.all<LocalCustomer>("customers")) {
      if (c.isActive === false) continue;
      if (
        (c.name || "").toLowerCase().includes(needle) ||
        (c.mobile || "").includes(needle)
      ) {
        hits.push(c);
        if (hits.length >= limit * 3) break;
      }
    }
    hits.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    return hits.slice(0, limit);
  }
}

/** One instance per app — hydrated for the signed-in org by the engine. */
export const localCatalog = new LocalCatalog();
