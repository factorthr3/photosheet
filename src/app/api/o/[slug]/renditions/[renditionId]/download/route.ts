import { HttpError, requireOrgApi, route } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { describeParams, type RenderParams } from "@/lib/image/render-params";
import { renditionDownloadUrl } from "@/lib/renditions";
import { findOrgRendition } from "@/lib/renditions-access";

/** Download a ready rendition (redirects to a 5-minute presigned URL). */
export const GET = route(
  async (req: Request, ctx: RouteContext<"/api/o/[slug]/renditions/[renditionId]/download">) => {
    const { slug, renditionId } = await ctx.params;
    const org = await requireOrgApi(req, slug, "image:download");
    const r = await findOrgRendition(org.org.id, renditionId);
    const url = await renditionDownloadUrl(r, r.image.filename);
    if (!url) throw new HttpError(409, "This version isn't ready yet", "not_ready");
    await recordAudit({
      orgId: org.org.id,
      userId: org.user.id,
      action: "image.download",
      targetType: "image",
      targetId: r.image.id,
      meta: {
        filename: r.image.filename,
        variant: describeParams(r.params as unknown as RenderParams),
        bytes: r.bytes,
      },
    });
    return Response.redirect(url, 302);
  },
);
