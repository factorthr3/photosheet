import { parseJson, requireOrgApi, route } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { toListItem } from "@/lib/images/dto";
import { bulkUpdateSchema } from "@/lib/images/metadata";
import { bulkUpdateImages } from "@/lib/images/metadata.server";

/** Edit metadata on many images at once. Returns fresh list items for small batches. */
export const POST = route(
  async (req: Request, ctx: RouteContext<"/api/o/[slug]/images/bulk-update">) => {
    const { slug } = await ctx.params;
    const org = await requireOrgApi(req, slug, "image:edit");
    const body = await parseJson(req, bulkUpdateSchema);
    const updated = await bulkUpdateImages(org.org.id, body);

    await recordAudit({
      orgId: org.org.id,
      userId: org.user.id,
      action: "image.bulk_update",
      targetType: "image",
      meta: {
        count: updated,
        fields: Object.keys(body.set),
        addTags: body.addTags,
        removeTags: body.removeTags,
      },
    });

    const images =
      body.imageIds.length <= 500
        ? await Promise.all(
            (
              await prisma.image.findMany({
                where: { id: { in: body.imageIds }, orgId: org.org.id },
              })
            ).map(toListItem),
          )
        : null;
    return Response.json({ updated, images });
  },
);
