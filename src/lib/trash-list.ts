import "server-only";
import { HttpError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { type ImageListItem, toListItem } from "@/lib/images/dto";
import { daysLeftInTrash } from "@/lib/trash";

export interface TrashItem extends ImageListItem {
  deletedAt: string;
  deletedBy: string | null;
  daysLeft: number;
}

const PAGE = 60;

function encode(deletedAt: Date, id: string) {
  return Buffer.from(JSON.stringify([deletedAt.toISOString(), id])).toString("base64url");
}

function decode(cursor: string): [Date, string] {
  try {
    const [d, id] = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    return [new Date(d), String(id)];
  } catch {
    throw new HttpError(400, "Invalid cursor", "invalid");
  }
}

/** Trash, newest deletion first, keyset-paged on (deletedAt, id). */
export async function listTrash(orgId: string, cursor?: string) {
  const after = cursor ? decode(cursor) : null;
  const rows = await prisma.image.findMany({
    where: {
      orgId,
      deletedAt: { not: null },
      ...(after
        ? { OR: [{ deletedAt: { lt: after[0] } }, { deletedAt: after[0], id: { lt: after[1] } }] }
        : {}),
    },
    orderBy: [{ deletedAt: "desc" }, { id: "desc" }],
    take: PAGE,
  });
  const people = await prisma.user.findMany({
    where: {
      id: { in: [...new Set(rows.map((r) => r.deletedById).filter((x): x is string => !!x))] },
    },
    select: { id: true, name: true, email: true },
  });
  const names = new Map(people.map((p) => [p.id, p.name || p.email]));
  const [total, images] = await Promise.all([
    cursor
      ? Promise.resolve(null)
      : prisma.image.count({ where: { orgId, deletedAt: { not: null } } }),
    Promise.all(
      rows.map(async (r) => ({
        ...(await toListItem(r)),
        deletedAt: r.deletedAt!.toISOString(),
        deletedBy: r.deletedById ? (names.get(r.deletedById) ?? null) : null,
        daysLeft: daysLeftInTrash(r.deletedAt!),
      })),
    ),
  ]);
  const last = rows[rows.length - 1];
  return {
    images: images satisfies TrashItem[],
    nextCursor: rows.length === PAGE ? encode(last.deletedAt!, last.id) : null,
    total,
  };
}
