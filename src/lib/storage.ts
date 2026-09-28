import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  NotFound,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Readable } from "node:stream";
import { env } from "@/lib/env";

/**
 * S3-compatible storage (Railway Bucket, MinIO locally, S3/R2 later — config only).
 * The bucket is private: clients only ever see short-lived presigned URLs.
 */

let client: S3Client | undefined;

export function s3(): S3Client {
  if (!client) {
    const e = env();
    client = new S3Client({
      endpoint: e.S3_ENDPOINT,
      region: e.S3_REGION,
      forcePathStyle: e.S3_FORCE_PATH_STYLE,
      credentials: { accessKeyId: e.S3_ACCESS_KEY_ID, secretAccessKey: e.S3_SECRET_ACCESS_KEY },
      // Default CRC checksums aren't supported by every S3-compatible store.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }
  return client;
}

const bucket = () => env().S3_BUCKET;

// ─── Keys ──────────────────────────────────────────────────────────────────────

export const keys = {
  original: (orgId: string, imageId: string) => `orgs/${orgId}/images/${imageId}/original`,
  thumb: (orgId: string, imageId: string) => `orgs/${orgId}/images/${imageId}/thumb-320.webp`,
  preview: (orgId: string, imageId: string) => `orgs/${orgId}/images/${imageId}/preview-1280.webp`,
  rendition: (orgId: string, imageId: string, hash: string, ext: string) =>
    `orgs/${orgId}/images/${imageId}/renditions/${hash}.${ext}`,
  imagePrefix: (orgId: string, imageId: string) => `orgs/${orgId}/images/${imageId}/`,
  export: (orgId: string, exportId: string, ext: string) =>
    `orgs/${orgId}/exports/${exportId}.${ext}`,
};

// ─── Presigning ────────────────────────────────────────────────────────────────

/** RFC 6266 Content-Disposition with an ASCII fallback and UTF-8 filename*. */
export function contentDisposition(filename: string, type: "attachment" | "inline" = "attachment") {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export interface PresignGetOptions {
  /** Seconds the URL stays valid (default 300). */
  expiresIn?: number;
  /** Force a download with this filename. */
  downloadAs?: string;
  /**
   * Sign against a fixed time window so repeated requests produce the same URL and browsers can
   * cache thumbnails. The URL stays valid for between `expiresIn - window` and `expiresIn`.
   */
  cacheWindowSeconds?: number;
}

export async function presignGet(key: string, opts: PresignGetOptions = {}): Promise<string> {
  const expiresIn = opts.expiresIn ?? 300;
  let signingDate: Date | undefined;
  if (opts.cacheWindowSeconds) {
    const w = opts.cacheWindowSeconds * 1000;
    signingDate = new Date(Math.floor(Date.now() / w) * w);
  }
  const command = new GetObjectCommand({
    Bucket: bucket(),
    Key: key,
    ResponseContentDisposition: opts.downloadAs ? contentDisposition(opts.downloadAs) : undefined,
  });
  return getSignedUrl(s3(), command, { expiresIn, signingDate });
}

/** Thumbnail/preview URLs: stable for an hour so the browser cache works, valid for 1–2h. */
export function presignThumb(key: string) {
  return presignGet(key, { expiresIn: 7200, cacheWindowSeconds: 3600 });
}

/** Browser POST upload restricted to one key, content type and size range. */
export async function presignUpload(key: string, contentType: string, maxBytes: number) {
  return createPresignedPost(s3(), {
    Bucket: bucket(),
    Key: key,
    Expires: 900,
    Fields: { "Content-Type": contentType },
    Conditions: [
      ["eq", "$Content-Type", contentType],
      ["content-length-range", 1, maxBytes],
    ],
  });
}

// ─── Object operations ─────────────────────────────────────────────────────────

export async function headObject(key: string) {
  try {
    const res = await s3().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
    return { bytes: res.ContentLength ?? 0, contentType: res.ContentType ?? null };
  } catch (err) {
    if (err instanceof NotFound || (err as { name?: string }).name === "NotFound") return null;
    throw err;
  }
}

export async function getObjectStream(key: string): Promise<Readable> {
  const res = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  return res.Body as Readable;
}

export async function getObjectBuffer(key: string, range?: { start: number; end: number }) {
  const res = await s3().send(
    new GetObjectCommand({
      Bucket: bucket(),
      Key: key,
      Range: range ? `bytes=${range.start}-${range.end}` : undefined,
    }),
  );
  const bytes = await res.Body!.transformToByteArray();
  return Buffer.from(bytes);
}

export async function putObject(
  key: string,
  body: Buffer,
  contentType: string,
  cacheControl = "private, max-age=31536000, immutable",
) {
  await s3().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: cacheControl,
    }),
  );
}

/** Stream an arbitrarily large body to storage with a multipart upload. */
export async function uploadStream(key: string, body: Readable, contentType: string) {
  const upload = new Upload({
    client: s3(),
    params: { Bucket: bucket(), Key: key, Body: body, ContentType: contentType },
    queueSize: 4,
    partSize: 8 * 1024 * 1024,
  });
  await upload.done();
}

export async function deleteObjects(keysToDelete: string[]) {
  for (let i = 0; i < keysToDelete.length; i += 1000) {
    const chunk = keysToDelete.slice(i, i + 1000);
    if (chunk.length === 0) continue;
    await s3().send(
      new DeleteObjectsCommand({
        Bucket: bucket(),
        Delete: { Objects: chunk.map((Key) => ({ Key })), Quiet: true },
      }),
    );
  }
}

/** Delete every object under a prefix (e.g. all files for one image). */
export async function deletePrefix(prefix: string) {
  let token: string | undefined;
  do {
    const res = await s3().send(
      new ListObjectsV2Command({ Bucket: bucket(), Prefix: prefix, ContinuationToken: token }),
    );
    await deleteObjects((res.Contents ?? []).map((o) => o.Key!).filter(Boolean));
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
}
