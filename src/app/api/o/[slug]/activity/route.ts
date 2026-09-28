import { requireOrgApi, route } from "@/lib/api";
import { listActivity } from "@/lib/activity";

export const GET = route(async (req: Request, ctx: RouteContext<"/api/o/[slug]/activity">) => {
  const { slug } = await ctx.params;
  const org = await requireOrgApi(req, slug, "audit:view");
  const p = new URL(req.url).searchParams;
  return Response.json(
    await listActivity(org.org.id, {
      cursor: p.get("cursor") ?? undefined,
      group: p.get("group") ?? undefined,
      userId: p.get("user") ?? undefined,
    }),
  );
});
