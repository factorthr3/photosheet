import { z } from "zod";
import { requireOrgApi, route } from "@/lib/api";
import { listTrash } from "@/lib/trash-list";

/** Trashed images, most recently deleted first. */
export const GET = route(async (req: Request, ctx: RouteContext<"/api/o/[slug]/trash">) => {
  const { slug } = await ctx.params;
  const org = await requireOrgApi(req, slug, "image:delete:own");
  const cursor = z
    .string()
    .max(200)
    .optional()
    .parse(new URL(req.url).searchParams.get("cursor") ?? undefined);
  return Response.json(await listTrash(org.org.id, cursor));
});
