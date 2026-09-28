import { z } from "zod";
import { HttpError, parseJson, requireOrgApi, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { getPreset } from "@/lib/presets";
import { getOrCreateRendition, toRenditionDto } from "@/lib/renditions";

const bodySchema = z.union([
  z.object({ presetId: z.string() }),
  z.object({ params: z.record(z.string(), z.unknown()) }),
]);

/**
 * Request a resized/converted version. Returns immediately with the cached rendition; poll
 * GET /renditions/[id] while it's PENDING.
 */
export const POST = route(
  async (req: Request, ctx: RouteContext<"/api/o/[slug]/images/[imageId]/renditions">) => {
    const { slug, imageId } = await ctx.params;
    const org = await requireOrgApi(req, slug, "image:resize");
    const image = await prisma.image.findFirst({
      where: { id: imageId, orgId: org.org.id, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!image) throw new HttpError(404, "Image not found", "not_found");
    if (image.status !== "READY")
      throw new HttpError(409, "This image is still processing", "not_ready");

    const body = await parseJson(req, bodySchema);
    let params: Record<string, unknown>;
    if ("presetId" in body) {
      const preset = await getPreset(org.org.id, body.presetId);
      if (!preset) throw new HttpError(404, "Preset not found", "not_found");
      params = {
        width: preset.width,
        height: preset.height,
        fit: preset.fit,
        format: preset.format,
        quality: preset.quality,
        stripMetadata: preset.stripMetadata,
      };
    } else {
      params = body.params;
    }
    const rendition = await getOrCreateRendition(image.id, params);
    return Response.json({ rendition: await toRenditionDto(rendition) });
  },
);
