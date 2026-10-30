/**
 * Bill PACK -> receive unit, for lines matched by hand.
 *
 * A distributor's QTY counts packs. Picking a product used to set its BASE
 * unit, so "1 x ALDIGESIC-TH 1X10" was booked as 1 tablet instead of 10 —
 * stock understated tenfold, and the per-strip rate charged per tablet.
 *
 * The server already resolved this correctly for lines the scan matched on its
 * own (ocr.units.js). The client port is checked AGAINST THE SERVER'S OWN CODE
 * below, so a line matched by hand comes out exactly like one the scan matched.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parsePackSize,
  unitForBillPack,
  applyProductToLines,
  defaultPack,
  packChoiceNeeded,
  unitCaption,
  needsUnit,
  incompleteLines,
  emptyLine,
  baseQty,
  catalogueRows,
  isMeasurePack,
} from "../src/modules/inventory/receiveDraft";
import type { DraftLine, ProductLite } from "../src/modules/inventory/types";

const tablet: ProductLite = {
  id: "aldi",
  name: "Aldigesic TH 100mg/4mg Tablet",
  sku: "A1",
  baseUnit: "tablet",
  packs: [{ unit: "strip", factor: 10 }],
};
const drops: ProductLite = {
  id: "solear",
  name: "Solearwax Ear Drop",
  sku: "S1",
  baseUnit: "ml",
  packs: [{ unit: "bottle", factor: 10 }],
};
const noPacks: ProductLite = {
  id: "glucose",
  name: "Glucose-D 100gm",
  sku: "G1",
  baseUnit: "box",
  packs: [],
};

/** A scanned, unmatched bill row, as linesFromScan leaves it. */
const billRow = (name: string, pack: string, qty: string): DraftLine => ({
  ...emptyLine(),
  quantity: qty,
  batchNumber: "B1",
  locationId: "loc",
  flagged: true,
  fromBill: { productName: name, pack, hsn: null, mrp: null, gstPct: null },
});

test("the client's pack parser agrees with the server's on every shape", async () => {
  const { parsePackSize: server } = await import(
    "../../23-jun26-medical-back/src/modules/ocr/ocr.units.js" as string
  );
  for (const pack of [
    "1X10",
    "1x10",
    "1 X 10",
    "10ML",
    "20 GM",
    "100 GM",
    "15TABS",
    "1X30ML",
    "60 ML",
    "1 S",
    "10 TAB",
    "",
    "STRIP",
    null,
  ]) {
    assert.equal(parsePackSize(pack), server(pack), `pack "${pack}"`);
  }
});

test("the client's unit choice agrees with the server's resolver", async () => {
  const { resolvePackUnit } = await import(
    "../../23-jun26-medical-back/src/modules/ocr/ocr.units.js" as string
  );
  for (const product of [tablet, drops, noPacks]) {
    for (const pack of ["1X10", "10ML", "1X15", "1 S", "100 GM"]) {
      const s = resolvePackUnit(product, pack);
      assert.equal(
        unitForBillPack(product, pack).unit,
        s.resolved ? s.unit : null,
        `${product.name} / "${pack}"`,
      );
    }
  }
});

test("1 x '1X10' is one strip — ten tablets, not one", () => {
  const [line] = applyProductToLines(
    [billRow("ALDIGESIC-TH TAB", "1X10", "1")],
    0,
    tablet,
  );
  assert.equal(line.unit, "strip");
  assert.equal(baseQty(line, tablet), 10);
});

test("the Swastik bill's two Aldigesic rows come to 50 tablets, not 5", () => {
  // The bug report: qty 1 + qty 4 of 1X10 was booked as 5 tablets, and the
  // till then refused a sale of 10 with "only 5 tablet left".
  const lines = applyProductToLines(
    [
      billRow("ALDIGESIC-TH TAB", "1X10", "1"),
      billRow("ALDIGESIC-TH TAB", "1X10", "4"),
    ],
    0,
    tablet,
  );
  const total = lines.reduce((n, l) => n + baseQty(l, tablet), 0);
  assert.equal(total, 50);
});

test("a 10ML bottle line is received in bottles", () => {
  const [line] = applyProductToLines(
    [billRow("SOLEARWAX EAR DROP", "10ML", "5")],
    0,
    drops,
  );
  assert.equal(line.unit, "bottle");
  assert.equal(baseQty(line, drops), 50);
});

test("3 x '100 GM' is three pieces — the bill's quantity, as printed", () => {
  const [line] = applyProductToLines(
    [billRow("GLUCOSE-D", "100 GM", "3")],
    0,
    noPacks,
  );
  assert.equal(line.unit, "box");
  assert.equal(line.unitNote, undefined);
  assert.equal(baseQty(line, noPacks), 3);
});

test("a counted pack on a product with no pack units still gets a note", () => {
  const [line] = applyProductToLines([billRow("LOOSE TAB", "1X10", "3")], 0, {
    ...noPacks,
    baseUnit: "tablet",
  });
  assert.match(line.unitNote || "", /packs of 10/);
});

test("the client and server agree on which packs are measures", async () => {
  const { isMeasurePack: server } = await import(
    "../../23-jun26-medical-back/src/modules/ocr/ocr.units.js" as string
  );
  for (const pack of [
    "20 GM",
    "10ML",
    "1X30ML",
    "100GM",
    "1X10",
    "15TABS",
    "1 S",
    "",
    null,
  ])
    assert.equal(isMeasurePack(pack), server(pack), `pack "${pack}"`);
});

