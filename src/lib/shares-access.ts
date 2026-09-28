import "server-only";
import { HttpError } from "@/lib/api";
import { prisma } from "@/lib/db";
import type { OrgContext } from "@/lib/org";
import { can } from "@/lib/permissions";
import { shareInclude } from "@/lib/shares-dto";

/** A share link the caller may manage: their own, or any in the org for admins. */
export async function findManageableShare(org: OrgContext, shareId: string) {
  const link = await prisma.shareLink.findFirst({
    where: { id: shareId, orgId: org.org.id },
    include: shareInclude,
  });
  if (!link || (link.createdById !== org.user.id && !can(org.role, "share:manage:any"))) {
    throw new HttpError(404, "Share link not found", "not_found");
  }
  return link;
}
