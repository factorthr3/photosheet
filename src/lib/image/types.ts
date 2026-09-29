/** Upload formats accepted by PhotoSheet, keyed by canonical MIME type. */
export const SUPPORTED_UPLOAD_TYPES = {
  "image/jpeg": { label: "JPEG", extensions: ["jpg", "jpeg", "jpe"] },
  "image/png": { label: "PNG", extensions: ["png"] },
  "image/webp": { label: "WebP", extensions: ["webp"] },
  "image/heic": { label: "HEIC", extensions: ["heic", "heics"] },
  "image/heif": { label: "HEIF", extensions: ["heif", "heifs", "hif"] },
  "image/tiff": { label: "TIFF", extensions: ["tif", "tiff"] },
} as const;

export type SupportedMimeType = keyof typeof SUPPORTED_UPLOAD_TYPES;

export const SUPPORTED_MIME_TYPES = Object.keys(SUPPORTED_UPLOAD_TYPES) as SupportedMimeType[];

/** `accept` attribute for file inputs. */
export const UPLOAD_ACCEPT = [
  ...SUPPORTED_MIME_TYPES,
  ...Object.values(SUPPORTED_UPLOAD_TYPES).flatMap((t) => t.extensions.map((e) => `.${e}`)),
].join(",");

export function isSupportedMimeType(value: string): value is SupportedMimeType {
  return value in SUPPORTED_UPLOAD_TYPES;
}

export function extensionOf(filename: string): string {
  const i = filename.lastIndexOf(".");
  return i === -1 ? "" : filename.slice(i + 1).toLowerCase();
}

/**
 * Best guess at a MIME type from the browser-reported type and the extension. Browsers often
 * report "" for HEIC/TIFF. This is only a hint for the upload policy — the real type is decided
 * from magic bytes after upload.
 */
export function claimedMimeType(filename: string, browserType: string): SupportedMimeType | null {
  const t = browserType.toLowerCase();
  if (t === "image/jpg" || t === "image/pjpeg") return "image/jpeg";
  if (isSupportedMimeType(t)) return t;
  const ext = extensionOf(filename);
  for (const [mime, info] of Object.entries(SUPPORTED_UPLOAD_TYPES)) {
    if ((info.extensions as readonly string[]).includes(ext)) return mime as SupportedMimeType;
  }
  return null;
}

/** Browsers can display these originals directly (others need a converted rendition). */
export function isBrowserViewable(mimeType: string) {
  return ["image/jpeg", "image/png", "image/webp"].includes(mimeType);
}
