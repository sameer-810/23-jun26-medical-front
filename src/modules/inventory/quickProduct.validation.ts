import { z } from "zod";
import {
  requiredText,
  freeText,
  optionalNonNegative,
  optionalPercent,
} from "@shared/form/fields";

/**
 * Quick-add-product (from a scanned bill). Same field shape as NewProductDraft,
 * now with rules — base unit is required because a product stuck on the default
 * "pcs" can never resolve a pack again.
 */
export const quickProductSchema = z.object({
  name: requiredText("Product name"),
  baseUnit: requiredText("Base unit"),
  packUnit: freeText,
  packFactor: optionalNonNegative,
  mrp: optionalNonNegative,
  gstPct: optionalPercent,
  // HSN is 4/6/8 digits under GST. Typing letters here produces an invoice
  // that fails GST validation at filing time, long after the mistake.
  hsnCode: z
    .string()
    .trim()
    .refine(
      (v) => v === "" || /^\d{4}(\d{2}(\d{2})?)?$/.test(v),
      "HSN is 4, 6 or 8 digits",
    ),
  categoryId: z.string().nullable(),
  brandId: z.string().nullable(),
});

export type QuickProductValues = z.infer<typeof quickProductSchema>;
