import { HttpError, requireOrgApi, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { toDetail } from "@/lib/images/dto";

export const GET = route(
  async (req: Request, ctx: RouteContext<"/api/o/[slug]/images/[imageId]">) => {
    const { slug, imageId } = await ctx.params;
    const org = await requireOrgApi(req, slug, "image:view");
    const image = await prisma.image.findFirst({
      where: { id: imageId, orgId: org.org.id, deletedAt: null },
      include: { uploader: { select: { id: true, name: true, email: true } } },
    });
    if (!image) throw new HttpError(404, "Image not found", "not_found");
    return Response.json({ image: await toDetail(image) });
  },
);
