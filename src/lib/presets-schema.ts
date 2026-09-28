import { z } from "zod";
import { canonicalParams } from "@/lib/image/render-params";

/** A preset is a name plus canonical render params. */
export const presetSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(60),
    width: z.number().int().nullable().optional(),
    height: z.number().int().nullable().optional(),
    fit: z.string().optional(),
    format: z.string().optional(),
    quality: z.number().int().optional(),
    stripMetadata: z.boolean().optional(),
  })
  .transform(({ name, ...rest }, ctx) => {
    try {
      return { name, ...canonicalParams(rest as Parameters<typeof canonicalParams>[0]) };
    } catch (err) {
      ctx.addIssue({
        code: "custom",
        message: (err as z.ZodError).issues?.[0]?.message ?? "Invalid preset",
      });
      return z.NEVER;
    }
  });
