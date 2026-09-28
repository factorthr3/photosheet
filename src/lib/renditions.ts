import "server-only";
import type { Prisma, Rendition } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import {
  canonicalParams,
  paramsHash,
  type RenderParams,
  type RenderParamsInput,
  renditionFilename,
} from "@/lib/image/render-params";
import { enqueueRender } from "@/lib/queue";
import { presignGet } from "@/lib/storage";

/** A render stuck in PENDING this long (e.g. the job was lost) is re-queued on the next request. */
const STALE_PENDING_MS = 2 * 60_000;

/**
 * Find or create the cached rendition for (image, params) and make sure it's being rendered.
 * Identical requests share one row thanks to the (imageId, paramsHash) unique index.
 */
export async function getOrCreateRendition(imageId: string, input: RenderParamsInput) {
  const params = canonicalParams(input);
  const hash = await paramsHash(params);
  let rendition = await prisma.rendition.upsert({
    where: { imageId_paramsHash: { imageId, paramsHash: hash } },
    create: {
      imageId,
      paramsHash: hash,
      params: params as unknown as Prisma.InputJsonValue,
      format: params.format,
    },
    update: {},
  });

  const stale =
    rendition.status === "PENDING" && Date.now() - rendition.updatedAt.getTime() > STALE_PENDING_MS;
  if (rendition.status === "FAILED" || stale) {
    rendition = await prisma.rendition.update({
      where: { id: rendition.id },
      data: { status: "PENDING", error: null },
    });
  }
  if (rendition.status === "PENDING") await enqueueRender(rendition.id);
  return rendition;
}

export interface RenditionDto {
  id: string;
  status: Rendition["status"];
  params: RenderParams;
  width: number | null;
  height: number | null;
  bytes: number | null;
  error: string | null;
  /** Short-lived inline URL for previews (READY only). */
  url: string | null;
}

export async function toRenditionDto(r: Rendition): Promise<RenditionDto> {
  return {
    id: r.id,
    status: r.status,
    params: r.params as unknown as RenderParams,
    width: r.width,
    height: r.height,
    bytes: r.bytes,
    error: r.status === "FAILED" ? r.error : null,
    url:
      r.status === "READY" && r.storageKey
        ? await presignGet(r.storageKey, { expiresIn: 600 })
        : null,
  };
}

/** Presigned attachment URL with a descriptive filename. */
export async function renditionDownloadUrl(r: Rendition, originalFilename: string) {
  if (r.status !== "READY" || !r.storageKey || !r.width || !r.height) return null;
  const params = r.params as unknown as RenderParams;
  return presignGet(r.storageKey, {
    expiresIn: 300,
    downloadAs: renditionFilename(
      originalFilename,
      { width: r.width, height: r.height },
      params.format,
    ),
  });
}
