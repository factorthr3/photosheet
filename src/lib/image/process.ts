import { createHash } from "node:crypto";
import { openImage, uprightSize } from "./decode";
import { type ExifSummary, extractExif } from "./exif";

export const THUMB_SIZE = 320;
export const PREVIEW_SIZE = 1280;

export interface ProcessedOriginal {
  sha256: string;
  width: number;
  height: number;
  exif: ExifSummary;
  takenAt: Date | null;
  thumb: Buffer;
  preview: Buffer;
}

/** Thrown for inputs that will never succeed (corrupt/unsupported) — don't retry. */
export class UnprocessableImageError extends Error {}

export function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

async function webp(buffer: Buffer, mimeType: string, size: number, quality: number) {
  const img = await openImage(buffer, mimeType);
  return img
    .resize({ width: size, height: size, fit: "inside", withoutEnlargement: true })
    .toColorspace("srgb")
    .webp({ quality, effort: 4 })
    .toBuffer();
}

/** Hash, measure, read EXIF from and make thumbnails for an uploaded original. */
export async function processOriginal(
  buffer: Buffer,
  mimeType: string,
): Promise<ProcessedOriginal> {
  let width: number | undefined;
  let height: number | undefined;
  try {
    ({ width, height } = await uprightSize(buffer, mimeType));
  } catch (err) {
    throw new UnprocessableImageError(`Could not read image: ${(err as Error).message}`);
  }
  if (!width || !height) throw new UnprocessableImageError("Could not read image dimensions");

  const exif = await extractExif(buffer);

  let thumb: Buffer;
  let preview: Buffer;
  try {
    // Decode once for the larger preview, then derive the thumbnail from it (much cheaper).
    preview = await webp(buffer, mimeType, PREVIEW_SIZE, 82);
    thumb = await webp(preview, "image/webp", THUMB_SIZE, 78);
  } catch (err) {
    throw new UnprocessableImageError(`Could not decode image: ${(err as Error).message}`);
  }

  return {
    sha256: sha256(buffer),
    width,
    height,
    exif,
    takenAt: exif.takenAt ? new Date(exif.takenAt) : null,
    thumb,
    preview,
  };
}
