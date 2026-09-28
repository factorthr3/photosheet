import { z } from "zod";
import { parseJson, requireOrgApi, route } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { trashImages } from "@/lib/trash";

const bodySchema = z.object({ imageIds: z.array(z.string()).min(1).max(10_000) });

/** Move images to Trash (kept 30 days). Editors: own uploads only; admins: any. */
export const POST = route(async (req: Request, ctx: RouteContext<"/api/o/[slug]/images/trash">) => {
  const { slug } = await ctx.params;
  const org = await requireOrgApi(req, slug, "image:delete:own");
  const { imageIds } = await parseJson(req, bodySchema);
  const { trashed, skipped } = await trashImages(
    { orgId: org.org.id, userId: org.user.id, role: org.role },
    imageIds,
  );
  if (trashed.length) {
    await recordAudit({
      orgId: org.org.id,
      userId: org.user.id,
      action: "image.trash",
      targetType: "image",
      targetId: trashed.length === 1 ? trashed[0].id : null,
      meta: { count: trashed.length, filenames: trashed.slice(0, 10).map((t) => t.filename) },
    });
  }
  return Response.json({ trashed: trashed.map((t) => t.id), skipped });
});
