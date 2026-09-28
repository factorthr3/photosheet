import { PassThrough } from "node:stream";
import { ZipArchive } from "archiver";
import type { Job } from "pg-boss";
import type { Export, Image } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import {
  MAX_EXPORT_IMAGES,
  MAX_PDF_IMAGES,
  type PdfExportParams,
  resolveExportImages,
  uniqueName,
  type ZipExportParams,
} from "@/lib/exports";
import { renditionFilename } from "@/lib/image/render-params";
import { buildContactSheetPdf } from "@/lib/pdf/contact-sheet";
import { type ExportPayload, QUEUE_OPTIONS } from "@/lib/queue";
import { upsertRendition } from "@/lib/renditions-core";
import {
  getObjectBuffer,
  getObjectStream,
  headObject,
  keys,
  putObject,
  uploadStream,
} from "@/lib/storage";
import { renderAndStore } from "./render";

/** Storage key + entry name for one image in the requested variant (rendering if needed). */
async function entryFor(image: Image, params: ZipExportParams) {
  if (!params.render) return { key: image.storageKey, name: image.filename };
  let rendition = await upsertRendition(image.id, params.render);
  if (rendition.status !== "READY" || !rendition.storageKey) {
    rendition = await renderAndStore(rendition, image);
  }
  return {
    key: rendition.storageKey!,
    name: renditionFilename(
      image.filename,
      { width: rendition.width!, height: rendition.height! },
      params.render.format,
    ),
  };
}

/**
 * Stream a ZIP straight into the bucket: each file is streamed from storage into archiver, whose
 * output feeds a multipart upload. Only one entry is in flight at a time, so memory stays flat
 * regardless of export size.
 */
export async function buildZip(exp: Export) {
  const params = exp.params as unknown as ZipExportParams;
  const images = (await resolveExportImages(exp.orgId, params.source)).slice(0, MAX_EXPORT_IMAGES);
  if (images.length === 0) throw new Error("None of the selected images are available");
  await prisma.export.update({ where: { id: exp.id }, data: { itemCount: images.length } });

  const key = keys.export(exp.orgId, exp.id, "zip");
  // Images are already compressed; storing is much faster and barely larger.
  const archive = new ZipArchive({ store: true });
  const body = new PassThrough();
  archive.pipe(body);
  let archiveError: Error | null = null;
  archive.on("error", (err) => {
    archiveError = err;
    body.destroy(err);
  });
  const uploading = uploadStream(key, body, "application/zip");

  const used = new Set<string>();
  let lastReport = Date.now();
  for (let i = 0; i < images.length; i++) {
    if (archiveError) throw archiveError;
    const { key: fileKey, name } = await entryFor(images[i], params);
    const stream = await getObjectStream(fileKey);
    const done = new Promise((resolve) => archive.once("entry", resolve));
    archive.append(stream, { name: uniqueName(name, used), date: images[i].createdAt });
    await done;
    if (Date.now() - lastReport > 1000 || i === images.length - 1) {
      lastReport = Date.now();
      await prisma.export.update({
        where: { id: exp.id },
        data: { progress: Math.round(((i + 1) / images.length) * 100) },
      });
    }
  }
  await archive.finalize();
  await uploading;
  const head = await headObject(key);
  return { key, bytes: head?.bytes ?? archive.pointer() };
}

/** Contact-sheet PDF from each image's 1280px preview. */
export async function buildPdf(exp: Export) {
  const params = exp.params as unknown as PdfExportParams;
  const images = (await resolveExportImages(exp.orgId, params.source)).slice(0, MAX_PDF_IMAGES);
  if (images.length === 0) throw new Error("None of the selected images are available");
  await prisma.export.update({ where: { id: exp.id }, data: { itemCount: images.length } });

  const caption = (i: Image) =>
    params.options.caption === "title" ? i.title || i.filename : i.filename;
  let lastReport = Date.now();
  const bytes = await buildContactSheetPdf({
    title: params.title,
    subtitle: `${params.orgName} · ${images.length} ${images.length === 1 ? "image" : "images"} · ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`,
    options: params.options,
    images: images.map((i) => ({
      name: caption(i),
      load: () => getObjectBuffer(i.previewKey ?? i.thumbKey ?? i.storageKey),
    })),
    onProgress: async (done, total) => {
      if (Date.now() - lastReport < 1000 && done !== total) return;
      lastReport = Date.now();
      await prisma.export.update({
        where: { id: exp.id },
        data: { progress: Math.round((done / total) * 95) },
      });
    },
  });
  const key = keys.export(exp.orgId, exp.id, "pdf");
  await putObject(key, Buffer.from(bytes), "application/pdf", "private, max-age=0");
  return { key, bytes: bytes.length };
}

export async function exportJob(job: Job<ExportPayload>) {
  const exp = await prisma.export.findUnique({ where: { id: job.data.exportId } });
  if (!exp || exp.status === "READY") return;
  await prisma.export.update({
    where: { id: exp.id },
    data: { status: "RUNNING", progress: 0, error: null },
  });
  try {
    const build = { zip: buildZip, pdf: buildPdf }[exp.kind];
    if (!build) throw new Error(`Unknown export kind: ${exp.kind}`);
    const { key, bytes } = await build(exp);
    await prisma.export.update({
      where: { id: exp.id },
      data: {
        status: "READY",
        storageKey: key,
        bytes: BigInt(bytes),
        progress: 100,
        completedAt: new Date(),
      },
    });
    console.info(`[export] ${exp.id} ${exp.kind} ready (${bytes} bytes)`);
  } catch (err) {
    const final = job.retryCount >= QUEUE_OPTIONS.export.retryLimit;
    await prisma.export.update({
      where: { id: exp.id },
      data: final
        ? { status: "FAILED", error: (err as Error).message.slice(0, 500) }
        : { status: "PENDING", error: `Retrying: ${(err as Error).message}`.slice(0, 500) },
    });
    console.error(`[export] ${exp.id} ${final ? "failed" : "will retry"}:`, (err as Error).message);
    throw err;
  }
}
