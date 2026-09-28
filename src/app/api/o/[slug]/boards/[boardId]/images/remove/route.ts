import { z } from "zod";
import { parseJson, requireOrgApi, route } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { getBoard, removeImagesFromBoard } from "@/lib/boards";

const bodySchema = z.object({ imageIds: z.array(z.string()).min(1).max(10_000) });

/** Take images off a board (the images themselves stay in the library). */
export const POST = route(
  async (req: Request, ctx: RouteContext<"/api/o/[slug]/boards/[boardId]/images/remove">) => {
    const { slug, boardId } = await ctx.params;
    const org = await requireOrgApi(req, slug, "board:edit");
    const board = await getBoard(org.org.id, boardId);
    const { imageIds } = await parseJson(req, bodySchema);
    const removed = await removeImagesFromBoard(board.id, imageIds);
    await recordAudit({
      orgId: org.org.id,
      userId: org.user.id,
      action: "board.update",
      targetType: "board",
      targetId: board.id,
      meta: { removed },
    });
    return Response.json({ removed });
  },
);
