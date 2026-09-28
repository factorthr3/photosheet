import { z } from "zod";
import { parseJson, requireOrgApi, route } from "@/lib/api";
import { getBoard, reorderBoard } from "@/lib/boards";

const bodySchema = z
  .object({
    imageIds: z.array(z.string()).min(1).max(10_000),
    beforeId: z.string().nullable().optional(),
    afterId: z.string().nullable().optional(),
  })
  .refine((b) => !(b.beforeId && b.afterId), "Give beforeId or afterId, not both");

/** Move images within the board's manual order. */
export const POST = route(
  async (req: Request, ctx: RouteContext<"/api/o/[slug]/boards/[boardId]/reorder">) => {
    const { slug, boardId } = await ctx.params;
    const org = await requireOrgApi(req, slug, "board:edit");
    const board = await getBoard(org.org.id, boardId);
    const { imageIds, beforeId, afterId } = await parseJson(req, bodySchema);
    await reorderBoard(board.id, imageIds, { beforeId, afterId });
    return new Response(null, { status: 204 });
  },
);
