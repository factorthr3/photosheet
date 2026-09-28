import type { SupportedMimeType } from "./types";

/** Bytes needed from the start of a file to identify it. */
export const MAGIC_BYTES_NEEDED = 64;

const HEIF_BRANDS = new Set([
  "heic",
  "heix",
  "heim",
  "heis",
  "hevc",
  "hevx",
  "heif",
  "mif1",
  "msf1",
]);
const HEIC_BRANDS = new Set(["heic", "heix", "heim", "heis", "hevc", "hevx"]);

function ascii(buf: Uint8Array, start: number, end: number) {
  return String.fromCharCode(...buf.subarray(start, end));
}

function startsWith(buf: Uint8Array, sig: number[], offset = 0) {
  if (buf.length < offset + sig.length) return false;
  return sig.every((b, i) => buf[offset + i] === b);
}

/**
 * Identify a supported image by its leading bytes (never by extension or client-reported type).
 * Returns null for anything we don't accept.
 */
export function detectImageType(buf: Uint8Array): SupportedMimeType | null {
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (ascii(buf, 0, 4) === "RIFF" && ascii(buf, 8, 12) === "WEBP") return "image/webp";
  if (startsWith(buf, [0x49, 0x49, 0x2a, 0x00]) || startsWith(buf, [0x4d, 0x4d, 0x00, 0x2a])) {
    return "image/tiff";
  }
  // BigTIFF
  if (startsWith(buf, [0x49, 0x49, 0x2b, 0x00]) || startsWith(buf, [0x4d, 0x4d, 0x00, 0x2b])) {
    return "image/tiff";
  }
  // ISO-BMFF: [size:4]["ftyp"][major brand:4][minor:4][compatible brands...]
  if (buf.length >= 12 && ascii(buf, 4, 8) === "ftyp") {
    const boxSize = Math.min((buf[0] << 24) | (buf[1] << 16) | (buf[2] << 8) | buf[3], buf.length);
    const brands = [ascii(buf, 8, 12)];
    for (let i = 16; i + 4 <= boxSize; i += 4) brands.push(ascii(buf, i, i + 4));
    if (brands.includes("avif") || brands.includes("avis")) return null;
    if (brands.some((b) => HEIC_BRANDS.has(b))) return "image/heic";
    if (brands.some((b) => HEIF_BRANDS.has(b))) return "image/heif";
  }
  return null;
}
