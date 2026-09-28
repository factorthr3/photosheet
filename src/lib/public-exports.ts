import "server-only";
import { HttpError } from "@/lib/api";
import { prisma } from "@/lib/db";
import type { LoadedShare } from "@/lib/shares";

/** An export requested through this share link (and no other). */
export async function findShareExport(link: LoadedShare, exportId: string) {
  const exp = await prisma.export.findFirst({ where: { id: exportId, shareLinkId: link.id } });
  if (!exp) throw new HttpError(404, "Download not found", "not_found");
  return exp;
}
