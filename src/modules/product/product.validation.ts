import { z } from "zod";
import {
  requiredText,
  freeText,
  optionalNonNegative,
  optionalPercent,
} from "@shared/form/fields";

/**
 * The whole product form. Text/number fields carry real rules; the selection
 * controls (category, brand, schedule, packs, the Rx switch) can't be
 * "invalid" but still live in the form, so the edit screen populates with a
 * single reset() and keeps one source of truth.
 */
export const productSchema = z.object({
  name: requiredText("Product name"),
  sku: freeText,
  barcode: freeText,
  saltComposition: freeText,
  baseUnit: requiredText("Base unit"),
  sellingPrice: optionalNonNegative,
  mrp: optionalNonNegative,
  taxRatePct: optionalPercent,
  hsnCode: freeText,
  reorderLevel: optionalNonNegative,
  categoryId: z.string().nullable(),
  brandId: z.string().nullable(),
  scheduleDrug: z.string(),
  prescriptionRequired: z.boolean(),
  packs: z.array(z.object({ unit: z.string(), factor: z.number() })),
});

export type ProductFormValues = z.infer<typeof productSchema>;
