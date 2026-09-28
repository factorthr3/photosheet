import { requireOrgApi, route } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { listPresets, resetPresets } from "@/lib/presets";

/** Replace the org's presets with the built-in defaults. */
export const POST = route(
  async (req: Request, ctx: RouteContext<"/api/o/[slug]/presets/reset">) => {
    const { slug } = await ctx.params;
    const org = await requireOrgApi(req, slug, "preset:manage");
    await resetPresets(org.org.id);
    await recordAudit({
      orgId: org.org.id,
      userId: org.user.id,
      action: "preset.update",
      targetType: "preset",
      meta: { reset: true },
    });
    return Response.json({ presets: await listPresets(org.org.id) });
  },
);
