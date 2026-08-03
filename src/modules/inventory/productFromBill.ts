import { DraftLine, ProductLite } from "@modules/inventory/types";

/**
 * Creating a catalogue product from a purchase-bill line.
 *
 * A bill is how a product actually enters a pharmacy, so "it isn't in the
 * dropdown yet" is the normal case for new stock, not an error. The bill has
 * already told us the name, the pack, the MRP and the GST slab — this works out
 * what to put in the form so the pharmacist confirms rather than retypes.
 */

/** What the pharmacist confirms before we create the product. */
export interface NewProductDraft {
  name: string;
  baseUnit: string;
  /** Optional pack: "sold in strips of 15". Blank factor = no pack defined. */
  packUnit: string;
  packFactor: string;
  mrp: string;
  gstPct: string;
  hsnCode: string;
  /** Optional classification — picked in the popup, not read off the bill. */
  categoryId: string | null;
  brandId: string | null;
}

/**
 * Base and pack unit names for the words distributors actually print.
 *
 * The base unit is what stock is COUNTED in (one tablet), the pack is how the
 * bill SELLS it (a strip of 15). Getting the base unit wrong is expensive and
 * permanent: the model defaults it to "pcs", and a product stuck on "pcs" can
 * never resolve a pack again — that's what booked "1 ml" for a 60ml bottle.
 */
const UNIT_WORDS: Record<string, { base: string; pack: string }> = {
  TAB: { base: "tablet", pack: "strip" },
  TABS: { base: "tablet", pack: "strip" },
  TABLET: { base: "tablet", pack: "strip" },
  CAP: { base: "capsule", pack: "strip" },
  CAPS: { base: "capsule", pack: "strip" },
  CAPSULE: { base: "capsule", pack: "strip" },
  ML: { base: "ml", pack: "bottle" },
  GM: { base: "gm", pack: "tube" },
  GRAM: { base: "gm", pack: "tube" },
  MG: { base: "mg", pack: "pack" },
  INJ: { base: "vial", pack: "box" },
  VIAL: { base: "vial", pack: "box" },
  AMP: { base: "ampoule", pack: "box" },
  SYP: { base: "ml", pack: "bottle" },
  SUSP: { base: "ml", pack: "bottle" },
  DROP: { base: "ml", pack: "bottle" },
  DROPS: { base: "ml", pack: "bottle" },
  SACHET: { base: "sachet", pack: "box" },
  KIT: { base: "kit", pack: "box" },
  PCS: { base: "pcs", pack: "box" },
};

/**
 * Reads a distributor's pack string into a count and a unit word.
 *
 * "1X30ML" means one box holding 30ml — the 30 is what matters, not the 1, so
 * an "A x B" form always takes B. Mirrors the server's `parsePackSize`.
 */
export function parsePack(
  pack: string | null,
): { count: number; word: string } | null {
  if (!pack) return null;
  const s = pack.toUpperCase().trim();

  const multi = s.match(/(\d+)\s*[X*]\s*(\d+)\s*([A-Z]+)/);
  if (multi) return { count: Number(multi[2]), word: multi[3] };

  const simple = s.match(/(\d+)\s*([A-Z]+)/);
  if (simple) return { count: Number(simple[1]), word: simple[2] };

  return null;
}

/**
 * The form's opening state, filled in from whatever the bill gave us.
 *
 * Everything here is a suggestion the pharmacist can overwrite — the bill is
 * evidence, not authority. A pack of 1 is left blank rather than written as a
 * pack, because "a strip of 1" is noise.
 */
export function draftFromLine(
  line: DraftLine,
  fallbackName = "",
): NewProductDraft {
  const bill = line.fromBill;
  const parsed = parsePack(bill?.pack || null);
  const words = parsed ? UNIT_WORDS[parsed.word] : null;

  return {
    name: bill?.productName?.trim() || fallbackName.trim(),
    baseUnit: words?.base || "pcs",
    packUnit: parsed && parsed.count > 1 ? words?.pack || "pack" : "",
    packFactor: parsed && parsed.count > 1 ? String(parsed.count) : "",
    mrp: bill?.mrp != null ? String(bill.mrp) : "",
    gstPct: bill?.gstPct != null ? String(bill.gstPct) : "",
    // A bill names neither — the pharmacist classifies it in the popup.
    categoryId: null,
    brandId: null,
    hsnCode: bill?.hsn || "",
  };
}

/** Only a name is truly required; everything else has a sane server default. */
export function draftIsValid(d: NewProductDraft): boolean {
  return d.name.trim().length > 0 && d.baseUnit.trim().length > 0;
}

/**
 * The create payload. Blank fields are omitted rather than sent as 0 or "" —
 * an absent MRP is unknown, and 0 would read as free.
 */
export function toCreatePayload(d: NewProductDraft) {
  const factor = Number(d.packFactor);
  const packs =
    d.packUnit.trim() && factor > 1
      ? [{ unit: d.packUnit.trim(), factor }]
      : undefined;

  const num = (v: string) => (v.trim() === "" ? undefined : Number(v));

  return {
    name: d.name.trim(),
    baseUnit: d.baseUnit.trim(),
    packs,
    mrp: num(d.mrp),
    // A product created mid-GRN used to reach the till at ₹0, because nothing
    // seeds a selling price and nothing blocks a ₹0 sale line. MRP is the legal
    // ceiling and the default counter price — the pharmacist can discount it.
    sellingPrice: num(d.mrp),
    taxRatePct: num(d.gstPct),
    hsnCode: d.hsnCode.trim() || undefined,
    categoryId: d.categoryId || undefined,
    brandId: d.brandId || undefined,
  };
}

/** The freshly-created product, in the shape the receive form's picker caches. */
export function toProductLite(created: {
  id: string;
  name: string;
  sku: string;
  baseUnit: string;
  packs?: { unit: string; factor: number }[];
}): ProductLite {
  return {
    id: created.id,
    name: created.name,
    sku: created.sku,
    baseUnit: created.baseUnit,
    packs: created.packs || [],
  };
}
