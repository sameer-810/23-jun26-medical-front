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
  hsnCode: freeText,
});

export type QuickProductValues = z.infer<typeof quickProductSchema>;
