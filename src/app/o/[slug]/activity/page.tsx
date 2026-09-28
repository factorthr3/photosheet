import type { Metadata } from "next";
import { ActivityFeed } from "@/components/activity/activity-feed";
import { PageHeader } from "@/components/page-header";
import { listActivity } from "@/lib/activity";
import { orgPeople } from "@/lib/images/list";
import { requireOrg } from "@/lib/org";

export const metadata: Metadata = { title: "Activity" };

export default async function ActivityPage(props: PageProps<"/o/[slug]/activity">) {
  const { slug } = await props.params;
  const ctx = await requireOrg(slug, "audit:view");
  const [initial, people] = await Promise.all([listActivity(ctx.org.id), orgPeople(ctx.org.id)]);
  return (
    <>
      <PageHeader
        title="Activity"
        description="Uploads, edits, deletes, shares and downloads across the organisation."
      />
      <ActivityFeed slug={slug} initial={initial} people={people} />
    </>
  );
}
