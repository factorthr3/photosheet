import { route } from "@/lib/api";
import { toExportDto } from "@/lib/exports";
import { findShareExport } from "@/lib/public-exports";
import { requirePublicShare } from "@/lib/public-share";

export const GET = route(
  async (req: Request, ctx: RouteContext<"/api/s/[token]/exports/[exportId]">) => {
    const { token, exportId } = await ctx.params;
    const link = await requirePublicShare(req, token);
    return Response.json({ export: toExportDto(await findShareExport(link, exportId)) });
  },
);
