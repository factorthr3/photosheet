import { z } from "zod";
import { requireOrgApi, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { presignThumb } from "@/lib/storage";

const idsSchema = z.array(z.uuid()).min(1).max(200);

/** Poll processing status for a set of images (used after upload). */
export const GET = route(async (req: Request, ctx: RouteContext<"/api/o/[slug]/images/status">) => {
  const { slug } = await ctx.params;
  const org = await requireOrgApi(req, slug, "image:view");
  const ids = idsSchema.parse(new URL(req.url).searchParams.get("ids")?.split(",") ?? []);

  const images = await prisma.image.findMany({
    where: { id: { in: ids }, orgId: org.org.id },
    select: { id: true, status: true, error: true, thumbKey: true },
  });
  return Response.json({
    images: await Promise.all(
      images.map(async (i) => ({
        id: i.id,
        status: i.status,
        error: i.status === "FAILED" ? i.error : null,
        thumbUrl: i.thumbKey ? await presignThumb(i.thumbKey) : null,
      })),
    ),
  });
});
