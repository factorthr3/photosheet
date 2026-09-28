import { z } from "zod";
import { HttpError, parseJson, requireOrgApi, route } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { getBoard, toViewer } from "@/lib/boards";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";

type Ctx = RouteContext<"/api/o/[slug]/boards/[boardId]">;

export const GET = route(async (req: Request, ctx: Ctx) => {
  const { slug, boardId } = await ctx.params;
  const org = await requireOrgApi(req, slug, "board:view");
  const board = await getBoard(toViewer(org), boardId);
  return Response.json({
    board: {
      id: board.id,
      name: board.name,
      description: board.description,
      coverImageId: board.coverImageId,
      createdBy: board.createdBy,
      createdAt: board.createdAt,
      updatedAt: board.updatedAt,
    },
  });
});

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  coverImageId: z.string().nullable().optional(),
  visibility: z.enum(["ORG", "PRIVATE"]).optional(),
});

export const PATCH = route(async (req: Request, ctx: Ctx) => {
  const { slug, boardId } = await ctx.params;
  const org = await requireOrgApi(req, slug, "board:edit");
  const board = await getBoard(toViewer(org), boardId);
  const body = await parseJson(req, patchSchema);

  if (body.visibility && board.createdById !== org.user.id && !can(org.role, "board:delete:any")) {
    throw new HttpError(
      403,
      "Only the board's creator or an admin can change who can see it",
      "forbidden",
    );
  }

  if (body.coverImageId) {
    const onBoard = await prisma.boardImage.findUnique({
      where: { boardId_imageId: { boardId, imageId: body.coverImageId } },
    });
    if (!onBoard) throw new HttpError(400, "The cover must be an image on this board", "invalid");
  }

  const updated = await prisma.board.update({
    where: { id: board.id },
    data: {
      name: body.name,
      description: body.description === undefined ? undefined : body.description || null,
      coverImageId: body.coverImageId,
      visibility: body.visibility,
    },
  });
  await recordAudit({
    orgId: org.org.id,
    userId: org.user.id,
    action: "board.update",
    targetType: "board",
    targetId: board.id,
    meta: { fields: Object.keys(body) },
  });
  return Response.json({
    board: {
      id: updated.id,
      name: updated.name,
      description: updated.description,
      coverImageId: updated.coverImageId,
      visibility: updated.visibility,
    },
  });
});

/** Deleting a board never deletes its images. Creators (editor+) or admins may delete. */
export const DELETE = route(async (req: Request, ctx: Ctx) => {
  const { slug, boardId } = await ctx.params;
  const org = await requireOrgApi(req, slug, "board:edit");
  const board = await getBoard(toViewer(org), boardId);
  if (board.createdById !== org.user.id && !can(org.role, "board:delete:any")) {
    throw new HttpError(403, "Only the board's creator or an admin can delete it", "forbidden");
  }
  await prisma.board.delete({ where: { id: board.id } });
  await recordAudit({
    orgId: org.org.id,
    userId: org.user.id,
    action: "board.delete",
    targetType: "board",
    targetId: board.id,
    meta: { name: board.name },
  });
  return new Response(null, { status: 204 });
});
