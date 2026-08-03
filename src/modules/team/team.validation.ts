import { z } from "zod";
import { freeText, optionalPhone } from "@shared/form/fields";

/**
 * Mirrors the server's createUserSchema field for field. It didn't, and the
 * gaps were exactly where "multiple validation errors while adding a member"
 * came from: the client accepted a 1-character first name and any phone string,
 * then the API rejected both — as a whole-form error, with nothing marked.
 */
export const addUserSchema = z.object({
  // Server: min(2). Accepting 1 here just relocated the failure.
  firstName: z.string().trim().min(2, "Enter at least 2 characters"),
  lastName: freeText,
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Enter a valid email"),
  phone: optionalPhone,
  password: z.string().min(6, "At least 6 characters"),
});

export type AddUserFormValues = z.infer<typeof addUserSchema>;
