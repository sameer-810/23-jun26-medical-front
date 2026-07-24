import { z } from "zod";

/**
 * Location form. Name is optional when CREATING (the server auto-names a blank
 * one), but required when RENAMING — you can't rename something to nothing. The
 * mode travels in the form values so this single schema can express both.
 */
export const locationSchema = z
  .object({
    name: z.string().trim(),
    type: z.string(),
    mode: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.mode === "rename" && v.name.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["name"],
        message: "Name is required",
      });
    }
  });

export type LocationFormValues = z.infer<typeof locationSchema>;
