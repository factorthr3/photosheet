import { HttpError, parseJson, requireOrgApi, route } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { toDetail } from "@/lib/images/dto";
import { updateImageSchema } from "@/lib/images/metadata";
import { updateImageMetadata } from "@/lib/images/metadata.server";

type Ctx = RouteContext<"/api/o/[slug]/images/[imageId]">;

async function loadDetail(orgId: string, imageId: string) {
  const image = await prisma.image.findFirst({
    where: { id: imageId, orgId, deletedAt: null },
    include: { uploader: { select: { id: true, name: true, email: true } } },
  });
  if (!image) throw new HttpError(404, "Image not found", "not_found");
  return toDetail(image);
}

export const GET = route(async (req: Request, ctx: Ctx) => {
  const { slug, imageId } = await ctx.params;
  const org = await requireOrgApi(req, slug, "image:view");
  return Response.json({ image: await loadDetail(org.org.id, imageId) });
});

/** Edit golden-source metadata for one image. */
export const PATCH = route(async (req: Request, ctx: Ctx) => {
  const { slug, imageId } = await ctx.params;
  const org = await requireOrgApi(req, slug, "image:edit");
  const update = await parseJson(req, updateImageSchema);
  if (!(await updateImageMetadata(org.org.id, imageId, update))) {
    throw new HttpError(404, "Image not found", "not_found");
  }
  await recordAudit({
    orgId: org.org.id,
    userId: org.user.id,
    action: "image.update",
    targetType: "image",
    targetId: imageId,
    meta: { fields: Object.keys(update) },
  });
  return Response.json({ image: await loadDetail(org.org.id, imageId) });
});
