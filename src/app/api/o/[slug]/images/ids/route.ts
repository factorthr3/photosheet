import { requireOrgApi, route } from "@/lib/api";
import { getBoard, toViewer } from "@/lib/boards";
import { prisma } from "@/lib/db";
import { buildOrderBy, buildWhere, parseFilters } from "@/lib/images/query";

export const MAX_SELECTION = 10_000;

/** IDs of every image matching the filters (for "select all N"). Capped at 10,000. */
export const GET = route(async (req: Request, ctx: RouteContext<"/api/o/[slug]/images/ids">) => {
  const { slug } = await ctx.params;
  const org = await requireOrgApi(req, slug, "image:view");
  const filters = parseFilters(new URL(req.url).searchParams);
  if (filters.board) await getBoard(toViewer(org), filters.board);
  const rows = await prisma.image.findMany({
    where: buildWhere(org.org.id, filters),
    orderBy: buildOrderBy(filters.sort === "manual" ? "uploaded_desc" : filters.sort),
    select: { id: true },
    take: MAX_SELECTION,
  });
  return Response.json({ ids: rows.map((r) => r.id), capped: rows.length === MAX_SELECTION });
});
