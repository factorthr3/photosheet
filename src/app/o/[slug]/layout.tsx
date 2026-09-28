import { AppShell } from "@/components/shell/app-shell";
import { listUserOrgs, requireOrg } from "@/lib/org";

/** Nav sections that exist so far; extended as features land. */
const ENABLED_SEGMENTS = ["library", "members", "settings"];

export default async function OrgLayout(props: LayoutProps<"/o/[slug]">) {
  const { slug } = await props.params;
  const ctx = await requireOrg(slug);
  const orgs = await listUserOrgs(ctx.user.id);

  return (
    <AppShell
      org={ctx.org}
      role={ctx.role}
      user={{ name: ctx.user.name, email: ctx.user.email, image: ctx.user.image }}
      orgs={orgs}
      enabledSegments={ENABLED_SEGMENTS}
    >
      {props.children}
    </AppShell>
  );
}
