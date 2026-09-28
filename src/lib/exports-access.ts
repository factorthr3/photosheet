import "server-only";
import { HttpError } from "@/lib/api";
import { prisma } from "@/lib/db";
import type { OrgContext } from "@/lib/org";
import { can } from "@/lib/permissions";

/** Exports are visible to whoever made them, and to admins. */
export async function findOwnExport(org: OrgContext, exportId: string) {
  const exp = await prisma.export.findFirst({ where: { id: exportId, orgId: org.org.id } });
  if (!exp || (exp.createdById !== org.user.id && !can(org.role, "share:manage:any"))) {
    throw new HttpError(404, "Export not found", "not_found");
  }
  return exp;
}
