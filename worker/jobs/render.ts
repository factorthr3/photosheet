import type { Job } from "pg-boss";
import type { Image, Rendition } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { UnprocessableImageError } from "@/lib/image/process";
import { renderImage } from "@/lib/image/render";
import { FORMAT_INFO, type RenderParams } from "@/lib/image/render-params";
import { QUEUE_OPTIONS, type RenderPayload } from "@/lib/queue";
import { getObjectBuffer, keys, putObject } from "@/lib/storage";

/** Render a rendition and store it. Returns the updated row. Also used by exports. */
export async function renderAndStore(rendition: Rendition, image: Image, original?: Buffer) {
  const params = rendition.params as unknown as RenderParams;
  const source = original ?? (await getObjectBuffer(image.storageKey));
  let out;
  try {
    out = await renderImage(source, image.mimeType, params);
  } catch (err) {
    throw new UnprocessableImageError(`Could not render: ${(err as Error).message}`);
  }
  const key = keys.rendition(
    image.orgId,
    image.id,
    rendition.paramsHash,
    FORMAT_INFO[params.format].ext,
  );
  await putObject(key, out.buffer, FORMAT_INFO[params.format].mime);
  return prisma.rendition.update({
    where: { id: rendition.id },
    data: {
      status: "READY",
      storageKey: key,
      width: out.width,
      height: out.height,
      bytes: out.bytes,
      error: null,
    },
  });
}

export async function renderJob(job: Job<RenderPayload>) {
  const rendition = await prisma.rendition.findUnique({
    where: { id: job.data.renditionId },
    include: { image: true },
  });
  if (!rendition || rendition.status === "READY") return;
  if (rendition.image.deletedAt || rendition.image.status !== "READY") {
    await prisma.rendition.update({
      where: { id: rendition.id },
      data: { status: "FAILED", error: "Image unavailable" },
    });
    return;
  }
  try {
    const done = await renderAndStore(rendition, rendition.image);
    console.info(`[render] ${rendition.id} ${done.width}×${done.height} ${done.bytes}B`);
  } catch (err) {
    const permanent = err instanceof UnprocessableImageError;
    const final = permanent || job.retryCount >= QUEUE_OPTIONS.render.retryLimit;
    if (final) {
      await prisma.rendition.update({
        where: { id: rendition.id },
        data: { status: "FAILED", error: (err as Error).message.slice(0, 500) },
      });
    }
    console.error(
      `[render] ${rendition.id} ${final ? "failed" : "will retry"}:`,
      (err as Error).message,
    );
    if (!permanent) throw err;
  }
}
