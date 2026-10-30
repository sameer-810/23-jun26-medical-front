/**
 * What a sale's status reads as. The wording matches the filter chips on the
 * invoice list, so a row says the same thing as the chip that selected it.
 */
const LABELS: Record<string, string> = {
  completed: "Completed",
  partially_returned: "Part-returned",
  returned: "Returned",
};

export const saleStatusLabel = (status: string) =>
  LABELS[status] ?? status.replace(/_/g, " ");
