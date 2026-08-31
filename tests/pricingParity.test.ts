/**
 * The offline bill is priced on the device; the server re-prices it at sync.
 * If the two ever disagree, the printed provisional bill and the synced
 * invoice differ by paise — so the port is checked AGAINST THE SERVER'S OWN
 * CODE, not against a copy of it.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { priceSaleLocally } from "../src/shared/offline/pricing";

// The backend's env module refuses to load without these; nothing here
// connects to anything.
process.env.MONGODB_URI ??= "mongodb://127.0.0.1:1/x";
process.env.JWT_ACCESS_SECRET ??= "x";
process.env.JWT_REFRESH_SECRET ??= "x";

const products = [
  {
    name: "Dolo 650",
    baseUnit: "tablet",
    packs: [{ unit: "strip", factor: 15 }],
    sellingPrice: 2.1,
    taxRatePct: 12,
  },
  {
    name: "Omnident Gel",
    baseUnit: "tube",
    packs: [],
    sellingPrice: 156,
    taxRatePct: 12,
  },
  {
    name: "Syrup",
    baseUnit: "ml",
    packs: [{ unit: "bottle", factor: 100 }],
    sellingPrice: 0.95,
    taxRatePct: 5,
  },
  {
    name: "Zero tax",
    baseUnit: "pcs",
    packs: [],
    sellingPrice: 33.33,
    taxRatePct: 0,
  },
];

// Deterministic pseudo-random carts.
let seed = 42;
const rnd = () =>
  (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const pick = <T>(a: T[]) => a[Math.floor(rnd() * a.length)];

test("offline pricing matches the server's priceLine + totals for 300 random carts", async () => {
  const { saleService } = await import(
    "../../23-jun26-medical-back/src/modules/sale/sale.service.js" as string
  );
  const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

  for (let i = 0; i < 300; i++) {
    const priceIncludesTax = rnd() < 0.5;
    const taxType = rnd() < 0.8 ? "intra" : "inter";
    const n = 1 + Math.floor(rnd() * 4);
    const lines = Array.from({ length: n }, () => {
      const p = pick(products);
      const unit = p.packs.length && rnd() < 0.6 ? p.packs[0].unit : p.baseUnit;
      const factor = unit === p.baseUnit ? 1 : p.packs[0].factor;
      const quantity = 1 + Math.floor(rnd() * 5);
      const line: Record<string, unknown> = { productId: "x", unit, quantity };
      if (rnd() < 0.5)
        line.unitPrice = round(p.sellingPrice * factor * (0.8 + rnd() * 0.4));
      if (rnd() < 0.3) line.discountPct = Math.floor(rnd() * 30);
      else if (rnd() < 0.3) line.discountAmount = round(rnd() * 20);
      if (rnd() < 0.2) line.taxRatePct = pick([0, 5, 12, 18]);
      return { p, factor, line };
    });

    // Server side, line by line (the same code createSale runs).
    const server = {
      subtotal: 0,
      discount: 0,
      taxable: 0,
      tax: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
    };
    const serverLines = lines.map(({ p, line }) => {
      const priced = saleService.priceLine(p, line, {
        priceIncludesTax,
        taxType,
      });
      server.subtotal = round(server.subtotal + priced.gross);
      server.discount = round(server.discount + priced.discount);
      server.taxable = round(server.taxable + priced.taxable);
      server.tax = round(server.tax + priced.tax);
      server.cgst = round(server.cgst + priced.cgst);
      server.sgst = round(server.sgst + priced.sgst);
      server.igst = round(server.igst + priced.igst);
      return priced;
    });
    const rawGrand = round(server.taxable + server.tax);
    const serverGrand = Math.round(rawGrand);
    const serverRoundOff = round(serverGrand - rawGrand);

    // Device side.
    const local = priceSaleLocally(
      lines.map(({ p, factor, line }) => ({
        productName: p.name,
        unit: String(line.unit),
        factor,
        quantity: Number(line.quantity),
        unitPrice:
          typeof line.unitPrice === "number"
            ? line.unitPrice
            : round(p.sellingPrice * factor),
        discountAmount: line.discountAmount as number | undefined,
        discountPct: line.discountPct as number | undefined,
        taxRatePct:
          typeof line.taxRatePct === "number" ? line.taxRatePct : p.taxRatePct,
      })),
      { priceIncludesTax, taxType: taxType as "intra" | "inter" },
    );

    const ctx = `cart#${i} incl=${priceIncludesTax} ${taxType} ${JSON.stringify(lines.map((l) => l.line))}`;
    serverLines.forEach((s, k) => {
      const l = local.lines[k];
      assert.equal(l.grossAmount, s.gross, `gross ${ctx}`);
      assert.equal(l.discountAmount, s.discount, `discount ${ctx}`);
      assert.equal(l.taxableAmount, s.taxable, `taxable ${ctx}`);
      assert.equal(l.taxAmount, s.tax, `tax ${ctx}`);
      assert.equal(l.cgst, s.cgst, `cgst ${ctx}`);
      assert.equal(l.sgst, s.sgst, `sgst ${ctx}`);
      assert.equal(l.igst, s.igst, `igst ${ctx}`);
      assert.equal(l.lineTotal, s.lineTotal, `lineTotal ${ctx}`);
      assert.equal(l.baseQuantity, s.baseQuantity, `baseQty ${ctx}`);
    });
    assert.equal(local.grandTotal, serverGrand, `grand ${ctx}`);
    assert.equal(local.roundOff, serverRoundOff, `roundOff ${ctx}`);
  }
});
