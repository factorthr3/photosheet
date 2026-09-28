import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { SharesList } from "@/components/share/shares-list";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/org";
import { can } from "@/lib/permissions";
import { shareInclude, toShareDto } from "@/lib/shares-dto";

export const metadata: Metadata = { title: "Shared links" };

export default async function SharesPage(props: PageProps<"/o/[slug]/shares">) {
  const { slug } = await props.params;
  const ctx = await requireOrg(slug, "share:create");
  const all = can(ctx.role, "share:manage:any");
  const links = await prisma.shareLink.findMany({
    where: { orgId: ctx.org.id, ...(all ? {} : { createdById: ctx.user.id }) },
    include: shareInclude,
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return (
    <>
      <PageHeader
        title="Shared links"
        description={
          all ? "Every public link in this organisation." : "Public links you've created."
        }
      />
      <SharesList slug={slug} initial={links.map(toShareDto)} />
    </>
  );
}
