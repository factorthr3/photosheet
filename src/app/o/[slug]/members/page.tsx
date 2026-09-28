import type { Metadata } from "next";
import { MembersView } from "@/components/org/members-view";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/org";
import { can } from "@/lib/permissions";

export const metadata: Metadata = { title: "Members" };

export default async function MembersPage(props: PageProps<"/o/[slug]/members">) {
  const { slug } = await props.params;
  const ctx = await requireOrg(slug, "member:view");
  const canManage = can(ctx.role, "member:manage");

  const [members, invitations] = await Promise.all([
    prisma.member.findMany({
      where: { organizationId: ctx.org.id },
      include: { user: { select: { id: true, name: true, email: true, image: true } } },
      orderBy: { createdAt: "asc" },
    }),
    canManage
      ? prisma.invitation.findMany({
          where: { organizationId: ctx.org.id, status: "pending", expiresAt: { gt: new Date() } },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader title="Members" description={`People with access to ${ctx.org.name}.`} />
      <MembersView
        slug={slug}
        viewer={{ userId: ctx.user.id, role: ctx.role }}
        members={members.map((m) => ({
          id: m.id,
          role: m.role,
          joinedAt: m.createdAt.toISOString(),
          user: m.user,
        }))}
        invitations={invitations.map((i) => ({
          id: i.id,
          email: i.email,
          role: i.role ?? "viewer",
          expiresAt: i.expiresAt.toISOString(),
        }))}
      />
    </>
  );
}
