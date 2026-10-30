/**
 * The one sentence that says why Complete sale won't go.
 *
 * The screen has a banner for each of these further up, but a disabled button
 * with its reason below the fold reads as a broken till. This sits beside the
 * button, so it has to be short, and fixing the top one reveals the next.
 */
export function saleBlocker(s: {
  itemCount: number;
  blankQtyName?: string | null;
  shortName?: string | null;
  priceIssue?: string | null;
  creditNeedsCustomer?: boolean;
}): string | null {
  if (s.itemCount === 0) return null;
  if (s.blankQtyName) return `${s.blankQtyName}: enter a quantity or remove it`;
  if (s.shortName) return `${s.shortName}: not enough stock`;
  if (s.priceIssue) return s.priceIssue;
  if (s.creditNeedsCustomer) return "Credit needs a customer";
  return null;
}
