import { z } from "zod";
import { MAX_TAGS, normalizeTags } from "./tags";

/** "" → null so clearing a field in a form removes the value. */
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((v) => (v ? v : null));

/** YYYY-MM-DD → midnight UTC. The licence is expired from that date onwards. */
const expiryDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .nullable()
  .transform((v) => (v ? new Date(`${v}T00:00:00.000Z`) : null));

export const metadataShape = {
  title: text(300),
  description: text(5000),
  credit: text(300),
  copyright: text(300),
  licence: text(200),
  licenceExpiresAt: expiryDate,
};

/** Single-image edit: any subset of fields; `tags` replaces the whole list. */
export const updateImageSchema = z
  .object({
    ...metadataShape,
    tags: z.array(z.string().max(200)).max(200).transform(normalizeTags),
  })
  .partial();

export type ImageUpdate = z.infer<typeof updateImageSchema>;

/** Bulk edit: only the fields present in `set` change; tags are added/removed, not replaced. */
export const bulkUpdateSchema = z
  .object({
    imageIds: z.array(z.string()).min(1).max(10_000),
    set: z.object(metadataShape).partial().default({}),
    addTags: z.array(z.string().max(200)).max(MAX_TAGS).default([]).transform(normalizeTags),
    removeTags: z.array(z.string().max(200)).max(200).default([]).transform(normalizeTags),
  })
  .refine(
    (b) => Object.keys(b.set).length > 0 || b.addTags.length > 0 || b.removeTags.length > 0,
    "Nothing to change",
  );

export type BulkUpdate = z.infer<typeof bulkUpdateSchema>;

/** Date → "YYYY-MM-DD" for date inputs. */
export function toDateInput(value: string | Date | null | undefined): string {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}
