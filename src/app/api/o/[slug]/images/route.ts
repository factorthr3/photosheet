import { z } from "zod";
import { requireOrgApi, route } from "@/lib/api";
import { listImages } from "@/lib/images/list";
import { parseFilters } from "@/lib/images/query";

const pageSchema = z.object({
  cursor: z.string().max(1000).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(60),
});

/** Library grid page: filters + keyset pagination. `total` is only computed for the first page. */
export const GET = route(async (req: Request, ctx: RouteContext<"/api/o/[slug]/images">) => {
  const { slug } = await ctx.params;
  const org = await requireOrgApi(req, slug, "image:view");
  const params = new URL(req.url).searchParams;
  const { cursor, limit } = pageSchema.parse({
    cursor: params.get("cursor") ?? undefined,
    limit: params.get("limit") ?? undefined,
  });
  return Response.json(await listImages(org.org.id, parseFilters(params), { cursor, limit }));
});
