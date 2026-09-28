import "server-only";
import { prisma } from "@/lib/db";
import { MAX_TAGS } from "./tags";
import type { BulkUpdate, ImageUpdate } from "./metadata";

/** Apply a single-image edit. Caller has already checked org + permission. */
export async function updateImageMetadata(orgId: string, imageId: string, update: ImageUpdate) {
  const { count } = await prisma.image.updateMany({
    where: { id: imageId, orgId, deletedAt: null },
    data: update,
  });
  return count > 0;
}

/**
 * Apply a bulk edit to live images in the org. Scalar fields use updateMany; tag changes are one
 * SQL statement so each image keeps its own existing tags.
 */
export async function bulkUpdateImages(orgId: string, body: BulkUpdate) {
  return prisma.$transaction(async (tx) => {
    const where = { id: { in: body.imageIds }, orgId, deletedAt: null };
    let count = 0;
    if (Object.keys(body.set).length > 0) {
      ({ count } = await tx.image.updateMany({ where, data: body.set }));
    }
    if (body.addTags.length || body.removeTags.length) {
      count = await tx.$executeRaw`
        UPDATE image SET
          tags = COALESCE((
            SELECT (array_agg(t ORDER BY ord))[1:${MAX_TAGS}]
            FROM (
              SELECT t, MIN(ord) AS ord
              FROM unnest(image.tags || ${body.addTags}::text[]) WITH ORDINALITY AS u(t, ord)
              WHERE NOT (t = ANY(${body.removeTags}::text[]))
              GROUP BY t
            ) s
          ), '{}'),
          "updatedAt" = now()
        WHERE id = ANY(${body.imageIds}::text[]) AND "orgId" = ${orgId} AND "deletedAt" IS NULL`;
    }
    return count;
  });
}
