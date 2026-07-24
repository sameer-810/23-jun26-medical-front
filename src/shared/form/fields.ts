import { z } from "zod";

/**
 * Reusable zod field rules, shared across forms so a "valid email" or an Indian
 * mobile means the same thing everywhere. Messages read like a person wrote
 * them — they surface inline under the field.
 *
 * Optional fields accept "" (a controlled input's empty value) but validate the
 * format the moment something is typed. Using a refine keeps whitespace-only
 * input from sneaking past a naive `.or(z.literal(""))`.
 */

const optional = (test: (v: string) => boolean, message: string) =>
  z
    .string()
    .trim()
    .refine((v) => v === "" || test(v), message);

export const requiredText = (label: string) =>
  z.string().trim().min(1, `${label} is required`);

export const optionalEmail = optional(
  (v) => z.string().email().safeParse(v).success,
  "Enter a valid email",
);

// Indian mobile: 10 digits, first digit 6–9.
export const optionalMobile = optional(
  (v) => /^[6-9]\d{9}$/.test(v),
  "Enter a 10-digit mobile number",
);

// GSTIN: 15 chars — 2-digit state, 10-char PAN, entity digit, 'Z', checksum.
export const optionalGstin = optional(
  (v) => /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/.test(v),
  "Enter a valid 15-character GSTIN",
);

export const freeText = z.string().trim();

// Numeric inputs are strings from a TextField; "" means "not set".
export const optionalNonNegative = optional(
  (v) => Number.isFinite(Number(v)) && Number(v) >= 0,
  "Enter a valid amount",
);

export const optionalPercent = optional(
  (v) => Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 100,
  "Enter a number from 0 to 100",
);
