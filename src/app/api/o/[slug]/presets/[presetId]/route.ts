import { HttpError, parseJson, requireOrgApi, route } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { getPreset } from "@/lib/presets";
import { presetSchema } from "@/lib/presets-schema";

type Ctx = RouteContext<"/api/o/[slug]/presets/[presetId]">;

export const PATCH = route(async (req: Request, ctx: Ctx) => {
  const { slug, presetId } = await ctx.params;
  const org = await requireOrgApi(req, slug, "preset:manage");
  if (!(await getPreset(org.org.id, presetId)))
    throw new HttpError(404, "Preset not found", "not_found");
  const data = await parseJson(req, presetSchema);
  const preset = await prisma.resizePreset.update({ where: { id: presetId }, data });
  await recordAudit({
    orgId: org.org.id,
    userId: org.user.id,
    action: "preset.update",
    targetType: "preset",
    targetId: presetId,
    meta: { name: preset.name },
  });
  return Response.json({ preset });
});

export const DELETE = route(async (req: Request, ctx: Ctx) => {
  const { slug, presetId } = await ctx.params;
  const org = await requireOrgApi(req, slug, "preset:manage");
  const preset = await getPreset(org.org.id, presetId);
  if (!preset) throw new HttpError(404, "Preset not found", "not_found");
  await prisma.resizePreset.delete({ where: { id: presetId } });
  await recordAudit({
    orgId: org.org.id,
    userId: org.user.id,
    action: "preset.delete",
    targetType: "preset",
    targetId: presetId,
    meta: { name: preset.name },
  });
  return new Response(null, { status: 204 });
});
