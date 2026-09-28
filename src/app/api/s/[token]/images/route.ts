import { z } from "zod";
import { route } from "@/lib/api";
import { listShareImages, requirePublicShare } from "@/lib/public-share";

export const GET = route(async (req: Request, ctx: RouteContext<"/api/s/[token]/images">) => {
  const { token } = await ctx.params;
  const link = await requirePublicShare(req, token);
  const cursor = z.coerce
    .number()
    .int()
    .min(0)
    .optional()
    .parse(new URL(req.url).searchParams.get("cursor") ?? undefined);
  return Response.json(await listShareImages(link, cursor ?? null));
});
