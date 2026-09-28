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

/** A board's manual (drag-and-drop) order. Only meaningful inside a board. */
export const MANUAL_SORT = "manual" as const;
export type FeedSort = Sort | typeof MANUAL_SORT;

export const SORT_LABELS: Record<FeedSort, string> = {
  manual: "Board order",
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
  sort: z
    .enum([...SORTS, MANUAL_SORT])
    .optional()
    .default("uploaded_desc"),
});

export type ImageFilters = z.infer<typeof filterSchema>;

export function parseFilters(
  params: URLSearchParams | Record<string, string | undefined>,
  opts: { defaultSort?: FeedSort } = {},
) {
  const obj: Record<string, string> =
    params instanceof URLSearchParams
      ? Object.fromEntries(params.entries())
      : (Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined)) as Record<
          string,
          string
        >);
  if (!obj.sort && opts.defaultSort) obj.sort = opts.defaultSort;
  return filterSchema.parse(obj);
}

/** Serialise filters back to a compact query string (defaults and empties omitted). */
export function filtersToSearchParams(
  f: Partial<ImageFilters>,
  opts: { defaultSort?: FeedSort } = {},
): URLSearchParams {
  const defaults: Partial<Record<keyof ImageFilters, string>> = {
    sort: opts.defaultSort ?? "uploaded_desc",
    dateField: "uploaded",
  };
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(f)) {
    if (value === undefined || value === null || value === "") continue;
    const str = Array.isArray(value) ? value.join(",") : String(value);
    if (!str || defaults[key as keyof ImageFilters] === str) continue;
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

/**
 * The query string an image feed requests. Always carries an explicit sort so the API doesn't
 * need to know each page's default. Used for both the SSR first page and client fetches.
 */
export function feedQuery(f: ImageFilters, defaultSort: FeedSort): string {
  const p = filtersToSearchParams(f, { defaultSort });
  p.set("sort", f.sort);
  p.sort();
  return p.toString();
}
