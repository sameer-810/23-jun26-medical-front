/**
 * The till's entry rules: what Enter does while a search is in flight, how a
 * scan is told from typing, what a number box may hold, and the unfinished bill.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeDecimal } from "../src/shared/numericInput";
import { BurstTracker, MIN_CODE_LEN } from "../src/shared/scanBurst";
import { enterAction, topIndex } from "../src/shared/ui/comboEnter";
import {
  draftKey,
  isDraftKey,
  parseDraft,
  serializeDraft,
} from "../src/modules/sale/saleDraft";
import { saleBlocker } from "../src/modules/sale/saleBlocker";

const base = {
  text: "QA Med 00810",
  highlighted: -1,
  itemCount: 0,
  loading: false,
  burst: false,
  hasRaw: true,
};

test("Enter on typed text waits for that search, never the raw handler", () => {
  assert.deepEqual(enterAction({ ...base, loading: true }), { kind: "wait" });
  // Even with an older list showing: it answers the previous query.
  assert.deepEqual(enterAction({ ...base, loading: true, itemCount: 5 }), {
    kind: "wait",
  });
});

test("a settled search takes the top match, a miss goes raw", () => {
  assert.deepEqual(enterAction({ ...base, itemCount: 3 }), {
    kind: "pick",
    index: 0,
  });
  assert.deepEqual(enterAction({ ...base, itemCount: 3, topIndex: 2 }), {
    kind: "pick",
    index: 2,
  });
  assert.deepEqual(enterAction(base), { kind: "raw" });
  assert.deepEqual(enterAction({ ...base, hasRaw: false }), { kind: "none" });
});

test("a scanner burst never waits for the debounce", () => {
  assert.deepEqual(enterAction({ ...base, loading: true, burst: true }), {
    kind: "raw",
  });
  // A box with no raw handler still waits for its search.
  assert.deepEqual(
    enterAction({ ...base, loading: true, burst: true, hasRaw: false }),
    { kind: "wait" },
  );
});

test("an arrow-key highlight outranks everything; empty text does nothing", () => {
  assert.deepEqual(enterAction({ ...base, highlighted: 1, itemCount: 3 }), {
    kind: "pick",
    index: 1,
  });
  assert.deepEqual(enterAction({ ...base, text: "" }), { kind: "none" });
});

test("an exact SKU or barcode outranks the search's own order", () => {
  const items = [
    { codes: ["QA-140", null] },
    { codes: ["QA-14", "8901"] },
    { codes: ["QA-141"] },
  ];
  assert.equal(topIndex(items, "qa-14"), 1);
  assert.equal(topIndex(items, " 8901 "), 1);
  assert.equal(topIndex(items, "paracetamol"), 0);
  assert.equal(topIndex([{}], "x"), 0);
});

const typed = (t: BurstTracker, text: string, gap: number, from = 1000) => {
  let at = from;
  for (const ch of text) {
    t.char(ch, at);
    at += gap;
  }
  return at - gap;
};

test("scanner speed is a scan, human speed is not", () => {
  const gun = new BurstTracker();
  const last = typed(gun, "L411-0", 4);
  assert.equal(gun.isScan(last + 4), true);

  const person = new BurstTracker();
  const end = typed(person, "L411-0", 110);
  assert.equal(person.isScan(end + 110), false);
  assert.ok(person.buffer.length < MIN_CODE_LEN);
});

test("a slow Enter after a fast burst is not the scan's tail", () => {
  const t = new BurstTracker();
  const last = typed(t, "ABCDEFG", 5);
  assert.equal(t.isScan(last + 500), false);
});

test("a run reports its start, so the field's prior value can be kept", () => {
  const t = new BurstTracker();
  assert.equal(t.char("4", 1000), true);
  assert.equal(t.char("1", 1005), false);
  assert.equal(t.char("9", 1500), true);
});

test("number boxes hold digits and one dot", () => {
  assert.equal(sanitizeDecimal("1e3"), "13");
  assert.equal(sanitizeDecimal("abc"), "");
  assert.equal(sanitizeDecimal("411-0"), "4110");
  assert.equal(sanitizeDecimal("12.5.6"), "12.56");
  assert.equal(sanitizeDecimal("-5"), "5");
  assert.equal(sanitizeDecimal("0.50"), "0.50");
  assert.equal(sanitizeDecimal("."), ".");
  assert.equal(sanitizeDecimal("1,200"), "1200");
});

const draft = {
  opId: "op-1",
  lines: [{ productId: "p1", quantity: "2" }],
  products: { p1: { id: "p1" } },
  customerId: null,
  customer: null,
  doctorName: "",
  prescriptionId: null,
  taxType: "intra" as const,
  paymentMode: "cash",
  refillDays: "",
};

test("a draft round-trips, keeping its op id", () => {
  const raw = serializeDraft(draft, 1000);
  const back = parseDraft(raw, 2000);
  assert.equal(back?.opId, "op-1");
  assert.deepEqual(back?.lines, draft.lines);
});

test("a stale, damaged or empty draft is no draft", () => {
  const day = 24 * 60 * 60 * 1000;
  assert.equal(parseDraft(serializeDraft(draft, 0), day + 1), null);
  assert.equal(parseDraft("{not json"), null);
  assert.equal(parseDraft(null), null);
  assert.equal(
    parseDraft(serializeDraft({ ...draft, lines: [] }, 1000), 1000),
    null,
  );
  assert.equal(parseDraft(JSON.stringify({ v: 99 })), null);
});

test("drafts are per org and per user", () => {
  assert.notEqual(draftKey("o1", "u1"), draftKey("o1", "u2"));
  assert.notEqual(draftKey("o1", "u1"), draftKey("o2", "u1"));
  assert.ok(isDraftKey(draftKey("o", "u")));
  assert.equal(isDraftKey("medstock-cat:o:stock:1"), false);
});

test("the footer names the first thing to fix", () => {
  const ok = { itemCount: 2 };
  assert.equal(saleBlocker({ itemCount: 0, creditNeedsCustomer: true }), null);
  assert.equal(saleBlocker(ok), null);
  assert.match(
    saleBlocker({ ...ok, blankQtyName: "Dolo", shortName: "X" }) ?? "",
    /^Dolo/,
  );
  assert.match(saleBlocker({ ...ok, shortName: "Dolo" }) ?? "", /stock/);
  assert.equal(saleBlocker({ ...ok, priceIssue: "Above MRP" }), "Above MRP");
  assert.match(
    saleBlocker({ ...ok, creditNeedsCustomer: true }) ?? "",
    /customer/,
  );
});
