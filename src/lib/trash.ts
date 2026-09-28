import { prisma } from "@/lib/db";
import { can, type Role } from "@/lib/permissions";
import { deleteObjects, deletePrefix, keys } from "@/lib/storage";

/** Images stay in Trash this long before the purge job deletes them for good. */
export const TRASH_RETENTION_DAYS = 30;
const DAY = 86_400_000;

export interface Actor {
  orgId: string;
  userId: string;
  role: Role;
}

/** Editors may only trash/restore what they uploaded; admins may act on anything. */
function ownershipFilter(actor: Actor) {
  return can(actor.role, "image:delete:any") ? {} : { uploaderId: actor.userId };
}

export async function trashImages(actor: Actor, imageIds: string[]) {
  const targets = await prisma.image.findMany({
    where: { id: { in: imageIds }, orgId: actor.orgId, deletedAt: null, ...ownershipFilter(actor) },
    select: { id: true, filename: true },
  });
  await prisma.image.updateMany({
    where: { id: { in: targets.map((t) => t.id) } },
    data: { deletedAt: new Date(), deletedById: actor.userId },
  });
  return { trashed: targets, skipped: imageIds.length - targets.length };
}

export async function restoreImages(actor: Actor, imageIds: string[]) {
  const targets = await prisma.image.findMany({
    where: {
      id: { in: imageIds },
      orgId: actor.orgId,
      deletedAt: { not: null },
      ...ownershipFilter(actor),
    },
    select: { id: true, filename: true },
  });
  await prisma.image.updateMany({
    where: { id: { in: targets.map((t) => t.id) } },
    data: { deletedAt: null, deletedById: null },
  });
  return { restored: targets, skipped: imageIds.length - targets.length };
}

/**
 * Permanently delete images: every stored file (original, thumbnails, renditions), then the rows
 * (renditions, board entries and share links cascade). Only images already in Trash.
 */
export async function purgeImages(where: { orgId?: string; ids?: string[]; deletedBefore?: Date }) {
  const images = await prisma.image.findMany({
    where: {
      deletedAt: where.deletedBefore ? { lt: where.deletedBefore } : { not: null },
      ...(where.orgId ? { orgId: where.orgId } : {}),
      ...(where.ids ? { id: { in: where.ids } } : {}),
    },
    select: { id: true, orgId: true, filename: true },
    take: 1000,
  });
  for (const img of images) {
    await deletePrefix(keys.imagePrefix(img.orgId, img.id));
    await prisma.image.delete({ where: { id: img.id } }).catch(() => {});
  }
  return images;
}

export function daysLeftInTrash(deletedAt: Date | string, now = new Date()) {
  const expires = new Date(deletedAt).getTime() + TRASH_RETENTION_DAYS * DAY;
  return Math.max(0, Math.ceil((expires - now.getTime()) / DAY));
}

/** Uploads that never completed (tab closed mid-upload) after this long are cleaned up. */
export const STALE_UPLOAD_MS = DAY;

export async function cleanupStaleUploads(now = new Date()) {
  const stale = await prisma.image.findMany({
    where: { status: "UPLOADING", createdAt: { lt: new Date(now.getTime() - STALE_UPLOAD_MS) } },
    select: { id: true, storageKey: true },
    take: 1000,
  });
  if (stale.length) {
    await deleteObjects(stale.map((s) => s.storageKey));
    await prisma.image.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } });
  }
  return stale.length;
}

export async function cleanupExpiredExports(now = new Date()) {
  const expired = await prisma.export.findMany({
    where: { expiresAt: { lt: now } },
    select: { id: true, storageKey: true },
    take: 1000,
  });
  const withFiles = expired.map((e) => e.storageKey).filter((k): k is string => !!k);
  if (withFiles.length) await deleteObjects(withFiles);
  if (expired.length)
    await prisma.export.deleteMany({ where: { id: { in: expired.map((e) => e.id) } } });
  return expired.length;
}

export async function cleanupRateLimits(now = new Date()) {
  const { count } = await prisma.rateLimitBucket.deleteMany({
    where: { windowStart: { lt: new Date(now.getTime() - DAY) } },
  });
  return count;
}
