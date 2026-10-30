/**
 * A product created from a bill line, and the PACK cell on that line.
 *
 * "20 GM" and "10ML" are sizes: a tube is one piece, sold whole. Creating them
 * as grams with a pack put a pack choice on the line, showed 3 tubes as 300 gm,
 * and left the till offering ml. Strips keep their pack, priced per tablet.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  draftFromLine,
  parsePack,
  toCreatePayload,
} from "../src/modules/inventory/productFromBill";
import {
  emptyLine,
  packChoiceNeeded,
  packLabel,
} from "../src/modules/inventory/receiveDraft";
import type { DraftLine, ProductLite } from "../src/modules/inventory/types";

const billLine = (productName: string, pack: string, mrp: number): DraftLine =>
  ({
    ...emptyLine(),
    fromBill: { productName, pack, hsn: null, mrp, gstPct: 5 },
  }) as DraftLine;

test("a '100 GM' line creates a piece sold whole, at the bill's MRP", () => {
  const d = draftFromLine(billLine("GLUCOSE-D (TUSHAR) 100 GM", "100 GM", 45));
  const p = toCreatePayload(d);
  assert.equal(p.baseUnit, "tube");
  assert.equal(p.packs, undefined);
  assert.equal(p.sellingPrice, 45);
});

test("a '10ML' line creates a bottle, and powder a packet", () => {
  assert.equal(
    draftFromLine(billLine("SOLEARWAX EAR DROP", "10ML", 70.31)).baseUnit,
    "bottle",
  );
  assert.equal(
    draftFromLine(billLine("MAGNESIUM SULPHATE POWDER", "20 GM", 10)).baseUnit,
    "packet",
  );
});

test("a '1X10' line takes its word from the name and prices one tablet", () => {
  assert.deepEqual(parsePack("1X10"), { count: 10, word: "" });
  const d = draftFromLine(billLine("FIBCAL D FORTE TAB", "1X10", 155));
  const p = toCreatePayload(d);
  assert.equal(p.baseUnit, "tablet");
  assert.deepEqual(p.packs, [{ unit: "strip", factor: 10 }]);
  assert.equal(p.sellingPrice, 15.5);
  assert.equal(p.mrp, 15.5);
});

const strip: ProductLite = {
  id: "s",
  name: "Aldigesic",
  sku: "x",
  baseUnit: "tablet",
  packs: [{ unit: "strip", factor: 10 }],
};
const tube: ProductLite = {
  id: "t",
  name: "Myfair",
  sku: "y",
  baseUnit: "tube",
  packs: [],
};

test("no pack choice once the bill has settled the line", () => {
  const line = {
    ...billLine("ALDIGESIC-TH TAB", "1X10", 271.88),
    unit: "strip",
  };
  assert.equal(packChoiceNeeded(line, strip), false);
  assert.equal(packLabel(line, strip), "10 tablet");
});

test("a product with one unit never asks", () => {
  const line = { ...billLine("MYFAIR CREAM", "20 GM", 196.87), unit: "tube" };
  assert.equal(packChoiceNeeded(line, tube), false);
  assert.equal(packLabel(line, tube), "tube");
});

test("the choice stays when the bill can't settle it, and on hand-added rows", () => {
  const clash = { ...billLine("X TAB", "1X15", 90), unit: null };
  assert.equal(packChoiceNeeded(clash, strip), true);
  assert.equal(
    packChoiceNeeded({ ...emptyLine(), unit: "tablet" }, strip),
    true,
  );
});
