import { z } from "zod";
import {
  requiredText,
  optionalEmail,
  optionalMobile,
  optionalGstin,
  freeText,
} from "@shared/form/fields";

export const supplierSchema = z.object({
  name: requiredText("Supplier name"),
  contactPerson: freeText,
  mobile: optionalMobile,
  email: optionalEmail,
  address: freeText,
  gstin: optionalGstin,
});

export type SupplierFormValues = z.infer<typeof supplierSchema>;
