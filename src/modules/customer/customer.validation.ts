import { z } from "zod";
import {
  requiredText,
  optionalEmail,
  optionalMobile,
  optionalGstin,
  freeText,
} from "@shared/form/fields";

export const customerSchema = z.object({
  name: requiredText("Name"),
  mobile: optionalMobile,
  email: optionalEmail,
  address: freeText,
  gstin: optionalGstin,
});

export type CustomerFormValues = z.infer<typeof customerSchema>;
