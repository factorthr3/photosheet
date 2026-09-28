import "server-only";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { type Capability, can, isRole, type Role } from "@/lib/permissions";
import { getSession } from "@/lib/session";

export interface OrgContext {
  user: { id: string; name: string; email: string; image?: string | null };
  org: { id: string; name: string; slug: string; logo: string | null };
  role: Role;
  memberId: string;
}

/**
 * Resolve the signed-in user's membership of the organisation with `slug`.
 * Returns null when not signed in or not a member — callers must treat both the same
 * (never reveal that an org exists to non-members).
 */
export async function loadOrgContext(userId: string, slug: string) {
  const member = await prisma.member.findFirst({
    where: { userId, organization: { slug } },
    include: { organization: true },
  });
  if (!member || !isRole(member.role)) return null;
  return {
    org: {
      id: member.organization.id,
      name: member.organization.name,
      slug: member.organization.slug,
      logo: member.organization.logo,
    },
    role: member.role,
    memberId: member.id,
  };
}

/** For server components/actions under /o/[slug]. Redirects or 404s on failure. */
export const requireOrg = cache(async (slug: string, capability?: Capability) => {
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(`/o/${slug}`)}`);
  const ctx = await loadOrgContext(session.user.id, slug);
  if (!ctx) notFound();
  if (capability && !can(ctx.role, capability)) notFound();
  return { ...ctx, user: session.user } satisfies OrgContext;
});

/** All organisations the user belongs to, for the switcher. */
export async function listUserOrgs(userId: string) {
  const members = await prisma.member.findMany({
    where: { userId },
    include: { organization: { select: { id: true, name: true, slug: true, logo: true } } },
    orderBy: { organization: { name: "asc" } },
  });
  return members.map((m) => ({ ...m.organization, role: m.role }));
}
