import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { TrashView } from "@/components/trash/trash-view";
import { requireOrg } from "@/lib/org";
import { can } from "@/lib/permissions";
import { TRASH_RETENTION_DAYS } from "@/lib/trash";
import { listTrash } from "@/lib/trash-list";

export const metadata: Metadata = { title: "Trash" };

export default async function TrashPage(props: PageProps<"/o/[slug]/trash">) {
  const { slug } = await props.params;
  const ctx = await requireOrg(slug, "image:delete:own");
  const initial = await listTrash(ctx.org.id);
  return (
    <>
      <PageHeader
        title="Trash"
        description={`Deleted images are kept for ${TRASH_RETENTION_DAYS} days, then removed permanently.`}
      />
      <TrashView slug={slug} initial={initial} canPurge={can(ctx.role, "image:delete:any")} />
    </>
  );
}
