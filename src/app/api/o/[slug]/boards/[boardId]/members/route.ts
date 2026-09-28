import { z } from "zod";
import { HttpError, parseJson, requireOrgApi, route } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { getBoard, toViewer } from "@/lib/boards";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { boardSharedInternallyEmail } from "@/lib/email-templates";
import { env } from "@/lib/env";

type Ctx = RouteContext<"/api/o/[slug]/boards/[boardId]/members">;

async function membersOf(boardId: string) {
  const rows = await prisma.boardMember.findMany({
    where: { boardId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => ({ userId: r.user.id, name: r.user.name, email: r.user.email }));
}

/** Internal sharing: who the board is shared with, and who it could be shared with. */
export const GET = route(async (req: Request, ctx: Ctx) => {
  const { slug, boardId } = await ctx.params;
  const org = await requireOrgApi(req, slug, "board:view");
  const board = await getBoard(toViewer(org), boardId);
  const orgMembers = await prisma.member.findMany({
    where: { organizationId: org.org.id },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  return Response.json({
    visibility: board.visibility,
    createdById: board.createdById,
    members: await membersOf(board.id),
    candidates: orgMembers
      .map((m) => ({ userId: m.user.id, name: m.user.name, email: m.user.email, role: m.role }))
      .filter((m) => m.userId !== org.user.id),
  });
});

const addSchema = z.object({
  userIds: z.array(z.string()).min(1).max(100),
  notify: z.boolean().default(true),
});

/** Share the board with colleagues (grants access if private) and email them. */
export const POST = route(async (req: Request, ctx: Ctx) => {
  const { slug, boardId } = await ctx.params;
  const org = await requireOrgApi(req, slug, "board:edit");
  const board = await getBoard(toViewer(org), boardId);
  const { userIds, notify } = await parseJson(req, addSchema);

  const valid = await prisma.member.findMany({
    where: { organizationId: org.org.id, userId: { in: userIds } },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  if (valid.length === 0)
    throw new HttpError(400, "Those people aren't in this organisation", "invalid");

  const existing = new Set(
    (
      await prisma.boardMember.findMany({ where: { boardId: board.id }, select: { userId: true } })
    ).map((m) => m.userId),
  );
  const added = valid.filter((m) => !existing.has(m.userId));
  await prisma.boardMember.createMany({
    data: added.map((m) => ({ boardId: board.id, userId: m.userId, addedById: org.user.id })),
    skipDuplicates: true,
  });

  if (notify) {
    const url = `${env().APP_URL.replace(/\/$/, "")}/o/${org.org.slug}/boards/${board.id}`;
    for (const m of added) {
      await sendEmail({
        to: m.user.email,
        replyTo: org.user.email,
        ...boardSharedInternallyEmail({
          senderName: org.user.name || org.user.email,
          boardName: board.name,
          url,
        }),
      });
    }
  }
  if (added.length) {
    await recordAudit({
      orgId: org.org.id,
      userId: org.user.id,
      action: "board.share_internal",
      targetType: "board",
      targetId: board.id,
      meta: { added: added.map((m) => m.user.email) },
    });
  }
  return Response.json({ members: await membersOf(board.id), added: added.length });
});

const removeSchema = z.object({ userId: z.string() });

export const DELETE = route(async (req: Request, ctx: Ctx) => {
  const { slug, boardId } = await ctx.params;
  const org = await requireOrgApi(req, slug, "board:edit");
  const board = await getBoard(toViewer(org), boardId);
  const { userId } = await parseJson(req, removeSchema);
  await prisma.boardMember.deleteMany({ where: { boardId: board.id, userId } });
  return Response.json({ members: await membersOf(board.id) });
});
