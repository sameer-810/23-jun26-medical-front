import { z } from "zod";
import { requiredText, freeText } from "@shared/form/fields";

export const addUserSchema = z.object({
  firstName: requiredText("First name"),
  lastName: freeText,
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Enter a valid email"),
  // Lenient on purpose — a staff phone may carry a +91 prefix or extension.
  phone: freeText,
  password: z.string().min(6, "At least 6 characters"),
});

export type AddUserFormValues = z.infer<typeof addUserSchema>;
