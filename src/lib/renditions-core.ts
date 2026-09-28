import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { paramsHash, type RenderParams } from "@/lib/image/render-params";

/** Find or create the Rendition row for (image, params). Safe to call from the web or worker. */
export async function upsertRendition(imageId: string, params: RenderParams) {
  const hash = await paramsHash(params);
  return prisma.rendition.upsert({
    where: { imageId_paramsHash: { imageId, paramsHash: hash } },
    create: {
      imageId,
      paramsHash: hash,
      params: params as unknown as Prisma.InputJsonValue,
      format: params.format,
    },
    update: {},
  });
}
