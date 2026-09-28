import type { Job } from "pg-boss";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { processOriginal, UnprocessableImageError } from "@/lib/image/process";
import { QUEUE_OPTIONS, type ProcessImagePayload } from "@/lib/queue";
import { getObjectBuffer, keys, putObject } from "@/lib/storage";

/** Hash, measure, extract EXIF and generate thumbnails for a freshly uploaded original. */
export async function processImageJob(job: Job<ProcessImagePayload>) {
  const { imageId } = job.data;
  const image = await prisma.image.findUnique({ where: { id: imageId } });
  if (!image || image.deletedAt || image.status === "READY") return;

  try {
    const original = await getObjectBuffer(image.storageKey);
    const result = await processOriginal(original, image.mimeType);

    const thumbKey = keys.thumb(image.orgId, image.id);
    const previewKey = keys.preview(image.orgId, image.id);
    await Promise.all([
      putObject(thumbKey, result.thumb, "image/webp"),
      putObject(previewKey, result.preview, "image/webp"),
    ]);

    await prisma.image.update({
      where: { id: image.id },
      data: {
        status: "READY",
        error: null,
        sha256: result.sha256,
        width: result.width,
        height: result.height,
        exif: result.exif as Prisma.InputJsonValue,
        takenAt: result.takenAt,
        thumbKey,
        previewKey,
        // Pre-fill golden-source fields from EXIF, never overwriting what the user entered.
        credit: image.credit ?? result.exif.artist ?? null,
        copyright: image.copyright ?? result.exif.copyright ?? null,
        description: image.description ?? result.exif.description ?? null,
      },
    });
    console.info(`[process-image] ${image.id} ready (${result.width}×${result.height})`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const permanent = err instanceof UnprocessableImageError;
    const finalAttempt = permanent || job.retryCount >= QUEUE_OPTIONS["process-image"].retryLimit;
    await prisma.image.update({
      where: { id: image.id },
      data: finalAttempt
        ? { status: "FAILED", error: message.slice(0, 500) }
        : { error: `Retrying: ${message}`.slice(0, 500) },
    });
    console.error(
      `[process-image] ${image.id} ${finalAttempt ? "failed" : "will retry"}:`,
      message,
    );
    // Permanent failures are recorded, not retried.
    if (!permanent) throw err;
  }
}
