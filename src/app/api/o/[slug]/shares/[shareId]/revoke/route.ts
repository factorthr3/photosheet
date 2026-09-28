import { requireOrgApi, route } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { findManageableShare } from "@/lib/shares-access";
import { shareInclude, toShareDto } from "@/lib/shares-dto";

/** Revoke immediately; the public page then shows "no longer available". */
export const POST = route(
  async (req: Request, ctx: RouteContext<"/api/o/[slug]/shares/[shareId]/revoke">) => {
    const { slug, shareId } = await ctx.params;
    const org = await requireOrgApi(req, slug, "share:create");
    const link = await findManageableShare(org, shareId);
    const updated = await prisma.shareLink.update({
      where: { id: link.id },
      data: { revokedAt: link.revokedAt ?? new Date() },
      include: shareInclude,
    });
    await recordAudit({
      orgId: org.org.id,
      userId: org.user.id,
      action: "share.revoke",
      targetType: "share",
      targetId: link.id,
    });
    return Response.json({ share: toShareDto(updated) });
  },
);
