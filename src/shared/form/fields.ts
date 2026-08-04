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

/**
 * Strips the separators people actually type into a phone box.
 * "+91 98765-43210" -> "+919876543210". Export it so a form can send the
 * normalised value, not just validate it.
 */
export const normalizePhone = (v: string) => {
  const s = String(v || "").trim();
  const digits = s.replace(/[^\d]/g, "");
  return s.startsWith("+") ? `+${digits}` : digits;
};

/**
 * A phone the SERVER will accept: `/^\+?[1-9]\d{7,14}$/`.
 *
 * The rule is duplicated here on purpose. When the client validated this as
 * free text, anything with a space, a dash or a leading zero sailed through the
 * form and was rejected by the API — which surfaced as "valid input rejected"
 * with a raw server error and no field highlighted. A client rule looser than
 * the server's isn't lenient, it just moves the error somewhere unhelpful.
 */
export const optionalPhone = optional((v) => {
  const n = normalizePhone(v);
  // With a country code, trust the server's range (8–15 digits).
  if (n.startsWith("+")) return /^\+[1-9]\d{7,14}$/.test(n);
  // Without one it's an Indian mobile: exactly 10 digits, starting 6–9.
  // Allowing 11–15 bare digits here let "12345678901" through — long enough to
  // satisfy the server, still not a number anyone can ring.
  return /^[6-9]\d{9}$/.test(n);
}, "Enter a 10-digit mobile number, or include the country code (+91…)");

// Numeric inputs are strings from a TextField; "" means "not set".
export const optionalNonNegative = optional(
  (v) => Number.isFinite(Number(v)) && Number(v) >= 0,
  "Enter a valid amount",
);

export const optionalPercent = optional(
  (v) => Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 100,
  "Enter a number from 0 to 100",
);
