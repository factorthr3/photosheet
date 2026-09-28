import type { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { HttpError, parseJson, route } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import {
  EXPORT_TTL_MS,
  exportFilename,
  resolveExportImages,
  toExportDto,
  type ZipExportParams,
} from "@/lib/exports";
import { requirePublicShare, shareVariants } from "@/lib/public-share";
import { enqueueExport } from "@/lib/queue";

const bodySchema = z.object({ variant: z.string().min(1) });

/** "Download all" for a shared board: queue a ZIP in one of the allowed sizes. */
export const POST = route(async (req: Request, ctx: RouteContext<"/api/s/[token]/zip">) => {
  const { token } = await ctx.params;
  const link = await requirePublicShare(req, token, {
    bucket: "zip",
    limit: 5,
    windowSeconds: 600,
  });
  if (link.targetType !== "board" || !link.boardId)
    throw new HttpError(400, "Only boards can be zipped", "invalid");
  const { variant } = await parseJson(req, bodySchema);
  const allowed = (await shareVariants(link)).find((v) => v.id === variant);
  if (!allowed)
    throw new HttpError(403, "Downloads in this size aren't allowed for this link", "forbidden");

  const source = { type: "board" as const, boardId: link.boardId };
  const images = await resolveExportImages(link.orgId, source);
  if (images.length === 0) throw new HttpError(400, "This board is empty", "empty");

  const params: ZipExportParams = { source, render: allowed.params, variantName: allowed.label };
  const exp = await prisma.export.create({
    data: {
      orgId: link.orgId,
      shareLinkId: link.id,
      kind: "zip",
      params: params as unknown as Prisma.InputJsonValue,
      filename: `${exportFilename(link.title || link.board?.name || "photos")}.zip`,
      itemCount: images.length,
      expiresAt: new Date(Date.now() + EXPORT_TTL_MS),
    },
  });
  await enqueueExport(exp.id);
  await prisma.shareLink.update({ where: { id: link.id }, data: { downloads: { increment: 1 } } });
  await recordAudit({
    orgId: link.orgId,
    userId: null,
    action: "export.zip",
    targetType: "share",
    targetId: link.id,
    meta: { via: "share", exportId: exp.id, images: images.length, variant: allowed.label },
  });
  return Response.json({ export: toExportDto(exp) }, { status: 201 });
});
