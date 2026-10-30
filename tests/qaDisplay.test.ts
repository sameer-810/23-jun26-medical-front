/**
 * Display logic pulled out of the screens during the QA pass: how money and
 * quantities read, plural labels, report date ranges, the purchase register's
 * value, sale status wording, and where a form goes after a save.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fmtMoney,
  fmtMoneyExact,
  fmtAmountExact,
  fmtNumber,
  fmtCount,
  singularNoun,
  isInvertedRange,
} from "../src/shared/format";
import { goBackOr, BackNavigation } from "../src/shared/goBackOr";
import { receiptPayable } from "../src/modules/inventory/receiptPayable";
import { saleStatusLabel } from "../src/modules/sale/saleStatus";

test("money keeps two decimals and groups the Indian way", () => {
  assert.equal(fmtMoneyExact(52.5), "₹52.50");
  assert.equal(fmtMoneyExact(3858), "₹3,858.00");
  assert.equal(fmtMoneyExact(123456.7), "₹1,23,456.70");
  assert.equal(fmtMoney(81696.92), "₹81,697");
  assert.equal(fmtAmountExact(5055.8), "5,055.80");
});

test("a negative amount leads with the true minus, before the ₹", () => {
  assert.equal(fmtMoneyExact(-320.25), "−₹320.25");
  assert.equal(fmtMoney(-320.25), "−₹320");
  assert.equal(fmtAmountExact(-320.25), "−320.25");
});

test("a float residue that rounds to zero carries no sign", () => {
  assert.equal(fmtMoneyExact(-0.001), "₹0.00");
  assert.equal(fmtMoney(-0.4), "₹0");
  assert.equal(fmtAmountExact(-0.004), "0.00");
});

test("missing money reads as zero, as it always has", () => {
  assert.equal(fmtMoneyExact(null), "₹0.00");
  assert.equal(fmtMoney(undefined), "₹0");
});

test("report quantities are rounded and grouped", () => {
  assert.equal(fmtNumber(4999605.917), "49,99,605.92");
  assert.equal(fmtNumber(12), "12");
  assert.equal(fmtNumber(2.5), "2.5");
  assert.equal(fmtNumber(-3), "−3");
  assert.equal(fmtNumber(0), "0");
});

test("count labels agree with their number", () => {
  assert.equal(fmtCount(1, "sale"), "1 sale");
  assert.equal(fmtCount(0, "sale"), "0 sales");
  assert.equal(fmtCount(31544, "product"), "31,544 products");
  assert.equal(fmtCount(1, "batch", "batches"), "1 batch");
  assert.equal(fmtCount(2, "batch", "batches"), "2 batches");
  assert.equal(fmtCount(undefined, "member"), "0 members");
});

test("the pager's plural nouns singularise", () => {
  assert.equal(singularNoun("products"), "product");
  assert.equal(singularNoun("sales"), "sale");
  assert.equal(singularNoun("entries"), "entry");
  assert.equal(singularNoun("rows"), "row");
});

test("a date range is inverted only when both ends are set and swapped", () => {
  assert.equal(isInvertedRange("2026-10-20", "2026-10-01"), true);
  assert.equal(isInvertedRange("2026-10-01", "2026-10-20"), false);
  assert.equal(isInvertedRange("2026-10-01", "2026-10-01"), false);
  assert.equal(isInvertedRange("2026-10-20", ""), false);
  assert.equal(isInvertedRange("", "2026-10-01"), false);
  assert.equal(isInvertedRange(undefined, undefined), false);
  // Across a year end, where a day-first string would compare wrongly.
  assert.equal(isInvertedRange("2026-12-31", "2027-01-01"), false);
});

test("a receipt shows the bill foot, falling back for older rows", () => {
  assert.equal(
    receiptPayable({ netPayable: 3858, grandTotal: 3857.6, totalValue: 3800 }),
    3858,
  );
  // Foot stored but not rounded, or a list row without netPayable.
  assert.equal(
    receiptPayable({ grandTotal: 3857.6, totalValue: 3800 }),
    3857.6,
  );
  // Booked before the foot existed: the model default is 0.
  assert.equal(
    receiptPayable({ netPayable: 0, grandTotal: 0, totalValue: 3800 }),
    3800,
  );
  assert.equal(receiptPayable({ totalValue: 3800 }), 3800);
});

test("sale statuses read like the filter chips", () => {
  assert.equal(saleStatusLabel("completed"), "Completed");
  assert.equal(saleStatusLabel("partially_returned"), "Part-returned");
  assert.equal(saleStatusLabel("returned"), "Returned");
  // Unknown status from a newer server: readable, not hidden.
  assert.equal(saleStatusLabel("on_hold_again"), "on hold again");
});

function fakeNav(
  over: { type?: string; index?: number; canGoBack?: boolean },
  stack = true,
) {
  const calls: unknown[][] = [];
  const nav: BackNavigation = {
    canGoBack: () => over.canGoBack ?? true,
    goBack: () => calls.push(["goBack"]),
    getState: () => ({ type: over.type ?? "stack", index: over.index ?? 0 }),
    navigate: (name, params) => calls.push(["navigate", name, params]),
  };
  if (stack)
    nav.replace = (name, params) => calls.push(["replace", name, params]);
  return { nav, calls };
}

test("a form opened from its list pops back to it", () => {
  const { nav, calls } = fakeNav({ index: 1 });
  goBackOr(nav, "CustomersList");
  assert.deepEqual(calls, [["goBack"]]);
});

test("a form opened cold goes to the list, even if a parent could pop", () => {
  // Stack depth 0 but the drawer above can go back: that pop would leave the
  // section for the dashboard.
  const { nav, calls } = fakeNav({ index: 0, canGoBack: true });
  goBackOr(nav, "CustomersList");
  assert.deepEqual(calls, [["replace", "CustomersList", undefined]]);
});

test("a cold form with no history at all still leaves", () => {
  const { nav, calls } = fakeNav({ index: 0, canGoBack: false });
  goBackOr(nav, "TeamList");
  assert.deepEqual(calls, [["replace", "TeamList", undefined]]);
});

test("the fallback carries params, and uses navigate off a stack", () => {
  const { nav, calls } = fakeNav({ type: "drawer", index: 3 }, false);
  goBackOr(nav, "ReceiptDetail", { id: "r1" });
  assert.deepEqual(calls, [["navigate", "ReceiptDetail", { id: "r1" }]]);
});
