import { requireOrgApi, route } from "@/lib/api";
import { toExportDto } from "@/lib/exports";
import { findOwnExport } from "@/lib/exports-access";

export const GET = route(
  async (req: Request, ctx: RouteContext<"/api/o/[slug]/exports/[exportId]">) => {
    const { slug, exportId } = await ctx.params;
    const org = await requireOrgApi(req, slug, "image:download");
    return Response.json({ export: toExportDto(await findOwnExport(org, exportId)) });
  },
);
