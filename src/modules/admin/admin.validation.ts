import { z } from "zod";

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
