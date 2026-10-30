/**
 * The unfinished bill, kept on the device.
 *
 * The cart lives in component state, so a refresh, a back-button slip or an
 * expired session threw away everything rung up for the person at the counter.
 * It is saved per org AND user: a shared till must not hand one cashier's bill
 * to the next. The stored prices are a snapshot, so restoring re-checks them.
 */
const PREFIX = "medstock-sale-draft:";
const VERSION = 1;
/** Past a day this is not a bill in progress, it is a stray. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export const draftKey = (orgId: string, userId: string) =>
  `${PREFIX}${orgId}:${userId}`;

export const isDraftKey = (key: string) => key.startsWith(PREFIX);

export interface SaleDraft<Line, Product, Customer> {
  /** Kept across retries and reloads, so the same bill can never post twice. */
  opId: string;
  lines: Line[];
  products: Record<string, Product>;
  customerId: string | null;
  customer: Customer | null;
  doctorName: string;
  prescriptionId: string | null;
  taxType: "intra" | "inter";
  paymentMode: string;
  refillDays: string;
}

export function serializeDraft<L, P, C>(
  draft: SaleDraft<L, P, C>,
  now = Date.now(),
): string {
  return JSON.stringify({ ...draft, v: VERSION, savedAt: now });
}

/** A damaged, stale or foreign draft is simply no draft. */
export function parseDraft<L extends { productId: string }, P, C>(
  raw: string | null | undefined,
  now = Date.now(),
): SaleDraft<L, P, C> | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw);
    if (d?.v !== VERSION || typeof d.opId !== "string") return null;
    if (!(now - Number(d.savedAt) <= MAX_AGE_MS)) return null;
    if (!Array.isArray(d.lines) || d.lines.length === 0) return null;
    if (!d.lines.every((l: L) => typeof l?.productId === "string")) return null;
    return { ...d, products: d.products || {} };
  } catch {
    return null;
  }
}
