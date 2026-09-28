import { z } from "zod";
import { parseJson, requireOrgApi, route } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { enqueuePurge } from "@/lib/queue";
import { purgeImages } from "@/lib/trash";

const bodySchema = z.union([
  z.object({ imageIds: z.array(z.string()).min(1).max(200) }),
  z.object({ all: z.literal(true) }),
]);

/** Permanently delete images that are in Trash (admins only). "Empty trash" runs in the worker. */
export const POST = route(async (req: Request, ctx: RouteContext<"/api/o/[slug]/images/purge">) => {
  const { slug } = await ctx.params;
  const org = await requireOrgApi(req, slug, "image:delete:any");
  const body = await parseJson(req, bodySchema);
  if ("all" in body) {
    await enqueuePurge({ orgId: org.org.id, userId: org.user.id });
    return Response.json({ queued: true }, { status: 202 });
  }
  const purged = await purgeImages({ orgId: org.org.id, ids: body.imageIds });
  if (purged.length) {
    await recordAudit({
      orgId: org.org.id,
      userId: org.user.id,
      action: "image.purge",
      targetType: "image",
      meta: { count: purged.length, filenames: purged.slice(0, 10).map((p) => p.filename) },
    });
  }
  return Response.json({ purged: purged.map((p) => p.id) });
});
