import "server-only";
import { HttpError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { type ImageListItem, toListItem } from "@/lib/images/dto";
import {
  buildOrderBy,
  buildWhere,
  cursorWhere,
  decodeCursor,
  encodeCursor,
  type ImageFilters,
} from "@/lib/images/query";

export interface ImagePage {
  images: ImageListItem[];
  nextCursor: string | null;
  /** Only computed for the first page. */
  total: number | null;
}

export async function listImages(
  orgId: string,
  filters: ImageFilters,
  opts: { cursor?: string; limit?: number } = {},
): Promise<ImagePage> {
  const limit = opts.limit ?? 60;
  const where = buildWhere(orgId, filters);
  let pageWhere = where;
  if (opts.cursor) {
    const values = decodeCursor(filters.sort, opts.cursor);
    if (!values) throw new HttpError(400, "Invalid cursor", "invalid");
    pageWhere = { AND: [where, cursorWhere(filters.sort, values)] };
  }
  const [rows, total] = await Promise.all([
    prisma.image.findMany({ where: pageWhere, orderBy: buildOrderBy(filters.sort), take: limit }),
    opts.cursor ? Promise.resolve(null) : prisma.image.count({ where }),
  ]);
  return {
    images: await Promise.all(rows.map(toListItem)),
    nextCursor: rows.length === limit ? encodeCursor(filters.sort, rows[rows.length - 1]) : null,
    total,
  };
}

/** Most-used tags in the org, for the filter picker. */
export async function topTags(orgId: string, limit = 100) {
  const rows = await prisma.$queryRaw<{ tag: string; count: bigint }[]>`
    SELECT t.tag, COUNT(*)::bigint AS count
    FROM image i, unnest(i.tags) AS t(tag)
    WHERE i."orgId" = ${orgId} AND i."deletedAt" IS NULL
    GROUP BY t.tag
    ORDER BY count DESC, t.tag ASC
    LIMIT ${limit}`;
  return rows.map((r) => ({ tag: r.tag, count: Number(r.count) }));
}

/** Org members, for the uploader filter. */
export async function orgPeople(orgId: string) {
  const members = await prisma.member.findMany({
    where: { organizationId: orgId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { user: { name: "asc" } },
  });
  return members.map((m) => ({ id: m.user.id, name: m.user.name || m.user.email }));
}
