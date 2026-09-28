import { z } from "zod";
import { parseJson, requireOrgApi, route } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { addImagesToBoard, getBoard, listBoardImages } from "@/lib/boards";
import { parseFilters } from "@/lib/images/filters";

type Ctx = RouteContext<"/api/o/[slug]/boards/[boardId]/images">;

export const GET = route(async (req: Request, ctx: Ctx) => {
  const { slug, boardId } = await ctx.params;
  const org = await requireOrgApi(req, slug, "board:view");
  await getBoard(org.org.id, boardId);
  const params = new URL(req.url).searchParams;
  const limit = z.coerce
    .number()
    .int()
    .min(1)
    .max(200)
    .default(60)
    .parse(params.get("limit") ?? undefined);
  const filters = parseFilters(params, { defaultSort: "manual" });
  return Response.json(
    await listBoardImages(org.org.id, boardId, filters, {
      cursor: params.get("cursor") ?? undefined,
      limit,
    }),
  );
});

const bodySchema = z.object({ imageIds: z.array(z.string()).min(1).max(10_000) });

export const POST = route(async (req: Request, ctx: Ctx) => {
  const { slug, boardId } = await ctx.params;
  const org = await requireOrgApi(req, slug, "board:edit");
  const board = await getBoard(org.org.id, boardId);
  const { imageIds } = await parseJson(req, bodySchema);
  const added = await addImagesToBoard(org.org.id, board.id, imageIds);
  if (added) {
    await recordAudit({
      orgId: org.org.id,
      userId: org.user.id,
      action: "board.update",
      targetType: "board",
      targetId: board.id,
      meta: { added },
    });
  }
  return Response.json({ added, skipped: imageIds.length - added });
});
