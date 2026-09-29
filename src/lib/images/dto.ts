import "server-only";
import type { Image } from "@/generated/prisma/client";
import type { ExifSummary } from "@/lib/image/exif";
import { presignThumb } from "@/lib/storage";

/** What the grid needs per tile. */
export interface ImageListItem {
  id: string;
  filename: string;
  title: string | null;
  width: number | null;
  height: number | null;
  bytes: number;
  mimeType: string;
  status: Image["status"];
  error: string | null;
  tags: string[];
  licence: string | null;
  licenceExpiresAt: string | null;
  createdAt: string;
  takenAt: string | null;
  uploaderId: string | null;
  thumbUrl: string | null;
  previewUrl: string | null;
}

export async function toListItem(image: Image): Promise<ImageListItem> {
  const [thumbUrl, previewUrl] = await Promise.all([
    image.thumbKey ? presignThumb(image.thumbKey) : null,
    image.previewKey ? presignThumb(image.previewKey) : null,
  ]);
  return {
    id: image.id,
    filename: image.filename,
    title: image.title,
    width: image.width,
    height: image.height,
    bytes: image.bytes,
    mimeType: image.mimeType,
    status: image.status,
    error: image.status === "FAILED" ? image.error : null,
    tags: image.tags,
    licence: image.licence,
    licenceExpiresAt: image.licenceExpiresAt?.toISOString() ?? null,
    createdAt: image.createdAt.toISOString(),
    takenAt: image.takenAt?.toISOString() ?? null,
    uploaderId: image.uploaderId,
    thumbUrl,
    previewUrl,
  };
}

/** Everything the lightbox info panel shows. */
export interface ImageDetail extends ImageListItem {
  description: string | null;
  credit: string | null;
  copyright: string | null;
  sha256: string | null;
  exif: ExifSummary | null;
  uploader: { id: string; name: string; email: string } | null;
  updatedAt: string;
}

export async function toDetail(
  image: Image & { uploader: { id: string; name: string; email: string } | null },
): Promise<ImageDetail> {
  return {
    ...(await toListItem(image)),
    description: image.description,
    credit: image.credit,
    copyright: image.copyright,
    sha256: image.sha256,
    exif: (image.exif as ExifSummary | null) ?? null,
    uploader: image.uploader,
    updatedAt: image.updatedAt.toISOString(),
  };
}
