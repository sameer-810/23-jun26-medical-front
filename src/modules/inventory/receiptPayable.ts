/**
 * What a receipt actually cost: the foot of the bill, not the AMOUNT column.
 *
 * `totalValue` is goods before discount and GST, so ₹3,800 on a bill payable at
 * ₹3,858 cannot be read against the supplier's paper. Receipts booked before
 * the foot was stored hold 0 there; those fall back to what they do have.
 */
export const receiptPayable = (r: {
  netPayable?: number;
  grandTotal?: number;
  totalValue: number;
}) => r.netPayable || r.grandTotal || r.totalValue;
