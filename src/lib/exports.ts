import { z } from "zod";
import type { Export, Image } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { canonicalParams, type RenderParams } from "@/lib/image/render-params";
import { presignGet } from "@/lib/storage";

/**
 * ZIP (and later PDF) exports built by the worker. Params are snapshotted at creation so later
 * preset edits don't change an export in flight. No `server-only` here: the worker imports it.
 */
export const MAX_EXPORT_IMAGES = 2000;
export const EXPORT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const exportSourceSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("images"),
    imageIds: z.array(z.string()).min(1).max(MAX_EXPORT_IMAGES),
  }),
  z.object({ type: z.literal("board"), boardId: z.string() }),
]);
export type ExportSource = z.infer<typeof exportSourceSchema>;

export interface ZipExportParams {
  source: ExportSource;
  /** null = original files */
  render: RenderParams | null;
  variantName: string;
}

/** Live, processed images for an export, in the order they should appear. */
export async function resolveExportImages(orgId: string, source: ExportSource): Promise<Image[]> {
  const live = { orgId, deletedAt: null, status: "READY" as const };
  if (source.type === "board") {
    const rows = await prisma.boardImage.findMany({
      where: { boardId: source.boardId, board: { orgId }, image: live },
      orderBy: { position: "asc" },
      include: { image: true },
      take: MAX_EXPORT_IMAGES + 1,
    });
    return rows.map((r) => r.image);
  }
  const images = await prisma.image.findMany({ where: { id: { in: source.imageIds }, ...live } });
  const byId = new Map(images.map((i) => [i.id, i]));
  return source.imageIds.map((id) => byId.get(id)).filter((i): i is Image => !!i);
}

/** Make ZIP entry names unique: "a.jpg", "a-2.jpg", "a-3.jpg"… (case-insensitive). */
export function uniqueName(name: string, used: Set<string>): string {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  let candidate = name;
  for (let n = 2; used.has(candidate.toLowerCase()); n++) candidate = `${base}-${n}${ext}`;
  used.add(candidate.toLowerCase());
  return candidate;
}

export function exportFilename(label: string, now = new Date()) {
  const safe = label
    .replace(/[^\p{L}\p{N} _-]+/gu, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
  return `${safe || "photosheet"}-${now.toISOString().slice(0, 10)}`;
}

export interface ExportDto {
  id: string;
  kind: string;
  status: Export["status"];
  progress: number;
  itemCount: number;
  bytes: number | null;
  filename: string;
  error: string | null;
  createdAt: string;
}

export function toExportDto(e: Export): ExportDto {
  return {
    id: e.id,
    kind: e.kind,
    status: e.status,
    progress: e.progress,
    itemCount: e.itemCount,
    bytes: e.bytes === null ? null : Number(e.bytes),
    filename: e.filename,
    error: e.status === "FAILED" ? e.error : null,
    createdAt: e.createdAt.toISOString(),
  };
}

export async function exportDownloadUrl(e: Export) {
  if (e.status !== "READY" || !e.storageKey) return null;
  return presignGet(e.storageKey, { expiresIn: 300, downloadAs: e.filename });
}

/** Resolve a "variant" choice (original or preset) to snapshot params. */
export async function resolveVariant(
  orgId: string,
  variant: { type: "original" } | { type: "preset"; presetId: string },
): Promise<{ render: RenderParams | null; variantName: string } | null> {
  if (variant.type === "original") return { render: null, variantName: "Original files" };
  const preset = await prisma.resizePreset.findFirst({ where: { id: variant.presetId, orgId } });
  if (!preset) return null;
  return {
    render: canonicalParams({
      width: preset.width,
      height: preset.height,
      fit: preset.fit as RenderParams["fit"],
      format: preset.format as RenderParams["format"],
      quality: preset.quality,
      stripMetadata: preset.stripMetadata,
    }),
    variantName: preset.name,
  };
}
