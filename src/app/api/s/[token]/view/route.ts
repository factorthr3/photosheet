import { route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { requirePublicShare } from "@/lib/public-share";

/** Count a page view (the page sends this once per browser session). */
export const POST = route(async (req: Request, ctx: RouteContext<"/api/s/[token]/view">) => {
  const { token } = await ctx.params;
  const link = await requirePublicShare(req, token, {
    bucket: "view",
    limit: 30,
    windowSeconds: 60,
  });
  await prisma.shareLink.update({
    where: { id: link.id },
    data: { views: { increment: 1 }, lastViewedAt: new Date() },
  });
  return new Response(null, { status: 204 });
});
