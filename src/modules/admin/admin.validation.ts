import { z } from "zod";
import {
  requiredText,
  freeText,
  optionalNonNegative,
} from "@shared/form/fields";

export const adminLoginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});
export type AdminLoginValues = z.infer<typeof adminLoginSchema>;

export const createPharmacySchema = z.object({
  organizationName: z.string().trim().min(2, "Pharmacy name is required"),
  // Optional, but validated the moment something is typed — a GSTIN that the
  // server rejects would otherwise surface as a whole-form error with no field
  // marked. Same 15-character rule the API enforces.
  gstin: z
    .string()
    .trim()
    .refine(
      (v) =>
        v === "" ||
        /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/.test(v.toUpperCase()),
      "Enter a valid 15-character GSTIN",
    ),
  drugLicenseNo: z.string().trim().max(60, "Too long"),
  firstName: z.string().trim().min(1, "Owner first name is required"),
  lastName: z.string().trim(),
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Enter a valid email"),
  phone: z.string().trim(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});
export type CreatePharmacyValues = z.infer<typeof createPharmacySchema>;

/** Whole count; "" means not set. */
const optionalWhole = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d+$/.test(v), "Enter a whole number");

/** "" -> undefined so the server keeps its own default instead of storing 0. */
export const optionalNumber = (v: string) =>
  v.trim() === "" ? undefined : Number(v);

/**
 * A shared-catalogue entry. Every pharmacy imports from this, so a coerced
 * `Number("12..5") || 0` writing ₹0 MRP is not an acceptable failure mode —
 * non-numeric input is refused rather than rounded to nothing.
 *
 * packUnit/packQty/baseUnit/hsnCode feed product.service.createFromCatalog:
 * without them an imported product has no pack hierarchy, a "pcs" base unit
 * and a blank HSN on every invoice line.
 */
export const catalogProductSchema = z.object({
  sku: requiredText("SKU"),
  name: requiredText("Name"),
  saltComposition: freeText,
  manufacturerName: freeText,
  mrp: optionalNonNegative,
  productForm: freeText,
  packLabel: freeText,
  packUnit: freeText,
  packQty: optionalWhole,
  baseUnit: freeText,
  hsnCode: freeText,
  prescriptionRequired: z.boolean(),
});

export type CatalogProductValues = z.infer<typeof catalogProductSchema>;

export const planSchema = z.object({
  name: requiredText("Plan name"),
  code: requiredText("Code"),
  description: freeText,
  priceMonthly: optionalNonNegative,
  priceYearly: optionalNonNegative,
  maxUsers: optionalWhole,
  maxProducts: optionalWhole,
  features: freeText,

  /* How the plan is sold. `termMonths` and `priceTotal` are the two figures a
     price card is actually built from; the rest are decorations that derive
     themselves when left blank — see planDisplay.js on the server. */
  termMonths: optionalWhole,
  priceTotal: optionalNonNegative,
  referencePrice: optionalNonNegative,
  badge: freeText,
  tagline: freeText,
  sortOrder: optionalWhole,
  isFeatured: z.boolean(),
});

export type PlanValues = z.infer<typeof planSchema>;
