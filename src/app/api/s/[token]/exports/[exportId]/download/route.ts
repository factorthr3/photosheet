import { HttpError, route } from "@/lib/api";
import { exportDownloadUrl } from "@/lib/exports";
import { findShareExport } from "@/lib/public-exports";
import { requirePublicShare } from "@/lib/public-share";

export const GET = route(
  async (req: Request, ctx: RouteContext<"/api/s/[token]/exports/[exportId]/download">) => {
    const { token, exportId } = await ctx.params;
    const link = await requirePublicShare(req, token);
    const url = await exportDownloadUrl(await findShareExport(link, exportId));
    if (!url) throw new HttpError(409, "This download isn't ready yet", "not_ready");
    return Response.redirect(url, 302);
  },
);
