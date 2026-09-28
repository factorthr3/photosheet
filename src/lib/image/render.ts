import sharp from "sharp";
import { openImage } from "./decode";
import type { RenderParams } from "./render-params";

const FIT_TO_SHARP = { contain: "inside", cover: "cover", fill: "fill" } as const;

/**
 * Produce a rendition from an original. The original buffer is never modified.
 * - contain: fit within the box, never enlarge
 * - cover: crop to exactly width × height, keeping the most interesting region
 * - fill: stretch to exactly width × height
 */
export async function renderImage(original: Buffer, mimeType: string, p: RenderParams) {
  let img = await openImage(original, mimeType);

  if (p.width || p.height) {
    img = img.resize({
      width: p.width ?? undefined,
      height: p.height ?? undefined,
      fit: FIT_TO_SHARP[p.fit],
      position: p.fit === "cover" ? sharp.strategy.attention : undefined,
      withoutEnlargement: p.fit === "contain",
    });
  }

  // sharp drops EXIF/XMP/GPS by default; keep them only when asked.
  img = p.stripMetadata ? img.toColorspace("srgb") : img.keepMetadata();

  switch (p.format) {
    case "jpeg":
      img = img.jpeg({
        quality: p.quality,
        mozjpeg: true,
        chromaSubsampling: p.quality >= 90 ? "4:4:4" : "4:2:0",
      });
      break;
    case "png":
      img = img.png({ compressionLevel: 9, adaptiveFiltering: true });
      break;
    case "webp":
      img = img.webp({ quality: p.quality, effort: 4 });
      break;
    case "avif":
      img = img.avif({ quality: p.quality, effort: 4 });
      break;
  }

  const { data, info } = await img.toBuffer({ resolveWithObject: true });
  return { buffer: data, width: info.width, height: info.height, bytes: data.length };
}
