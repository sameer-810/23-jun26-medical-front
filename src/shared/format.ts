/**
 * Shared number/currency formatting — thousands separators + sensible rounding
 * so big numbers never render as bare "31544" / "5164.97" debug output.
 */
const inr = (n: number) => Math.round(n).toLocaleString("en-IN");

const exact = (n: number) =>
  n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/**
 * The sign goes in front of everything, as the true minus the bills print:
 * −₹320.25, never ₹-320.25. Decided after rounding, so a −0.001 float residue
 * reads as zero rather than as a negative nothing.
 */
const signed = (n: number, body: (abs: number) => string) => {
  const text = body(Math.abs(n));
  return n < 0 && /[1-9]/.test(text) ? `−${text}` : text;
};

/** Integer count with thousands separators: 31544 → "31,544". */
export const fmtInt = (n: number | null | undefined) => inr(Number(n) || 0);

/** Rounded quantity with separators: 5164.97 → "5,165". */
export const fmtQty = (n: number | null | undefined) => inr(Number(n) || 0);

/**
 * A figure kept to at most `maxDp` places: 4999605.917 → "49,99,605.92". For
 * base-unit quantities, stored to 3dp, where `fmtQty` would hide real fractions
 * of a pack and the raw number reads as debug output.
 */
export const fmtNumber = (n: number | null | undefined, maxDp = 2) =>
  signed(Number(n) || 0, (abs) =>
    abs.toLocaleString("en-IN", { maximumFractionDigits: maxDp }),
  );

/** "1 sale", "2 sales", "31,544 sales". Irregular plurals pass `many`. */
export const fmtCount = (
  n: number | null | undefined,
  one: string,
  many = `${one}s`,
) => `${fmtInt(n)} ${Number(n) === 1 ? one : many}`;

/** "products" → "product", "entries" → "entry". For a noun passed in plural. */
export const singularNoun = (plural: string) =>
  plural.replace(/ies$/, "y").replace(/s$/, "");

/** Rupee amount, rounded: 81696.92 → "₹81,697". Headline figures only. */
export const fmtMoney = (n: number | null | undefined) =>
  signed(Number(n) || 0, (abs) => `₹${inr(abs)}`);

/**
 * Rupee amount to the paisa: 128.92 → "₹128.92", 5055.8 → "₹5,055.80".
 *
 * Anything that has to be checked line-by-line against a piece of paper uses
 * this, never `fmtMoney`. A distributor invoice prints 2 × 64.46 = 128.92 and
 * settles to the paisa; a goods-received note showing "₹129" beside it cannot
 * be reconciled, and the 8 paise it hides is exactly what a supplier query is
 * about. Rounding is a presentation choice for dashboards — on a document it
 * is a defect.
 */
export const fmtMoneyExact = (n: number | null | undefined) =>
  signed(Number(n) || 0, (abs) => `₹${exact(abs)}`);

/** Same, without the ₹ — for cells in a money column that already says so. */
export const fmtAmountExact = (n: number | null | undefined) =>
  signed(Number(n) || 0, exact);

/**
 * Dates. One format everywhere: DD-MM-YYYY, IST, whatever locale the machine
 * is set to. The default `toLocaleString()` follows the OS, so the same
 * invoice prints 03-04-2026 here and 04/03/2026 on an en-US desktop — two
 * different days on a statutory document.
 */
export type DateInput = string | number | Date | null | undefined;

const IST = "Asia/Kolkata";

const asDate = (v: DateInput): Date | null => {
  if (v == null || v === "") return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** "2026-08-22T…" → "22-08-2026". Missing/unparseable → "—". */
export const fmtDate = (v: DateInput) => {
  const d = asDate(v);
  if (!d) return "—";
  /**
   * A value stored at exactly UTC midnight is a DATE ONLY — an expiry, a
   * manufacturing date — carrying no meaningful time. Reinterpreting it in
   * another zone can shift it a day, and an expiry printed a day out is a
   * dispensing-safety problem, so it is rendered as the day it was stored.
   * Everything else is a real instant (a sale rung at 00:01 IST belongs to
   * today) and is resolved in IST.
   */
  const iso = d.toISOString();
  if (iso.endsWith("T00:00:00.000Z")) {
    const [y, m, day] = iso.slice(0, 10).split("-");
    return `${day}-${m}-${y}`;
  }
  // en-GB is DD/MM/YYYY in every ICU build; the separator is ours.
  return d
    .toLocaleDateString("en-GB", {
      timeZone: IST,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
    .replace(/\//g, "-");
};

/** "22-08-2026 14:05" — 24-hour, IST. Missing/unparseable → "—". */
export const fmtDateTime = (v: DateInput) => {
  const d = asDate(v);
  if (!d) return "—";
  const time = d.toLocaleTimeString("en-GB", {
    timeZone: IST,
    hour: "2-digit",
    minute: "2-digit",
    // h23, not `hour12: false` — that renders midnight as 24:05 in some builds.
    hourCycle: "h23",
  });
  return `${fmtDate(d)} ${time}`;
};

/**
 * The calendar day a value falls on, in the business zone, as "YYYY-MM-DD".
 *
 * Same split as `fmtDate`: a UTC-midnight value is a stored DATE and is read
 * back as written; anything else is an instant resolved in IST. Sortable and
 * comparable as a plain string.
 */
export const businessYmd = (v: DateInput): string | null => {
  const d = asDate(v);
  if (!d) return null;
  const iso = d.toISOString();
  if (iso.endsWith("T00:00:00.000Z")) return iso.slice(0, 10);
  // en-CA is YYYY-MM-DD in every ICU build.
  return d.toLocaleDateString("en-CA", { timeZone: IST });
};

/** Today, in the business zone. */
export const todayYmd = () => businessYmd(new Date()) as string;

/**
 * Is this "YYYY-MM-DD" range back to front? Such a query can only come back
 * empty, which reads as "nothing happened in that period" — a false statement
 * about the books. An open end is not inverted.
 */
export const isInvertedRange = (from?: string | null, to?: string | null) => {
  const start = (from ?? "").trim();
  const end = (to ?? "").trim();
  return Boolean(start && end && start > end);
};

/**
 * Is this lot past its expiry date?
 *
 * Stock is sellable THROUGH its expiry date — the server's cutoff is the start
 * of today's business day, not the current instant. Comparing against `now`
 * instead (which the offline fallback used to do) makes a lot expiring TODAY
 * sellable online and refused offline: the till disagrees with itself on the
 * one day a pharmacist is most likely to be clearing that lot. A lot with no
 * expiry never expires.
 */
export const isExpiredLot = (expiry: DateInput): boolean => {
  const day = businessYmd(expiry);
  return day != null && day < todayYmd();
};
