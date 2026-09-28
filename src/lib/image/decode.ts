import heicDecode from "heic-decode";
import sharp, { type Sharp } from "sharp";

// Keep libvips memory in check on small containers.
sharp.cache({ memory: 200, files: 0, items: 100 });
sharp.concurrency(Math.max(1, Math.min(4, Number(process.env.SHARP_CONCURRENCY ?? 2))));

export const MAX_INPUT_PIXELS = 300_000_000;

const isHeif = (mimeType: string) => mimeType === "image/heic" || mimeType === "image/heif";

/**
 * Open an original as a sharp pipeline, already rotated upright.
 * sharp's prebuilt libvips can't decode HEVC-based HEIC, so HEIC/HEIF is decoded with libheif
 * (WASM) to raw RGBA first. libheif applies the container's rotation itself.
 */
export async function openImage(buffer: Buffer, mimeType: string): Promise<Sharp> {
  if (isHeif(mimeType)) {
    const { width, height, data } = await heicDecode({ buffer });
    return sharp(Buffer.from(data.buffer, data.byteOffset, data.byteLength), {
      raw: { width, height, channels: 4 },
      limitInputPixels: MAX_INPUT_PIXELS,
    });
  }
  return sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" }).rotate();
}

/** Upright pixel dimensions of an original. */
export async function uprightSize(buffer: Buffer, mimeType: string) {
  if (isHeif(mimeType)) {
    const img = await openImage(buffer, mimeType);
    const meta = await img.metadata();
    return { width: meta.width, height: meta.height };
  }
  const meta = await sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
  // Orientations 5–8 swap width and height.
  const swap = (meta.orientation ?? 1) >= 5;
  return swap
    ? { width: meta.height, height: meta.width }
    : { width: meta.width, height: meta.height };
}
