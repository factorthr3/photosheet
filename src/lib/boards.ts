import "server-only";
import { HttpError } from "@/lib/api";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { toListItem } from "@/lib/images/dto";
import { type ImagePage, listImages } from "@/lib/images/list";
import { buildWhere, type ImageFilters } from "@/lib/images/query";
import { moveIds } from "@/lib/move-ids";
import { presignThumb } from "@/lib/storage";

export { moveIds };

type Tx = Prisma.TransactionClient;

export interface BoardSummary {
  id: string;
  name: string;
  description: string | null;
  imageCount: number;
  coverUrl: string | null;
  createdById: string | null;
  updatedAt: string;
}

/** Boards in an org with counts and a cover thumbnail (explicit cover, else the first image). */
export async function listBoards(orgId: string): Promise<BoardSummary[]> {
  const boards = await prisma.board.findMany({
    where: { orgId },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { images: { where: { image: { deletedAt: null } } } } },
      coverImage: { select: { thumbKey: true, previewKey: true, deletedAt: true } },
      images: {
        where: { image: { deletedAt: null, thumbKey: { not: null } } },
        orderBy: { position: "asc" },
        take: 1,
        select: { image: { select: { previewKey: true, thumbKey: true } } },
      },
    },
  });
  return Promise.all(
    boards.map(async (b) => {
      const cover =
        b.coverImage && !b.coverImage.deletedAt ? b.coverImage : (b.images[0]?.image ?? null);
      const key = cover?.previewKey ?? cover?.thumbKey;
      return {
        id: b.id,
        name: b.name,
        description: b.description,
        imageCount: b._count.images,
        coverUrl: key ? await presignThumb(key) : null,
        createdById: b.createdById,
        updatedAt: b.updatedAt.toISOString(),
      };
    }),
  );
}

export async function getBoard(orgId: string, boardId: string) {
  const board = await prisma.board.findFirst({
    where: { id: boardId, orgId },
    include: { createdBy: { select: { id: true, name: true, email: true } } },
  });
  if (!board) throw new HttpError(404, "Board not found", "not_found");
  return board;
}

/** Lock the board row so concurrent position changes serialise. */
async function lockBoard(tx: Tx, boardId: string) {
  await tx.$queryRaw`SELECT id FROM board WHERE id = ${boardId} FOR UPDATE`;
}

/** Rewrite positions 0..n-1 in the given order with a single UPDATE. */
async function writeOrder(tx: Tx, boardId: string, orderedIds: string[]) {
  if (orderedIds.length === 0) return;
  const positions = orderedIds.map((_, i) => i);
  await tx.$executeRaw`
    UPDATE board_image AS bi SET position = o.position
    FROM unnest(${orderedIds}::text[], ${positions}::int[]) AS o(image_id, position)
    WHERE bi."boardId" = ${boardId} AND bi."imageId" = o.image_id`;
}

async function currentOrder(tx: Tx, boardId: string) {
  const rows = await tx.boardImage.findMany({
    where: { boardId },
    orderBy: [{ position: "asc" }, { addedAt: "asc" }],
    select: { imageId: true },
  });
  return rows.map((r) => r.imageId);
}

/** Only live images from this org can be put on its boards. */
async function validImageIds(tx: Tx, orgId: string, imageIds: string[]) {
  const rows = await tx.image.findMany({
    where: { id: { in: imageIds }, orgId, deletedAt: null, status: { not: "UPLOADING" } },
    select: { id: true },
  });
  const ok = new Set(rows.map((r) => r.id));
  return imageIds.filter((id) => ok.has(id));
}

/** Append images to the end of a board (skipping ones already on it). Returns how many were added. */
export async function addImagesToBoard(orgId: string, boardId: string, imageIds: string[]) {
  return prisma.$transaction(async (tx) => {
    await lockBoard(tx, boardId);
    const ids = [...new Set(await validImageIds(tx, orgId, imageIds))];
    const existing = new Set(
      (
        await tx.boardImage.findMany({
          where: { boardId, imageId: { in: ids } },
          select: { imageId: true },
        })
      ).map((r) => r.imageId),
    );
    const toAdd = ids.filter((id) => !existing.has(id));
    if (toAdd.length === 0) return 0;
    const { _max } = await tx.boardImage.aggregate({
      where: { boardId },
      _max: { position: true },
    });
    const start = (_max.position ?? -1) + 1;
    await tx.boardImage.createMany({
      data: toAdd.map((imageId, i) => ({ boardId, imageId, position: start + i })),
      skipDuplicates: true,
    });
    await tx.board.update({ where: { id: boardId }, data: { updatedAt: new Date() } });
    return toAdd.length;
  });
}

export async function removeImagesFromBoard(boardId: string, imageIds: string[]) {
  return prisma.$transaction(async (tx) => {
    await lockBoard(tx, boardId);
    const { count } = await tx.boardImage.deleteMany({
      where: { boardId, imageId: { in: imageIds } },
    });
    await writeOrder(tx, boardId, await currentOrder(tx, boardId));
    await tx.board.updateMany({
      where: { id: boardId, coverImageId: { in: imageIds } },
      data: { coverImageId: null },
    });
    await tx.board.update({ where: { id: boardId }, data: { updatedAt: new Date() } });
    return count;
  });
}

export async function reorderBoard(
  boardId: string,
  imageIds: string[],
  target: { beforeId?: string | null; afterId?: string | null },
) {
  await prisma.$transaction(async (tx) => {
    await lockBoard(tx, boardId);
    const order = await currentOrder(tx, boardId);
    await writeOrder(tx, boardId, moveIds(order, imageIds, target));
    await tx.board.update({ where: { id: boardId }, data: { updatedAt: new Date() } });
  });
}

// ─── Board image feed ─────────────────────────────────────────────────────────

function encodePositionCursor(position: number) {
  return Buffer.from(JSON.stringify(["manual", position])).toString("base64url");
}

function decodePositionCursor(cursor: string): number | null {
  try {
    const v = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    return Array.isArray(v) && v[0] === "manual" && Number.isInteger(v[1]) ? v[1] : null;
  } catch {
    return null;
  }
}

/** Images on a board: manual order (keyset on position) or any library sort. */
export async function listBoardImages(
  orgId: string,
  boardId: string,
  filters: ImageFilters,
  opts: { cursor?: string; limit?: number } = {},
): Promise<ImagePage> {
  if (filters.sort !== "manual") {
    return listImages(orgId, { ...filters, board: boardId }, opts);
  }
  const limit = opts.limit ?? 60;
  const after = opts.cursor ? decodePositionCursor(opts.cursor) : null;
  if (opts.cursor && after === null) throw new HttpError(400, "Invalid cursor", "invalid");

  const where: Prisma.BoardImageWhereInput = {
    boardId,
    image: buildWhere(orgId, { ...filters, board: undefined }),
  };
  const [rows, total] = await Promise.all([
    prisma.boardImage.findMany({
      where: after === null ? where : { AND: [where, { position: { gt: after } }] },
      orderBy: { position: "asc" },
      take: limit,
      include: { image: true },
    }),
    opts.cursor ? Promise.resolve(null) : prisma.boardImage.count({ where }),
  ]);
  return {
    images: await Promise.all(rows.map((r) => toListItem(r.image))),
    nextCursor: rows.length === limit ? encodePositionCursor(rows[rows.length - 1].position) : null,
    total,
  };
}
