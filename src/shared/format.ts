/**
 * Shared number/currency formatting — thousands separators + sensible rounding
 * so big numbers never render as bare "31544" / "5164.97" debug output.
 */
const inr = (n: number) => Math.round(n).toLocaleString("en-IN");

/** Integer count with thousands separators: 31544 → "31,544". */
export const fmtInt = (n: number | null | undefined) => inr(Number(n) || 0);

/** Rounded quantity with separators: 5164.97 → "5,165". */
export const fmtQty = (n: number | null | undefined) => inr(Number(n) || 0);

/** Rupee amount, rounded: 81696.92 → "₹81,697". */
export const fmtMoney = (n: number | null | undefined) =>
  `₹${inr(Number(n) || 0)}`;
