import { z } from "zod";
import { parseJson, requireOrgApi, route } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { restoreImages } from "@/lib/trash";

const bodySchema = z.object({ imageIds: z.array(z.string()).min(1).max(10_000) });

export const POST = route(
  async (req: Request, ctx: RouteContext<"/api/o/[slug]/images/restore">) => {
    const { slug } = await ctx.params;
    const org = await requireOrgApi(req, slug, "image:delete:own");
    const { imageIds } = await parseJson(req, bodySchema);
    const { restored, skipped } = await restoreImages(
      { orgId: org.org.id, userId: org.user.id, role: org.role },
      imageIds,
    );
    if (restored.length) {
      await recordAudit({
        orgId: org.org.id,
        userId: org.user.id,
        action: "image.restore",
        targetType: "image",
        targetId: restored.length === 1 ? restored[0].id : null,
        meta: { count: restored.length, filenames: restored.slice(0, 10).map((t) => t.filename) },
      });
    }
    return Response.json({ restored: restored.map((r) => r.id), skipped });
  },
);
