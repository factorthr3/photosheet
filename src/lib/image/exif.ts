import exifr from "exifr";

/** The EXIF subset we keep on Image.exif (JSON-safe). */
export interface ExifSummary {
  make?: string;
  model?: string;
  lens?: string;
  exposureTime?: number;
  fNumber?: number;
  iso?: number;
  focalLength?: number;
  orientation?: number;
  takenAt?: string;
  latitude?: number;
  longitude?: number;
  artist?: string;
  copyright?: string;
  description?: string;
}

const str = (v: unknown) =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, 500) : undefined;
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

/** Parse EXIF/TIFF/GPS tags from an original file. Never throws — images without EXIF are fine. */
export async function extractExif(buffer: Buffer): Promise<ExifSummary> {
  let raw: Record<string, unknown> | undefined;
  try {
    raw = await exifr.parse(buffer, {
      tiff: true,
      exif: true,
      gps: true,
      ifd1: false,
      interop: false,
      xmp: false,
      icc: false,
      iptc: false,
      translateValues: false,
      reviveValues: true,
    });
  } catch {
    return {};
  }
  if (!raw) return {};

  const taken = raw.DateTimeOriginal ?? raw.CreateDate ?? raw.DateTime;
  const takenAt =
    taken instanceof Date && !Number.isNaN(taken.getTime()) ? taken.toISOString() : undefined;

  const summary: ExifSummary = {
    make: str(raw.Make),
    model: str(raw.Model),
    lens: str(raw.LensModel),
    exposureTime: num(raw.ExposureTime),
    fNumber: num(raw.FNumber),
    iso: num(raw.ISO),
    focalLength: num(raw.FocalLength),
    orientation: num(raw.Orientation),
    takenAt,
    latitude: num(raw.latitude),
    longitude: num(raw.longitude),
    artist: str(raw.Artist),
    copyright: str(raw.Copyright),
    description: str(raw.ImageDescription),
  };
  return Object.fromEntries(
    Object.entries(summary).filter(([, v]) => v !== undefined),
  ) as ExifSummary;
}

/** Human-readable camera settings line, e.g. "Canon EOS R5 · 50 mm · f/1.8 · 1/250 s · ISO 400". */
export function describeExposure(exif: ExifSummary | null | undefined): string | null {
  if (!exif) return null;
  const parts: string[] = [];
  const camera = [exif.make, exif.model]
    .filter(Boolean)
    .join(" ")
    .replace(/^(\w+) \1 /i, "$1 ");
  if (camera) parts.push(camera);
  if (exif.focalLength) parts.push(`${Math.round(exif.focalLength)} mm`);
  if (exif.fNumber) parts.push(`f/${exif.fNumber}`);
  if (exif.exposureTime) {
    parts.push(
      exif.exposureTime >= 1
        ? `${exif.exposureTime} s`
        : `1/${Math.round(1 / exif.exposureTime)} s`,
    );
  }
  if (exif.iso) parts.push(`ISO ${exif.iso}`);
  return parts.length ? parts.join(" · ") : null;
}
