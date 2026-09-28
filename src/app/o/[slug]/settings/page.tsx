import type { Metadata } from "next";
import { OrgSettingsForm } from "@/components/org/org-settings-form";
import { PageHeader } from "@/components/page-header";
import { PresetsManager } from "@/components/resize/presets-manager";
import { requireOrg } from "@/lib/org";
import { can } from "@/lib/permissions";
import { listPresets } from "@/lib/presets";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage(props: PageProps<"/o/[slug]/settings">) {
  const { slug } = await props.params;
  const ctx = await requireOrg(slug, "preset:manage");
  const presets = await listPresets(ctx.org.id);

  return (
    <>
      <PageHeader title="Settings" description="Organisation details and defaults." />
      <div className="grid max-w-3xl gap-6 p-4 sm:p-6">
        <OrgSettingsForm slug={slug} name={ctx.org.name} canEdit={can(ctx.role, "org:settings")} />
        <PresetsManager slug={slug} initial={presets} />
      </div>
    </>
  );
}
