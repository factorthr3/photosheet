import { HttpError, requireOrgApi, route } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { presignGet } from "@/lib/storage";

/**
 * Download (or view, with ?inline=1) the untouched original. Redirects to a 5-minute presigned
 * URL so the bytes come straight from the bucket.
 */
export const GET = route(
  async (req: Request, ctx: RouteContext<"/api/o/[slug]/images/[imageId]/download">) => {
    const { slug, imageId } = await ctx.params;
    const org = await requireOrgApi(req, slug, "image:download");
    const image = await prisma.image.findFirst({
      where: { id: imageId, orgId: org.org.id, deletedAt: null, status: { not: "UPLOADING" } },
    });
    if (!image) throw new HttpError(404, "Image not found", "not_found");

    const inline = new URL(req.url).searchParams.get("inline") === "1";
    const url = await presignGet(image.storageKey, {
      expiresIn: 300,
      downloadAs: inline ? undefined : image.filename,
    });
    if (!inline) {
      await recordAudit({
        orgId: org.org.id,
        userId: org.user.id,
        action: "image.download",
        targetType: "image",
        targetId: image.id,
        meta: { filename: image.filename, variant: "original" },
      });
    }
    return Response.redirect(url, 302);
  },
);
