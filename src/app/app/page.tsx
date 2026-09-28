import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";

/** Post-login landing: go to the last active organisation, the first one, or onboarding. */
export default async function AppEntry() {
  const session = await requireSession("/app");
  const members = await prisma.member.findMany({
    where: { userId: session.user.id },
    include: { organization: { select: { id: true, slug: true } } },
    orderBy: { createdAt: "asc" },
  });

  const active =
    members.find((m) => m.organizationId === session.session.activeOrganizationId) ?? members[0];
  if (active) redirect(`/o/${active.organization.slug}`);
  redirect("/onboarding");
}
