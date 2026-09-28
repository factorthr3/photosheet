import { z } from "zod";
import { parseJson, requireOrgApi, route } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { addImagesToBoard, listBoards, toViewer } from "@/lib/boards";
import { prisma } from "@/lib/db";

export const GET = route(async (req: Request, ctx: RouteContext<"/api/o/[slug]/boards">) => {
  const { slug } = await ctx.params;
  const org = await requireOrgApi(req, slug, "board:view");
  return Response.json({ boards: await listBoards(toViewer(org)) });
});

const createSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  description: z.string().trim().max(2000).optional(),
  imageIds: z.array(z.string()).max(10_000).optional(),
});

/** Create a board, optionally seeded with images. */
export const POST = route(async (req: Request, ctx: RouteContext<"/api/o/[slug]/boards">) => {
  const { slug } = await ctx.params;
  const org = await requireOrgApi(req, slug, "board:edit");
  const body = await parseJson(req, createSchema);
  const board = await prisma.board.create({
    data: {
      orgId: org.org.id,
      name: body.name,
      description: body.description || null,
      createdById: org.user.id,
    },
  });
  const added = body.imageIds?.length
    ? await addImagesToBoard(org.org.id, board.id, body.imageIds)
    : 0;
  await recordAudit({
    orgId: org.org.id,
    userId: org.user.id,
    action: "board.create",
    targetType: "board",
    targetId: board.id,
    meta: { name: board.name, images: added },
  });
  return Response.json({ board: { id: board.id, name: board.name }, added }, { status: 201 });
});
