import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { shareState, shareUrl } from "@/lib/shares";

export const shareInclude = {
  image: { select: { id: true, filename: true, title: true } },
  board: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true, email: true } },
} satisfies Prisma.ShareLinkInclude;

type ShareRow = Prisma.ShareLinkGetPayload<{ include: typeof shareInclude }>;

export interface ShareDto {
  id: string;
  url: string;
  targetType: "image" | "board";
  targetId: string;
  targetName: string;
  title: string | null;
  message: string | null;
  state: "active" | "expired" | "revoked";
  expiresAt: string | null;
  hasPassword: boolean;
  allowDownload: boolean;
  allowOriginal: boolean;
  allowedPresetIds: string[];
  views: number;
  downloads: number;
  lastViewedAt: string | null;
  createdAt: string;
  createdBy: string | null;
  createdById: string | null;
}

export function toShareDto(s: ShareRow): ShareDto {
  return {
    id: s.id,
    url: shareUrl(s.token),
    targetType: s.targetType as ShareDto["targetType"],
    targetId: (s.imageId ?? s.boardId)!,
    targetName: s.board?.name ?? (s.image ? s.image.title || s.image.filename : "Deleted"),
    title: s.title,
    message: s.message,
    state: shareState(s),
    expiresAt: s.expiresAt?.toISOString() ?? null,
    hasPassword: !!s.passwordHash,
    allowDownload: s.allowDownload,
    allowOriginal: s.allowOriginal,
    allowedPresetIds: s.allowedPresetIds,
    views: s.views,
    downloads: s.downloads,
    lastViewedAt: s.lastViewedAt?.toISOString() ?? null,
    createdAt: s.createdAt.toISOString(),
    createdBy: s.createdBy ? s.createdBy.name || s.createdBy.email : null,
    createdById: s.createdById,
  };
}
