import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { ImageFilters, Sort } from "./filters";

export * from "./filters";

/**
 * Library search/filter/sort, shared by the grid API, "select all matching", bulk actions and
 * exports. Pagination is keyset-based (stable and fast at 10k+ images).
 */

/** Restricted licences show a warning badge (anything not freely usable). */
export const UNRESTRICTED_LICENCES = ["unlimited"];

/** Prisma `where` for an org's live library plus the given filters. */
export function buildWhere(
  orgId: string,
  f: ImageFilters,
  now: Date = new Date(),
): Prisma.ImageWhereInput {
  const and: Prisma.ImageWhereInput[] = [
    { orgId, deletedAt: null, status: { in: ["PROCESSING", "READY", "FAILED"] } },
  ];

  if (f.q) {
    const q = f.q;
    and.push({
      OR: [
        { filename: { contains: q, mode: "insensitive" } },
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { credit: { contains: q, mode: "insensitive" } },
        { tags: { has: q.toLowerCase() } },
      ],
    });
  }
  if (f.tags.length) and.push({ tags: { hasEvery: f.tags.map((t) => t.toLowerCase()) } });
  if (f.uploader) and.push({ uploaderId: f.uploader });

  if (f.from || f.to) {
    const range: { gte?: Date; lt?: Date } = {};
    if (f.from) range.gte = new Date(`${f.from}T00:00:00.000Z`);
    if (f.to) range.lt = new Date(new Date(`${f.to}T00:00:00.000Z`).getTime() + 86_400_000);
    and.push(f.dateField === "taken" ? { takenAt: range } : { createdAt: range });
  }

  if (f.orientation) {
    // Compare the two dimension columns directly (Prisma field references).
    const w = prisma.image.fields.width;
    const h = prisma.image.fields.height;
    if (f.orientation === "landscape") and.push({ width: { gt: h } });
    if (f.orientation === "portrait") and.push({ height: { gt: w } });
    if (f.orientation === "square") and.push({ width: { equals: h } });
  }

  if (f.licence === "restricted") {
    and.push({ licence: { not: null }, NOT: { licence: { in: UNRESTRICTED_LICENCES } } });
  } else if (f.licence === "expired") {
    and.push({ licenceExpiresAt: { lte: now } });
  } else if (f.licence === "expiring") {
    and.push({ licenceExpiresAt: { gt: now, lte: new Date(now.getTime() + 30 * 86_400_000) } });
  }

  return { AND: and };
}

// ─── Sorting + keyset cursors ──────────────────────────────────────────────────

type SortField = "createdAt" | "takenAt" | "filename" | "id";
interface KeyPart {
  field: SortField;
  dir: "asc" | "desc";
  nullable?: boolean;
}

const SORT_KEYS: Record<Sort, KeyPart[]> = {
  uploaded_desc: [
    { field: "createdAt", dir: "desc" },
    { field: "id", dir: "desc" },
  ],
  uploaded_asc: [
    { field: "createdAt", dir: "asc" },
    { field: "id", dir: "asc" },
  ],
  taken_desc: [
    { field: "takenAt", dir: "desc", nullable: true },
    { field: "createdAt", dir: "desc" },
    { field: "id", dir: "desc" },
  ],
  taken_asc: [
    { field: "takenAt", dir: "asc", nullable: true },
    { field: "createdAt", dir: "asc" },
    { field: "id", dir: "asc" },
  ],
  name_asc: [
    { field: "filename", dir: "asc" },
    { field: "id", dir: "asc" },
  ],
  name_desc: [
    { field: "filename", dir: "desc" },
    { field: "id", dir: "desc" },
  ],
};

export function buildOrderBy(sort: Sort): Prisma.ImageOrderByWithRelationInput[] {
  return SORT_KEYS[sort].map((k) =>
    k.nullable ? { [k.field]: { sort: k.dir, nulls: "last" } } : { [k.field]: k.dir },
  );
}

type CursorValue = string | null;
type SortableRow = { id: string; createdAt: Date; takenAt: Date | null; filename: string };

function serialize(v: Date | string | null): CursorValue {
  return v instanceof Date ? v.toISOString() : v;
}

export function encodeCursor(sort: Sort, row: SortableRow): string {
  const values = SORT_KEYS[sort].map((k) => serialize(row[k.field]));
  return Buffer.from(JSON.stringify([sort, ...values])).toString("base64url");
}

export function decodeCursor(sort: Sort, cursor: string): CursorValue[] | null {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (!Array.isArray(parsed) || parsed[0] !== sort) return null;
    const values = parsed.slice(1);
    if (values.length !== SORT_KEYS[sort].length) return null;
    if (!values.every((v: unknown) => v === null || typeof v === "string")) return null;
    return values;
  } catch {
    return null;
  }
}

function toValue(field: SortField, v: string) {
  return field === "createdAt" || field === "takenAt" ? new Date(v) : v;
}

/**
 * Rows strictly after the cursor in the given order. For nullable keys, nulls sort last:
 * after a non-null value come smaller/larger values and then all nulls; after null, nothing
 * but further nulls (handled by the equality chain).
 */
export function cursorWhere(sort: Sort, values: CursorValue[]): Prisma.ImageWhereInput {
  const parts = SORT_KEYS[sort];
  const or: Prisma.ImageWhereInput[] = [];

  for (let i = 0; i < parts.length; i++) {
    const eqs: Prisma.ImageWhereInput[] = parts.slice(0, i).map((p, j) => ({
      [p.field]: values[j] === null ? null : toValue(p.field, values[j]!),
    }));
    const { field, dir, nullable } = parts[i];
    const v = values[i];
    let after: Prisma.ImageWhereInput | null;
    if (v === null) {
      after = null; // nothing sorts after null (nulls last)
    } else {
      const cmp = { [field]: { [dir === "desc" ? "lt" : "gt"]: toValue(field, v) } };
      after = nullable ? { OR: [cmp, { [field]: null }] } : cmp;
    }
    if (after) or.push({ AND: [...eqs, after] });
  }
  return or.length ? { OR: or } : { id: { in: [] } };
}
