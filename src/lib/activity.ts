import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { HttpError } from "@/lib/api";
import { ACTIVITY_GROUPS } from "@/lib/activity-describe";
import { prisma } from "@/lib/db";

export interface ActivityItem {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  meta: Record<string, unknown>;
  createdAt: string;
  actor: { id: string; name: string } | null;
}

const PAGE = 50;

/** Audit events for an org, newest first, optionally filtered by group or person. */
export async function listActivity(
  orgId: string,
  opts: { cursor?: string; group?: string; userId?: string } = {},
) {
  const where: Prisma.AuditEventWhereInput = { orgId };
  const group = opts.group ? ACTIVITY_GROUPS[opts.group] : undefined;
  if (group) where.OR = group.prefixes.map((p) => ({ action: { startsWith: p } }));
  if (opts.userId) where.userId = opts.userId;
  if (opts.cursor) {
    let at: Date, id: string;
    try {
      [at, id] = JSON.parse(Buffer.from(opts.cursor, "base64url").toString("utf8"));
      at = new Date(at);
    } catch {
      throw new HttpError(400, "Invalid cursor", "invalid");
    }
    where.AND = [{ OR: [{ createdAt: { lt: at } }, { createdAt: at, id: { lt: id } }] }];
  }
  const rows = await prisma.auditEvent.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: PAGE,
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  const last = rows[rows.length - 1];
  return {
    events: rows.map((r): ActivityItem => ({
      id: r.id,
      action: r.action,
      targetType: r.targetType,
      targetId: r.targetId,
      meta: (r.meta ?? {}) as Record<string, unknown>,
      createdAt: r.createdAt.toISOString(),
      actor: r.user ? { id: r.user.id, name: r.user.name || r.user.email } : null,
    })),
    nextCursor:
      rows.length === PAGE
        ? Buffer.from(JSON.stringify([last.createdAt.toISOString(), last.id])).toString("base64url")
        : null,
  };
}
