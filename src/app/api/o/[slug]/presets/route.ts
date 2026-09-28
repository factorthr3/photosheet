import { parseJson, requireOrgApi, route } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { listPresets } from "@/lib/presets";
import { presetSchema } from "@/lib/presets-schema";

export const GET = route(async (req: Request, ctx: RouteContext<"/api/o/[slug]/presets">) => {
  const { slug } = await ctx.params;
  const org = await requireOrgApi(req, slug, "image:resize");
  return Response.json({ presets: await listPresets(org.org.id) });
});

export const POST = route(async (req: Request, ctx: RouteContext<"/api/o/[slug]/presets">) => {
  const { slug } = await ctx.params;
  const org = await requireOrgApi(req, slug, "preset:manage");
  const data = await parseJson(req, presetSchema);
  const { _max } = await prisma.resizePreset.aggregate({
    where: { orgId: org.org.id },
    _max: { position: true },
  });
  const preset = await prisma.resizePreset.create({
    data: { ...data, orgId: org.org.id, position: (_max.position ?? -1) + 1 },
  });
  await recordAudit({
    orgId: org.org.id,
    userId: org.user.id,
    action: "preset.create",
    targetType: "preset",
    targetId: preset.id,
    meta: { name: preset.name },
  });
  return Response.json({ preset }, { status: 201 });
});
