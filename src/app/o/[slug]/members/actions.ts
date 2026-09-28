"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { type ActionResult, actionError } from "@/lib/action-result";
import { recordAudit } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/org";
import { ASSIGNABLE_ROLES, canAssignRole, isRole, ROLES } from "@/lib/permissions";

const inviteSchema = z.object({
  email: z.email("Enter a valid email address").trim().toLowerCase(),
  role: z.enum(ASSIGNABLE_ROLES),
});

export async function inviteMember(
  slug: string,
  input: z.input<typeof inviteSchema>,
): Promise<ActionResult<{ invitationId: string }>> {
  try {
    const { email, role } = inviteSchema.parse(input);
    const ctx = await requireOrg(slug, "member:manage");
    if (!canAssignRole(ctx.role, role)) return { ok: false, error: "You can't grant that role" };

    const existing = await prisma.member.findFirst({
      where: {
        organizationId: ctx.org.id,
        user: { email: { equals: email, mode: "insensitive" } },
      },
    });
    if (existing) return { ok: false, error: `${email} is already a member` };

    const invitation = await auth.api.createInvitation({
      headers: await headers(),
      body: { email, role, organizationId: ctx.org.id },
    });

    await recordAudit({
      orgId: ctx.org.id,
      userId: ctx.user.id,
      action: "member.invite",
      targetType: "invitation",
      targetId: invitation.id,
      meta: { email, role },
    });
    revalidatePath(`/o/${slug}/members`);
    return { ok: true, data: { invitationId: invitation.id } };
  } catch (err) {
    return actionError(err);
  }
}

export async function cancelInvitation(slug: string, invitationId: string): Promise<ActionResult> {
  try {
    const ctx = await requireOrg(slug, "member:manage");
    const invitation = await prisma.invitation.findFirst({
      where: { id: invitationId, organizationId: ctx.org.id },
    });
    if (!invitation) return { ok: false, error: "Invitation not found" };

    await auth.api.cancelInvitation({ headers: await headers(), body: { invitationId } });
    await recordAudit({
      orgId: ctx.org.id,
      userId: ctx.user.id,
      action: "member.invite_cancel",
      targetType: "invitation",
      targetId: invitationId,
      meta: { email: invitation.email },
    });
    revalidatePath(`/o/${slug}/members`);
    return { ok: true };
  } catch (err) {
    return actionError(err);
  }
}

async function loadTarget(orgId: string, memberId: string) {
  return prisma.member.findFirst({
    where: { id: memberId, organizationId: orgId },
    include: { user: { select: { email: true } } },
  });
}

export async function updateMemberRole(
  slug: string,
  memberId: string,
  role: string,
): Promise<ActionResult> {
  try {
    const newRole = z.enum(ROLES).parse(role);
    const ctx = await requireOrg(slug, "member:manage");
    const target = await loadTarget(ctx.org.id, memberId);
    if (!target) return { ok: false, error: "Member not found" };
    if (target.userId === ctx.user.id)
      return { ok: false, error: "You can't change your own role" };
    if (!isRole(target.role)) return { ok: false, error: "Unknown role" };
    if (!canAssignRole(ctx.role, newRole) || !canAssignRole(ctx.role, target.role)) {
      return { ok: false, error: "Only owners can change an owner's role or grant ownership" };
    }

    await auth.api.updateMemberRole({
      headers: await headers(),
      body: { memberId, role: newRole, organizationId: ctx.org.id },
    });
    await recordAudit({
      orgId: ctx.org.id,
      userId: ctx.user.id,
      action: "member.role_change",
      targetType: "member",
      targetId: memberId,
      meta: { email: target.user.email, from: target.role, to: newRole },
    });
    revalidatePath(`/o/${slug}/members`);
    return { ok: true };
  } catch (err) {
    return actionError(err);
  }
}

export async function removeMember(slug: string, memberId: string): Promise<ActionResult> {
  try {
    const ctx = await requireOrg(slug, "member:manage");
    const target = await loadTarget(ctx.org.id, memberId);
    if (!target) return { ok: false, error: "Member not found" };
    if (target.userId === ctx.user.id) return { ok: false, error: "You can't remove yourself" };
    if (target.role === "owner" && ctx.role !== "owner") {
      return { ok: false, error: "Only owners can remove an owner" };
    }

    await auth.api.removeMember({
      headers: await headers(),
      body: { memberIdOrEmail: memberId, organizationId: ctx.org.id },
    });
    await recordAudit({
      orgId: ctx.org.id,
      userId: ctx.user.id,
      action: "member.remove",
      targetType: "member",
      targetId: memberId,
      meta: { email: target.user.email, role: target.role },
    });
    revalidatePath(`/o/${slug}/members`);
    return { ok: true };
  } catch (err) {
    return actionError(err);
  }
}
