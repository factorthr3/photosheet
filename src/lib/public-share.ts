import "server-only";
import { cookies } from "next/headers";
import { assertSameOrigin, HttpError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { canonicalParams, describeParams, type RenderParams } from "@/lib/image/render-params";
import { licenceLabel } from "@/lib/images/licence";
import { clientIp, enforceRateLimit } from "@/lib/rate-limit";
import {
  findShareByToken,
  isUnlocked,
  type LoadedShare,
  shareState,
  unlockCookieName,
} from "@/lib/shares";
import { presignThumb } from "@/lib/storage";

/**
 * Gate for every public share endpoint: link exists and is active, the password (if any) has been
 * entered, and the caller is within the per-IP rate limit.
 */
export async function requirePublicShare(
  req: Request,
  token: string,
  opts: { limit?: number; windowSeconds?: number; bucket?: string } = {},
): Promise<LoadedShare> {
  assertSameOrigin(req);
  await enforceRateLimit(
    `share:${opts.bucket ?? "api"}:${clientIp(req.headers)}:${token.slice(0, 12)}`,
    opts.limit ?? 300,
    opts.windowSeconds ?? 60,
  );
  const link = await findShareByToken(token);
  if (!link) throw new HttpError(404, "This link doesn't exist", "not_found");
  if (shareState(link) !== "active")
    throw new HttpError(410, "This link is no longer available", "gone");
  const cookie = (await cookies()).get(unlockCookieName(link.id))?.value;
  if (!isUnlocked(link, cookie)) throw new HttpError(401, "Password required", "password_required");
  return link;
}

export interface PublicImage {
  id: string;
  name: string;
  description: string | null;
  credit: string | null;
  copyright: string | null;
  licence: string | null;
  licenceExpired: boolean;
  width: number | null;
  height: number | null;
  thumbUrl: string | null;
  previewUrl: string | null;
}

async function toPublicImage(i: {
  id: string;
  title: string | null;
  filename: string;
  description: string | null;
  credit: string | null;
  copyright: string | null;
  licence: string | null;
  licenceExpiresAt: Date | null;
  width: number | null;
  height: number | null;
  thumbKey: string | null;
  previewKey: string | null;
}): Promise<PublicImage> {
  return {
    id: i.id,
    name: i.title || i.filename,
    description: i.description,
    credit: i.credit,
    copyright: i.copyright,
    licence: licenceLabel(i.licence),
    licenceExpired: !!i.licenceExpiresAt && i.licenceExpiresAt <= new Date(),
    width: i.width,
    height: i.height,
    thumbUrl: i.thumbKey ? await presignThumb(i.thumbKey) : null,
    previewUrl: i.previewKey ? await presignThumb(i.previewKey) : null,
  };
}

const PAGE = 60;

/** Images in a share (board order for boards), keyset-paged on position. */
export async function listShareImages(link: LoadedShare, cursor?: number | null) {
  if (link.targetType === "image") {
    const img =
      link.image && !link.image.deletedAt && link.image.status === "READY" ? link.image : null;
    return { images: img ? [await toPublicImage(img)] : [], nextCursor: null, total: img ? 1 : 0 };
  }
  const where = { boardId: link.boardId!, image: { deletedAt: null, status: "READY" as const } };
  const [rows, total] = await Promise.all([
    prisma.boardImage.findMany({
      where:
        cursor === null || cursor === undefined ? where : { ...where, position: { gt: cursor } },
      orderBy: { position: "asc" },
      take: PAGE,
      include: { image: true },
    }),
    cursor === null || cursor === undefined
      ? prisma.boardImage.count({ where })
      : Promise.resolve(null),
  ]);
  return {
    images: await Promise.all(rows.map((r) => toPublicImage(r.image))),
    nextCursor: rows.length === PAGE ? rows[rows.length - 1].position : null,
    total,
  };
}

export interface ShareVariant {
  id: string;
  label: string;
  detail: string;
  params: RenderParams | null;
}

/** Download options the link allows: "original" and/or the chosen presets (snapshotted now). */
export async function shareVariants(link: LoadedShare): Promise<ShareVariant[]> {
  if (!link.allowDownload) return [];
  const out: ShareVariant[] = [];
  if (link.allowOriginal)
    out.push({
      id: "original",
      label: "Original",
      detail: "Full-quality original file",
      params: null,
    });
  if (link.allowedPresetIds.length) {
    const presets = await prisma.resizePreset.findMany({
      where: { id: { in: link.allowedPresetIds }, orgId: link.orgId },
      orderBy: { position: "asc" },
    });
    for (const p of presets) {
      const params = canonicalParams({
        width: p.width,
        height: p.height,
        fit: p.fit as RenderParams["fit"],
        format: p.format as RenderParams["format"],
        quality: p.quality,
        stripMetadata: p.stripMetadata,
      });
      out.push({ id: p.id, label: p.name, detail: describeParams(params), params });
    }
  }
  return out;
}
