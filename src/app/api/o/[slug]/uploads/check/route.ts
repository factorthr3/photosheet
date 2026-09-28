import { z } from "zod";
import { parseJson, requireOrgApi, route } from "@/lib/api";
import { prisma } from "@/lib/db";

const schema = z.object({
  hashes: z
    .array(z.string().regex(/^[0-9a-f]{64}$/))
    .min(1)
    .max(500),
});

/** Which of these content hashes already exist in the library (to warn before uploading). */
export const POST = route(
  async (req: Request, ctx: RouteContext<"/api/o/[slug]/uploads/check">) => {
    const { slug } = await ctx.params;
    const org = await requireOrgApi(req, slug, "image:upload");
    const { hashes } = await parseJson(req, schema);

    const matches = await prisma.image.findMany({
      where: {
        orgId: org.org.id,
        sha256: { in: hashes },
        deletedAt: null,
        status: { in: ["READY", "PROCESSING"] },
      },
      select: { id: true, sha256: true, filename: true, title: true },
      orderBy: { createdAt: "asc" },
    });

    const duplicates: Record<string, { imageId: string; filename: string }> = {};
    for (const m of matches) {
      if (m.sha256 && !duplicates[m.sha256]) {
        duplicates[m.sha256] = { imageId: m.id, filename: m.title || m.filename };
      }
    }
    return Response.json({ duplicates });
  },
);
