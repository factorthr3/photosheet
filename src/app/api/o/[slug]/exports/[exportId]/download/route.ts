import { HttpError, requireOrgApi, route } from "@/lib/api";
import { exportDownloadUrl } from "@/lib/exports";
import { findOwnExport } from "@/lib/exports-access";

export const GET = route(
  async (req: Request, ctx: RouteContext<"/api/o/[slug]/exports/[exportId]/download">) => {
    const { slug, exportId } = await ctx.params;
    const org = await requireOrgApi(req, slug, "image:download");
    const exp = await findOwnExport(org, exportId);
    if (exp.expiresAt < new Date())
      throw new HttpError(410, "This download has expired", "expired");
    const url = await exportDownloadUrl(exp);
    if (!url) throw new HttpError(409, "This download isn't ready yet", "not_ready");
    return Response.redirect(url, 302);
  },
);
