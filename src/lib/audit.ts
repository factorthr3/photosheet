import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

export type AuditAction =
  | "org.create"
  | "org.update"
  | "member.invite"
  | "member.invite_cancel"
  | "member.join"
  | "member.role_change"
  | "member.remove"
  | "image.upload"
  | "image.update"
  | "image.bulk_update"
  | "image.trash"
  | "image.restore"
  | "image.purge"
  | "image.download"
  | "board.create"
  | "board.update"
  | "board.delete"
  | "board.share_internal"
  | "share.create"
  | "share.revoke"
  | "share.email"
  | "export.zip"
  | "export.pdf"
  | "preset.create"
  | "preset.update"
  | "preset.delete";

export type AuditTargetType =
  "organization" | "member" | "invitation" | "image" | "board" | "share" | "export" | "preset";

export interface AuditInput {
  orgId: string;
  userId: string | null;
  action: AuditAction;
  targetType: AuditTargetType;
  targetId?: string | null;
  meta?: Prisma.InputJsonValue;
}

/** Append an event to the organisation's audit log. Failures are logged, never thrown. */
export async function recordAudit(input: AuditInput, db: Prisma.TransactionClient = prisma) {
  try {
    await db.auditEvent.create({
      data: {
        orgId: input.orgId,
        userId: input.userId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId ?? null,
        meta: input.meta ?? {},
      },
    });
  } catch (err) {
    console.error("[audit] failed to record event", input.action, err);
  }
}
