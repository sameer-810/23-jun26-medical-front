/**
 * The offline mirror's one promise: a cursor never moves past rows that were not
 * stored. Breaking it loses those rows for good, because every later delta
 * starts after them. That is how half a catalogue vanished on web.
 */
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { KvStore, setKvStore } from "../src/shared/offline/kvStore";
import { LocalCatalog } from "../src/shared/offline/localCatalog";

class MemStore implements KvStore {
  data = new Map<string, string>();
  failWrites = false;
  async getMany(keys: string[]) {
    return keys.map((k) => [k, this.data.get(k) ?? null] as const);
  }
  async setMany(pairs: [string, string][]) {
    if (this.failWrites) throw new Error("QuotaExceededError");
    for (const [k, v] of pairs) this.data.set(k, v);
  }
  async removeMany(keys: string[]) {
    for (const k of keys) this.data.delete(k);
  }
}

const row = (i: number) => ({
  _id: `6ae4${String(i).padStart(4, "0")}aaaa${i.toString(16).padStart(4, "0")}`,
  productId: "p",
  batchId: "b",
  locationId: "l",
  quantity: 5,
  reservedQuantity: 0,
});

let store: MemStore;
beforeEach(() => {
  store = new MemStore();
  setKvStore(store);
});

test("a held page is usable at once, and saved with its cursor on the next save", async () => {
  const cat = new LocalCatalog();
  await cat.hydrate("org");
  await cat.applyPage("stock", [row(1)], "cursor-1", { persist: false });
  assert.equal(cat.counts().stock, 1);
  assert.equal(cat.getCursor("stock"), null);

  const interrupted = new LocalCatalog();
  await interrupted.hydrate("org");
  assert.equal(interrupted.counts().stock, 0);

  await cat.applyPage("stock", [row(2)], "cursor-2");
  const fresh = new LocalCatalog();
  await fresh.hydrate("org");
  assert.equal(fresh.counts().stock, 2);
  assert.equal(fresh.getCursor("stock"), "cursor-2");
});

test("a page and its cursor land together and survive a reload", async () => {
  const cat = new LocalCatalog();
  await cat.hydrate("org");
  await cat.applyPage("stock", [row(1), row(2)], "2026-10-30T10:00:00Z");
  assert.equal(cat.getCursor("stock"), "2026-10-30T10:00:00Z");

  const fresh = new LocalCatalog();
  await fresh.hydrate("org");
  assert.equal(fresh.counts().stock, 2);
  assert.equal(fresh.getCursor("stock"), "2026-10-30T10:00:00Z");
});

test("a failed write rejects and leaves the cursor where it was", async () => {
  const cat = new LocalCatalog();
  await cat.hydrate("org");
  await cat.applyPage("stock", [row(1)], "cursor-1");

  store.failWrites = true;
  await assert.rejects(
    cat.applyPage("stock", [row(2)], "cursor-2"),
    (e: { isMirrorWrite?: boolean }) => e.isMirrorWrite === true,
  );
  assert.equal(cat.getCursor("stock"), "cursor-1");

  // The retry re-pulls from cursor-1 and stores the page it missed.
  store.failWrites = false;
  await cat.applyPage("stock", [row(2)], "cursor-2");
  const fresh = new LocalCatalog();
  await fresh.hydrate("org");
  assert.equal(fresh.counts().stock, 2);
  assert.equal(fresh.getCursor("stock"), "cursor-2");
});

test("an older schema is wiped so the rows are pulled again", async () => {
  await store.setMany([
    ["medstock-cat:org:schema", "2"],
    ["medstock-cat:org:cursor:stock", "far-along"],
    ["medstock-cat:org:stock:1", JSON.stringify({ x: row(1) })],
  ]);
  const cat = new LocalCatalog();
  await cat.hydrate("org");
  assert.equal(cat.getCursor("stock"), null);
  assert.equal(cat.counts().stock, 0);
  assert.equal(store.data.get("medstock-cat:org:schema"), "3");
});

test("an unreadable store still hydrates, empty and ready to pull", async () => {
  store.getMany = async () => {
    throw new Error("blocked");
  };
  const warn = console.warn;
  console.warn = () => {};
  try {
    const cat = new LocalCatalog();
    await cat.hydrate("org");
    assert.equal(cat.ready, true);
    assert.equal(cat.getCursor("stock"), null);
  } finally {
    console.warn = warn;
  }
});

test("productBySku ignores case, and inactive products", async () => {
  const cat = new LocalCatalog();
  await cat.hydrate("org");
  const product = (id: string, sku: string, isActive: boolean) => ({
    _id: id,
    sku,
    isActive,
  });
  await cat.applyPage(
    "products",
    [
      product("6ae400000000000000000001", "QA-14", true),
      product("6ae400000000000000000002", "QA-15", false),
    ],
    "c",
  );
  assert.equal(cat.productBySku("qa-14")?.sku, "QA-14");
  assert.equal(cat.productBySku("QA-15"), undefined);
});
