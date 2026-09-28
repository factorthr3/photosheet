import { z } from "zod";
import { parseJson, requireOrgApi, route } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { toViewer } from "@/lib/boards";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { createShare, createShareSchema } from "@/lib/shares";
import { shareInclude, toShareDto } from "@/lib/shares-dto";

const listQuery = z.object({
  targetType: z.enum(["image", "board"]).optional(),
  targetId: z.string().optional(),
});

/** Share links: admins see all of the org's, everyone else sees their own. */
export const GET = route(async (req: Request, ctx: RouteContext<"/api/o/[slug]/shares">) => {
  const { slug } = await ctx.params;
  const org = await requireOrgApi(req, slug, "share:create");
  const q = listQuery.parse(Object.fromEntries(new URL(req.url).searchParams));
  const links = await prisma.shareLink.findMany({
    where: {
      orgId: org.org.id,
      ...(can(org.role, "share:manage:any") ? {} : { createdById: org.user.id }),
      ...(q.targetType === "board" && q.targetId ? { boardId: q.targetId } : {}),
      ...(q.targetType === "image" && q.targetId ? { imageId: q.targetId } : {}),
    },
    include: shareInclude,
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return Response.json({ shares: links.map(toShareDto) });
});

export const POST = route(async (req: Request, ctx: RouteContext<"/api/o/[slug]/shares">) => {
  const { slug } = await ctx.params;
  const org = await requireOrgApi(req, slug, "share:create");
  const input = await parseJson(req, createShareSchema);
  const link = await createShare(toViewer(org), input);
  await recordAudit({
    orgId: org.org.id,
    userId: org.user.id,
    action: "share.create",
    targetType: "share",
    targetId: link.id,
    meta: {
      target: `${link.targetType}:${link.imageId ?? link.boardId}`,
      expiresAt: link.expiresAt?.toISOString() ?? null,
      password: !!link.passwordHash,
      allowDownload: link.allowDownload,
    },
  });
  const full = await prisma.shareLink.findUniqueOrThrow({
    where: { id: link.id },
    include: shareInclude,
  });
  return Response.json({ share: toShareDto(full) }, { status: 201 });
});
