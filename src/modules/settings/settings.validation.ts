import { z } from "zod";
import {
  freeText,
  optionalEmail,
  optionalGstin,
  optionalPercent,
} from "@shared/form/fields";

/**
 * All settings in one flat form so the screen populates on load with a single
 * reset(). Only the fields with a real format (email, GSTIN, GST rate) carry
 * rules; the rest are free text or on/off switches.
 */
export const settingsSchema = z.object({
  legalName: freeText,
  addressLine1: freeText,
  city: freeText,
  state: freeText,
  pincode: freeText,
  phone: freeText,
  email: optionalEmail,
  drugLicenseNo: freeText,
  gstin: optionalGstin,
  signatureLabel: freeText,
  taxEnabled: z.boolean(),
  defaultRatePct: optionalPercent,
  invoicePrefix: freeText,
  priceIncludesTax: z.boolean(),
  alertInApp: z.boolean(),
  alertEmail: z.boolean(),
  alertSms: z.boolean(),
});

export type SettingsFormValues = z.infer<typeof settingsSchema>;
