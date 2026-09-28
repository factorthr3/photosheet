import "server-only";
import { HttpError } from "@/lib/api";
import { prisma } from "@/lib/db";

/** Load a rendition only if its image belongs to the org and isn't trashed. */
export async function findOrgRendition(orgId: string, renditionId: string) {
  const r = await prisma.rendition.findFirst({
    where: { id: renditionId, image: { orgId, deletedAt: null } },
    include: { image: { select: { id: true, filename: true } } },
  });
  if (!r) throw new HttpError(404, "Rendition not found", "not_found");
  return r;
}
