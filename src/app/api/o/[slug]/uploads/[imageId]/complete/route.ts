import { HttpError, requireOrgApi, route } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { detectImageType, MAGIC_BYTES_NEEDED } from "@/lib/image/magic";
import { enqueueProcessImage } from "@/lib/queue";
import { deleteObjects, getObjectBuffer, headObject } from "@/lib/storage";

/**
 * Called by the browser once its direct-to-bucket upload finishes. Verifies the object exists,
 * checks its real type from magic bytes, then queues thumbnail/EXIF processing.
 */
export const POST = route(
  async (req: Request, ctx: RouteContext<"/api/o/[slug]/uploads/[imageId]/complete">) => {
    const { slug, imageId } = await ctx.params;
    const org = await requireOrgApi(req, slug, "image:upload");

    const image = await prisma.image.findFirst({
      where: { id: imageId, orgId: org.org.id, uploaderId: org.user.id },
    });
    if (!image) throw new HttpError(404, "Upload not found", "not_found");
    if (image.status !== "UPLOADING") {
      return Response.json({ image: { id: image.id, status: image.status } });
    }

    const head = await headObject(image.storageKey);
    if (!head) throw new HttpError(409, "The file hasn't finished uploading", "not_uploaded");

    const reject = async (status: number, message: string, code: string) => {
      await deleteObjects([image.storageKey]);
      await prisma.image.delete({ where: { id: image.id } });
      throw new HttpError(status, message, code);
    };

    if (head.bytes > env().MAX_UPLOAD_MB * 1024 * 1024) {
      await reject(413, `File is larger than ${env().MAX_UPLOAD_MB} MB`, "too_large");
    }
    const firstBytes = await getObjectBuffer(image.storageKey, {
      start: 0,
      end: MAGIC_BYTES_NEEDED - 1,
    });
    const detected = detectImageType(firstBytes);
    if (!detected) {
      await reject(
        422,
        "This file isn't a supported image (JPEG, PNG, WebP, HEIC or TIFF)",
        "unsupported",
      );
    }

    await prisma.image.update({
      where: { id: image.id },
      data: { status: "PROCESSING", mimeType: detected!, bytes: head.bytes },
    });
    await enqueueProcessImage(image.id);
    await recordAudit({
      orgId: org.org.id,
      userId: org.user.id,
      action: "image.upload",
      targetType: "image",
      targetId: image.id,
      meta: { filename: image.filename, bytes: head.bytes, mimeType: detected },
    });

    return Response.json({ image: { id: image.id, status: "PROCESSING" } });
  },
);
