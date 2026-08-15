import { z } from "zod";

/**
 * Auth form rules.
 *
 * Messages are written to be read by the person filling the form, not a
 * developer — they surface inline under each field. Kept in step with the
 * backend's own validation so the client catches what the server would anyway,
 * before a round-trip.
 */

const email = z
  .string()
  .trim()
  .min(1, "Email is required")
  .email("Enter a valid email");

// Length only on the client — the server holds the real password policy.
const newPassword = z.string().min(6, "At least 6 characters");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required"),
});

export const signupSchema = z.object({
  organizationName: z.string().trim().min(1, "Workspace name is required"),
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim(),
  email,
  /**
   * Both required, matching the server.
   *
   * A registration is a quotation request before it is an account, and one
   * with no way to reach the applicant just sits in the queue until someone
   * deletes it.
   */
  personalEmail: z
    .string()
    .trim()
    .min(1, "Personal email is required")
    .email("Enter a valid email"),
  phone: z
    .string()
    .trim()
    .min(1, "Phone number is required")
    .regex(
      /^\+?[1-9]\d{7,14}$/,
      "Include the country code, e.g. +91 98765 43210",
    ),
  password: newPassword,
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(1, "Enter the reset code from your email"),
  password: newPassword,
});
