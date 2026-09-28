import { z } from "zod";

/**
 * Resize/convert parameters. Canonicalised before hashing so equivalent requests share one cached
 * rendition. Client-safe.
 */
export const FITS = ["contain", "cover", "fill"] as const;
export type Fit = (typeof FITS)[number];
export const FIT_LABELS: Record<Fit, string> = {
  contain: "Fit inside",
  cover: "Crop to fill",
  fill: "Exact (stretch)",
};

export const FORMATS = ["jpeg", "png", "webp", "avif"] as const;
export type OutputFormat = (typeof FORMATS)[number];
export const FORMAT_INFO: Record<
  OutputFormat,
  { label: string; ext: string; mime: string; lossy: boolean }
> = {
  jpeg: { label: "JPEG", ext: "jpg", mime: "image/jpeg", lossy: true },
  png: { label: "PNG", ext: "png", mime: "image/png", lossy: false },
  webp: { label: "WebP", ext: "webp", mime: "image/webp", lossy: true },
  avif: { label: "AVIF", ext: "avif", mime: "image/avif", lossy: true },
};

export const MAX_DIMENSION = 12_000;

const dim = z.number().int().min(1).max(MAX_DIMENSION).nullable().optional();

export const renderParamsSchema = z
  .object({
    width: dim,
    height: dim,
    fit: z.enum(FITS).default("contain"),
    format: z.enum(FORMATS).default("jpeg"),
    quality: z.number().int().min(1).max(100).default(85),
    stripMetadata: z.boolean().default(true),
  })
  .refine((p) => p.fit === "contain" || (p.width && p.height), {
    message: "Crop and exact sizes need both a width and a height",
    path: ["fit"],
  });

export type RenderParamsInput = z.input<typeof renderParamsSchema>;

export interface RenderParams {
  width: number | null;
  height: number | null;
  fit: Fit;
  format: OutputFormat;
  quality: number;
  stripMetadata: boolean;
}

/** Validate + normalise (fixed key order, irrelevant fields zeroed) so hashes are stable. */
export function canonicalParams(input: RenderParamsInput): RenderParams {
  const p = renderParamsSchema.parse(input);
  const width = p.width ?? null;
  const height = p.height ?? null;
  return {
    width,
    height,
    // With a single dimension every fit behaves like "contain".
    fit: width && height ? p.fit : "contain",
    format: p.format,
    // PNG is lossless; quality doesn't apply.
    quality: FORMAT_INFO[p.format].lossy ? p.quality : 100,
    stripMetadata: p.stripMetadata,
  };
}

/** Stable cache key for (params). Combined with the image id in the Rendition unique index. */
export async function paramsHash(params: RenderParams): Promise<string> {
  const json = JSON.stringify([
    params.width,
    params.height,
    params.fit,
    params.format,
    params.quality,
    params.stripMetadata,
  ]);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(json));
  return Array.from(new Uint8Array(digest).slice(0, 16), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

/**
 * Predicted output size — lets the UI show dimensions before the render finishes.
 * `contain` never enlarges; `cover` and `fill` always produce exactly width × height.
 */
export function outputSize(src: { width: number; height: number }, p: RenderParams) {
  const { width: w, height: h } = p;
  if (!w && !h) return { width: src.width, height: src.height };
  if (p.fit !== "contain" && w && h) return { width: w, height: h };
  const scale = Math.min(1, w ? w / src.width : Infinity, h ? h / src.height : Infinity);
  return {
    width: Math.max(1, Math.round(src.width * scale)),
    height: Math.max(1, Math.round(src.height * scale)),
  };
}

/** Human summary, e.g. "2048 × 1365 · JPEG 85". */
export function describeParams(p: RenderParams, src?: { width: number; height: number }) {
  const size = src
    ? (() => {
        const o = outputSize(src, p);
        return `${o.width} × ${o.height}`;
      })()
    : p.width || p.height
      ? `${p.width ?? "auto"} × ${p.height ?? "auto"}`
      : "Original size";
  const fmt = FORMAT_INFO[p.format].label + (FORMAT_INFO[p.format].lossy ? ` ${p.quality}` : "");
  return `${size} · ${fmt}`;
}

export interface PresetDefinition {
  name: string;
  width: number | null;
  height: number | null;
  fit: Fit;
  format: OutputFormat;
  quality: number;
  stripMetadata: boolean;
}

/** Seeded for every organisation; admins can edit them. */
export const DEFAULT_PRESETS: PresetDefinition[] = [
  {
    name: "Web large",
    width: 2048,
    height: 2048,
    fit: "contain",
    format: "jpeg",
    quality: 85,
    stripMetadata: true,
  },
  {
    name: "Web medium",
    width: 1200,
    height: 1200,
    fit: "contain",
    format: "jpeg",
    quality: 82,
    stripMetadata: true,
  },
  {
    name: "Social square",
    width: 1080,
    height: 1080,
    fit: "cover",
    format: "jpeg",
    quality: 88,
    stripMetadata: true,
  },
  {
    name: "Social story",
    width: 1080,
    height: 1920,
    fit: "cover",
    format: "jpeg",
    quality: 88,
    stripMetadata: true,
  },
  {
    name: "Thumbnail",
    width: 400,
    height: 400,
    fit: "contain",
    format: "jpeg",
    quality: 80,
    stripMetadata: true,
  },
  {
    name: "Print",
    width: null,
    height: null,
    fit: "contain",
    format: "jpeg",
    quality: 100,
    stripMetadata: false,
  },
];

/** Download filename for a rendition, e.g. "harbour-2048x1365.jpg". */
export function renditionFilename(
  original: string,
  size: { width: number; height: number },
  format: OutputFormat,
) {
  const base = original.replace(/\.[^.]+$/, "") || "image";
  return `${base}-${size.width}x${size.height}.${FORMAT_INFO[format].ext}`;
}
