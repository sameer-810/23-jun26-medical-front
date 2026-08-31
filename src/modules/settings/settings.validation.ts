import { z } from "zod";
import {
  freeText,
  optionalEmail,
  optionalGstin,
  optionalPercent,
} from "@shared/form/fields";

/** "90, 60, 30" -> ["90","60","30"]. Blank entries are dropped, not kept. */
export const splitList = (v: string) =>
  v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export const parseDays = (v: string) => splitList(v).map(Number);
export const parseUnits = splitList;

// Server: array of 1–365 integers, at most 6.
const dayList = z
  .string()
  .trim()
  .refine((v) => splitList(v).length > 0, "Enter at least one number of days")
  .refine((v) => splitList(v).length <= 6, "At most 6 thresholds")
  .refine(
    (v) =>
      splitList(v).every(
        (d) => /^\d+$/.test(d) && Number(d) >= 1 && Number(d) <= 365,
      ),
    "Use whole numbers of days from 1 to 365",
  );

// Server: array of 1–20 character names, at most 40.
const unitList = z
  .string()
  .trim()
  .refine((v) => splitList(v).length > 0, "Keep at least one unit")
  .refine((v) => splitList(v).length <= 40, "At most 40 units")
  .refine(
    (v) => splitList(v).every((u) => u.length <= 20),
    "Each unit must be 20 characters or fewer",
  );

const wholeNumber = z
  .string()
  .trim()
  .refine((v) => /^\d+$/.test(v), "Enter a whole number");

/**
 * All settings in one flat form so the screen populates on load with a single
 * reset(). Only the fields with a real format (email, GSTIN, GST rate) carry
 * rules; the rest are free text or on/off switches.
 *
 * List fields are edited as comma-separated text and parsed on save.
 */
export const settingsSchema = z.object({
  legalName: freeText,
  addressLine1: freeText,
  addressLine2: freeText,
  city: freeText,
  state: freeText,
  pincode: freeText,
  phone: freeText,
  email: optionalEmail,
  drugLicenseNo: freeText,
  drugLicenseNo2: freeText,
  gstin: optionalGstin,
  jurisdiction: freeText,
  pharmacistName: freeText,
  mobile: freeText,
  signatureLabel: freeText,
  documentType: z.enum(["tax_invoice", "bill_of_supply"]),
  printLayout: z.enum(["a4", "text80"]),
  printCopies: z.enum(["single", "duplicate"]),
  guideOnBill: z.boolean(),
  taxEnabled: z.boolean(),
  defaultRatePct: optionalPercent,
  invoicePrefix: freeText,
  priceIncludesTax: z.boolean(),
  currency: z.string().trim().max(8, "Use a short code like INR"),
  expiryAlertDays: dayList,
  units: unitList,
  defaultReorderLevel: wholeNumber,
  alertInApp: z.boolean(),
  alertEmail: z.boolean(),
  alertSms: z.boolean(),
  backupEmail: optionalEmail,
});

export type SettingsFormValues = z.infer<typeof settingsSchema>;

/** Field name -> what the user sees, for the invalid-submit banner. */
export const SETTINGS_FIELD_LABELS: Record<
  keyof SettingsFormValues | string,
  string
> = {
  legalName: "Legal name",
  addressLine1: "Address line 1",
  addressLine2: "Address line 2",
  city: "City",
  state: "State",
  pincode: "PIN",
  phone: "Phone",
  email: "Email",
  drugLicenseNo: "Drug license no.",
  drugLicenseNo2: "Drug license no. 2",
  gstin: "GSTIN",
  jurisdiction: "Jurisdiction city",
  pharmacistName: "Pharmacist name",
  mobile: "Mobile",
  signatureLabel: "Signature caption",
  documentType: "Document type",
  printLayout: "Bill layout",
  printCopies: "Copies",
  defaultRatePct: "Default GST rate",
  invoicePrefix: "Invoice prefix",
  currency: "Currency",
  expiryAlertDays: "Expiry alert thresholds",
  units: "Units",
  defaultReorderLevel: "Default reorder level",
  backupEmail: "Backup email",
};