test("a pack the product doesn't define is left for a human, and blocks the save", () => {
  // Bill sells strips of 15; this product only knows strips of 10. Guessing
  // either way books the wrong quantity, so the line waits for a person.
  const lines = applyProductToLines(
    [billRow("ALDIGESIC-TH TAB", "1X15", "2")],
    0,
    tablet,
  );
  assert.equal(lines[0].unit, null);
  assert.equal(lines[0].flagged, true);
  assert.equal(needsUnit(lines[0], tablet), true);
  const pending = incompleteLines(lines, { aldi: tablet });
  assert.deepEqual(pending[0]?.missing, ["unit"]);
});

test("a hand-added line defaults to the pack, because bills count packs", () => {
  const [line] = applyProductToLines([], null, tablet, "loc");
  assert.equal(line.unit, "strip");
  assert.equal(line.locationId, "loc");
  // Read, not chosen.
  assert.equal(packChoiceNeeded(line, tablet), false);
});

test("the default pack is the smallest real one; no pack means the base unit", () => {
  const boxed: ProductLite = {
    ...tablet,
    packs: [
      { unit: "box", factor: 100 },
      { unit: "strip", factor: 10 },
      { unit: "single", factor: 1 },
    ],
  };
  assert.equal(defaultPack(boxed), "strip");
  assert.equal(defaultPack(noPacks), "box");
  const [line] = applyProductToLines([], null, noPacks, "loc");
  assert.equal(line.unit, "box");
});

test("the row says what its qty and rate count", () => {
  const line = { ...emptyLine(), unit: "strip" };
  assert.equal(unitCaption(line, tablet), "Qty and rate per strip (10 tablet)");
  assert.equal(
    unitCaption({ ...line, unit: "tablet" }, tablet),
    "Qty and rate per single tablet",
  );
  assert.equal(unitCaption({ ...line, unit: "box" }, noPacks), null);
});

/* ---- the same medicine printed twice ------------------------------------- */

test("matching one row fills its identical twin, each with its own pack", () => {
  const lines = applyProductToLines(
    [
      billRow("ALDIGESIC-TH TAB", "1X10", "1"),
      billRow("MYFAIR CREAM (20 GM)", "20 GM", "2"),
      billRow("Aldigesic-TH  tab.", "1X10", "4"), // spacing and case differ
    ],
    0,
    tablet,
  );
  assert.equal(lines[0].productId, "aldi");
  assert.equal(lines[2].productId, "aldi", "the twin is filled");
  assert.equal(lines[2].unit, "strip");
  assert.equal(lines[1].productId, null, "a different medicine is left alone");
});

test("a row already matched to something else is never overwritten", () => {
  const already = {
    ...billRow("ALDIGESIC-TH TAB", "1X10", "4"),
    productId: "other",
    unit: "tablet",
  };
  const lines = applyProductToLines(
    [billRow("ALDIGESIC-TH TAB", "1X10", "1"), already],
    0,
    tablet,
  );
  assert.equal(lines[1].productId, "other");
});

test("a hand-added row with no bill name doesn't sweep up other blank rows", () => {
  const lines = applyProductToLines([emptyLine(), emptyLine()], 0, tablet);
  assert.equal(lines[0].productId, "aldi");
  assert.equal(lines[1].productId, null);
});

test("catalogue matches are offered only for rows still unfilled", () => {
  const hit = { id: "cat-aldi", name: "Aldigesic SP Tablet" };
  const lines: DraftLine[] = [
    { ...billRow("ALDIGESIC SP TAB", "1X10", "5"), catalogMatch: hit },
    { ...billRow("ALDIGESIC SP TAB", "1X10", "2"), catalogMatch: hit },
    billRow("UNKNOWN THING", "1X10", "1"),
  ];
  assert.deepEqual(
    catalogueRows(lines).map((r) => r.row),
    [0, 1],
  );

  // Adding row 0 fills its identical twin too, so row 1 drops out of the offer.
  const filled = applyProductToLines(lines, 0, tablet);
  assert.deepEqual(catalogueRows(filled), []);
  assert.equal(baseQty(filled[0], tablet) + baseQty(filled[1], tablet), 70);
});

test("a scheme can be a percent, rupees off, or free goods — all three on one line", async () => {
  const { lineTotals, toReceiptLines } =
    await import("../src/modules/inventory/receiveDraft");
  // GLUCOSE-D on SP/4579: 3 at 42.84, 3 free, 3% off — plus ₹5 scheme off.
  const line: DraftLine = {
    ...billRow("GLUCOSE-D (TUSHAR) 100 GM", "100 GM", "3"),
    productId: "glucose",
    unit: "box",
    purchasePrice: "42.84",
    freeQuantity: "3",
    discountPct: "3",
    schemeAmount: "5",
    gstPct: "5",
  };
  const t = lineTotals(line);
  assert.equal(t.gross, 128.52);
  assert.equal(t.discount, 8.86); // 3.86 + 5.00
  assert.equal(baseQty(line, noPacks), 6); // three bought, three free
  const [sent] = toReceiptLines([line], { glucose: noPacks });
  assert.equal(sent.schemeAmount, 5);
  assert.equal(sent.discountPct, 3);
  assert.equal(sent.freeQuantity, 3);
});
