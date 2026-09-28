import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { z } from "zod";
import type { ShareLink } from "@/generated/prisma/client";
import { HttpError } from "@/lib/api";
import { type BoardViewer, getBoard } from "@/lib/boards";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

/** 24 random bytes → 192-bit, URL-safe token. The token is the only credential for a link. */
export function generateShareToken(): string {
  return randomBytes(24).toString("base64url");
}

export function shareUrl(token: string) {
  return `${env().APP_URL.replace(/\/$/, "")}/s/${token}`;
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => v || null);

export const createShareSchema = z.object({
  targetType: z.enum(["image", "board"]),
  targetId: z.string().min(1),
  title: optionalText(200),
  message: optionalText(2000),
  /** Last day the link works (YYYY-MM-DD); it stops working at the end of that day (UTC). */
  expiresOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullish(),
  password: z.string().min(4, "Use at least 4 characters").max(128).nullish(),
  allowDownload: z.boolean().default(true),
  allowOriginal: z.boolean().default(false),
  allowedPresetIds: z.array(z.string()).max(20).default([]),
});
export type CreateShareInput = z.input<typeof createShareSchema>;

export function expiryFromDate(day: string | null | undefined): Date | null {
  if (!day) return null;
  return new Date(new Date(`${day}T00:00:00.000Z`).getTime() + 86_400_000);
}

export type ShareState = "active" | "expired" | "revoked";

export function shareState(
  link: Pick<ShareLink, "revokedAt" | "expiresAt">,
  now = new Date(),
): ShareState {
  if (link.revokedAt) return "revoked";
  if (link.expiresAt && link.expiresAt <= now) return "expired";
  return "active";
}

/** Create a public link after checking the target and presets belong to the viewer's org. */
export async function createShare(viewer: BoardViewer, input: CreateShareInput) {
  const data = createShareSchema.parse(input);
  let imageId: string | null = null;
  let boardId: string | null = null;
  if (data.targetType === "image") {
    const image = await prisma.image.findFirst({
      where: { id: data.targetId, orgId: viewer.orgId, deletedAt: null, status: "READY" },
      select: { id: true },
    });
    if (!image) throw new HttpError(404, "Image not found", "not_found");
    imageId = image.id;
  } else {
    boardId = (await getBoard(viewer, data.targetId)).id;
  }

  const presets = data.allowedPresetIds.length
    ? await prisma.resizePreset.findMany({
        where: { id: { in: data.allowedPresetIds }, orgId: viewer.orgId },
        select: { id: true },
      })
    : [];

  return prisma.shareLink.create({
    data: {
      orgId: viewer.orgId,
      token: generateShareToken(),
      targetType: data.targetType,
      imageId,
      boardId,
      title: data.title,
      message: data.message,
      passwordHash: data.password ? await hashPassword(data.password) : null,
      expiresAt: expiryFromDate(data.expiresOn),
      allowDownload: data.allowDownload,
      allowOriginal: data.allowDownload && data.allowOriginal,
      allowedPresetIds: data.allowDownload ? presets.map((p) => p.id) : [],
      createdById: viewer.userId,
    },
  });
}

// ─── Password unlock cookie ─────────────────────────────────────────────────────

export const UNLOCK_TTL_SECONDS = 12 * 60 * 60;

export function unlockCookieName(linkId: string) {
  return `ps_unlock_${linkId.replace(/-/g, "")}`;
}

/** HMAC over the link id and current password hash: changing the password logs everyone out. */
export function unlockCookieValue(link: Pick<ShareLink, "id" | "passwordHash">) {
  return createHmac("sha256", env().AUTH_SECRET)
    .update(`${link.id}:${link.passwordHash ?? ""}`)
    .digest("base64url");
}

export function isUnlocked(
  link: Pick<ShareLink, "id" | "passwordHash">,
  cookieValue: string | undefined,
): boolean {
  if (!link.passwordHash) return true;
  if (!cookieValue) return false;
  const expected = Buffer.from(unlockCookieValue(link));
  const given = Buffer.from(cookieValue);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export async function checkSharePassword(link: Pick<ShareLink, "passwordHash">, password: string) {
  if (!link.passwordHash) return true;
  return verifyPassword({ hash: link.passwordHash, password });
}

// ─── Loading for the public page / API ─────────────────────────────────────────

export async function findShareByToken(token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  return prisma.shareLink.findUnique({
    where: { token },
    include: {
      org: { select: { id: true, name: true, slug: true } },
      image: true,
      board: { select: { id: true, name: true, description: true } },
    },
  });
}

export type LoadedShare = NonNullable<Awaited<ReturnType<typeof findShareByToken>>>;

/** Does this share include the image? Board shares cover the board's current live images. */
export async function shareIncludesImage(link: LoadedShare, imageId: string) {
  if (link.targetType === "image") return link.imageId === imageId && !link.image?.deletedAt;
  if (!link.boardId) return false;
  const row = await prisma.boardImage.findFirst({
    where: { boardId: link.boardId, imageId, image: { deletedAt: null, status: "READY" } },
    select: { imageId: true },
  });
  return !!row;
}
