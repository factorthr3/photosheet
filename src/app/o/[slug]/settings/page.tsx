import type { Metadata } from "next";
import { OrgSettingsForm } from "@/components/org/org-settings-form";
import { PageHeader } from "@/components/page-header";
import { requireOrg } from "@/lib/org";
import { can } from "@/lib/permissions";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage(props: PageProps<"/o/[slug]/settings">) {
  const { slug } = await props.params;
  const ctx = await requireOrg(slug, "preset:manage");

  return (
    <>
      <PageHeader title="Settings" description="Organisation details and defaults." />
      <div className="grid max-w-3xl gap-6 p-4 sm:p-6">
        <OrgSettingsForm slug={slug} name={ctx.org.name} canEdit={can(ctx.role, "org:settings")} />
      </div>
    </>
  );
}
