/**
 * What a money or quantity box may hold: digits and one dot.
 *
 * `Number()` is too generous to validate with: "1e3" is 1000, so a slipped key
 * billed a thousand units, and "abc" fell through to 0 and looked like a free
 * line. Filtering at the keystroke means the box can only show what will bill.
 */
export function sanitizeDecimal(v: string): string {
  const clean = String(v ?? "").replace(/[^0-9.]/g, "");
  const dot = clean.indexOf(".");
  if (dot < 0) return clean;
  return clean.slice(0, dot + 1) + clean.slice(dot + 1).replace(/\./g, "");
}
