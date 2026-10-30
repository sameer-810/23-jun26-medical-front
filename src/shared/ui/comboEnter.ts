/**
 * What Enter means in a search box, decided from what is known at that moment.
 *
 * The list on screen is only an answer while `loading` is false: during the
 * debounce it still belongs to the previous query. Enter on typed text therefore
 * waits for this query's result. A scanner burst does not wait, because a gun
 * outruns the debounce and its code is rarely something a name search can find.
 */
export type EnterAction =
  | { kind: "pick"; index: number }
  | { kind: "raw" }
  | { kind: "wait" }
  | { kind: "none" };

export function enterAction(s: {
  text: string;
  /** Row the arrow keys are on, or -1. */
  highlighted: number;
  itemCount: number;
  loading: boolean;
  /** The keystrokes before this Enter arrived at scanner speed. */
  burst: boolean;
  hasRaw: boolean;
  /** Row to take when nothing is highlighted. */
  topIndex?: number;
}): EnterAction {
  if (s.highlighted >= 0 && s.highlighted < s.itemCount)
    return { kind: "pick", index: s.highlighted };
  if (!s.text) return { kind: "none" };
  if (s.burst && s.hasRaw) return { kind: "raw" };
  if (s.loading) return { kind: "wait" };
  if (s.itemCount > 0) return { kind: "pick", index: s.topIndex ?? 0 };
  return s.hasRaw ? { kind: "raw" } : { kind: "none" };
}

/**
 * The row Enter should take: one whose SKU or barcode IS the typed text, else
 * the top match. Search is a substring match, so "QA-14" also finds QA-140.
 */
export function topIndex(
  items: { codes?: (string | null | undefined)[] }[],
  text: string,
): number {
  const needle = text.trim().toLowerCase();
  const exact = items.findIndex((it) =>
    (it.codes || []).some((c) => c && c.toLowerCase() === needle),
  );
  return exact >= 0 ? exact : 0;
}
