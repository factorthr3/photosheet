import { requireOrgApi, route } from "@/lib/api";
import { toRenditionDto } from "@/lib/renditions";
import { findOrgRendition } from "@/lib/renditions-access";

export const GET = route(
  async (req: Request, ctx: RouteContext<"/api/o/[slug]/renditions/[renditionId]">) => {
    const { slug, renditionId } = await ctx.params;
    const org = await requireOrgApi(req, slug, "image:resize");
    return Response.json({
      rendition: await toRenditionDto(await findOrgRendition(org.org.id, renditionId)),
    });
  },
);
