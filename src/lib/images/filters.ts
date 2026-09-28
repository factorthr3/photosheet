import { z } from "zod";

/** Library filter/sort definitions. Client-safe (no server imports). */

export const SORTS = [
  "uploaded_desc",
  "uploaded_asc",
  "taken_desc",
  "taken_asc",
  "name_asc",
  "name_desc",
] as const;
export type Sort = (typeof SORTS)[number];

export const SORT_LABELS: Record<Sort, string> = {
  uploaded_desc: "Newest uploads",
  uploaded_asc: "Oldest uploads",
  taken_desc: "Date taken (newest)",
  taken_asc: "Date taken (oldest)",
  name_asc: "Name (A–Z)",
  name_desc: "Name (Z–A)",
};

export const ORIENTATIONS = ["landscape", "portrait", "square"] as const;
export type Orientation = (typeof ORIENTATIONS)[number];

const csv = z
  .string()
  .optional()
  .transform((v) =>
    v
      ? v
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [],
  );

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional();

/** Library filters as they appear in the URL query string. */
export const filterSchema = z.object({
  q: z.string().trim().max(200).optional().default(""),
  tags: csv.pipe(z.array(z.string().max(64)).max(20)),
  board: z.string().uuid().optional(),
  uploader: z.string().max(64).optional(),
  from: isoDate,
  to: isoDate,
  dateField: z.enum(["uploaded", "taken"]).optional().default("uploaded"),
  orientation: z.enum(ORIENTATIONS).optional(),
  licence: z.enum(["restricted", "expired", "expiring"]).optional(),
  sort: z.enum(SORTS).optional().default("uploaded_desc"),
});

export type ImageFilters = z.infer<typeof filterSchema>;

export function parseFilters(params: URLSearchParams | Record<string, string | undefined>) {
  const obj =
    params instanceof URLSearchParams
      ? Object.fromEntries(params.entries())
      : Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined));
  return filterSchema.parse(obj);
}

const DEFAULTS: Partial<Record<keyof ImageFilters, string>> = {
  sort: "uploaded_desc",
  dateField: "uploaded",
};

/** Serialise filters back to a compact query string (defaults and empties omitted). */
export function filtersToSearchParams(f: Partial<ImageFilters>): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(f)) {
    if (value === undefined || value === null || value === "") continue;
    const str = Array.isArray(value) ? value.join(",") : String(value);
    if (!str || DEFAULTS[key as keyof ImageFilters] === str) continue;
    params.set(key, str);
  }
  if (!params.has("from") && !params.has("to")) params.delete("dateField");
  params.sort();
  return params;
}

/** Number of active filters (excluding search and sort), for the Filters button badge. */
export function activeFilterCount(f: ImageFilters): number {
  return (
    f.tags.length +
    (f.uploader ? 1 : 0) +
    (f.from || f.to ? 1 : 0) +
    (f.orientation ? 1 : 0) +
    (f.licence ? 1 : 0) +
    (f.board ? 1 : 0)
  );
}
