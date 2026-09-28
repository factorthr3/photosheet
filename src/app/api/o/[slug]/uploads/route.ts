import { randomUUID } from "node:crypto";
import { z } from "zod";
import { parseJson, requireOrgApi, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { sanitizeFilename } from "@/lib/image/filename";
import { claimedMimeType } from "@/lib/image/types";
import { keys, presignUpload } from "@/lib/storage";

const schema = z.object({
  files: z
    .array(
      z.object({
        clientId: z.string().max(64),
        filename: z.string().min(1).max(1000),
        size: z.number().int().positive(),
        type: z.string().max(100),
        sha256: z
          .string()
          .regex(/^[0-9a-f]{64}$/)
          .optional(),
      }),
    )
    .min(1)
    .max(100),
});

/**
 * Reserve Image rows and hand back presigned POST policies so the browser uploads straight to
 * the bucket. The policy pins the key, content type and maximum size.
 */
export const POST = route(async (req: Request, ctx: RouteContext<"/api/o/[slug]/uploads">) => {
  const { slug } = await ctx.params;
  const org = await requireOrgApi(req, slug, "image:upload");
  const { files } = await parseJson(req, schema);
  const maxBytes = env().MAX_UPLOAD_MB * 1024 * 1024;

  const uploads = [];
  const rejected = [];
  for (const file of files) {
    const mimeType = claimedMimeType(file.filename, file.type);
    if (!mimeType) {
      rejected.push({ clientId: file.clientId, reason: "Unsupported file type" });
      continue;
    }
    if (file.size > maxBytes) {
      rejected.push({ clientId: file.clientId, reason: `Larger than ${env().MAX_UPLOAD_MB} MB` });
      continue;
    }

    const id = randomUUID();
    const storageKey = keys.original(org.org.id, id);
    await prisma.image.create({
      data: {
        id,
        orgId: org.org.id,
        uploaderId: org.user.id,
        filename: sanitizeFilename(file.filename),
        storageKey,
        mimeType,
        bytes: file.size,
        sha256: file.sha256 ?? null,
        status: "UPLOADING",
      },
    });
    const post = await presignUpload(storageKey, mimeType, maxBytes);
    uploads.push({ clientId: file.clientId, imageId: id, url: post.url, fields: post.fields });
  }

  return Response.json({ uploads, rejected });
});
