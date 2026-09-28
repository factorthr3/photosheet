import type { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { HttpError, parseJson, requireOrgApi, route } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { getBoard, toViewer } from "@/lib/boards";
import { prisma } from "@/lib/db";
import {
  EXPORT_TTL_MS,
  exportFilename,
  exportSourceSchema,
  resolveExportImages,
  resolveVariant,
  toExportDto,
  type ZipExportParams,
} from "@/lib/exports";
import { enqueueExport } from "@/lib/queue";

const bodySchema = z.object({
  kind: z.literal("zip"),
  source: exportSourceSchema,
  variant: z.discriminatedUnion("type", [
    z.object({ type: z.literal("original") }),
    z.object({ type: z.literal("preset"), presetId: z.string() }),
  ]),
});

/** Queue a ZIP of selected images or a whole board; poll GET /exports/[id] for progress. */
export const POST = route(async (req: Request, ctx: RouteContext<"/api/o/[slug]/exports">) => {
  const { slug } = await ctx.params;
  const org = await requireOrgApi(req, slug, "image:download");
  const body = await parseJson(req, bodySchema);

  let label = "photosheet";
  if (body.source.type === "board") {
    label = (await getBoard(toViewer(org), body.source.boardId)).name;
  }
  const images = await resolveExportImages(org.org.id, body.source);
  if (images.length === 0)
    throw new HttpError(400, "There are no downloadable images in this selection", "empty");

  const variant = await resolveVariant(org.org.id, body.variant);
  if (!variant) throw new HttpError(404, "Preset not found", "not_found");

  const params: ZipExportParams = { source: body.source, ...variant };
  const exp = await prisma.export.create({
    data: {
      orgId: org.org.id,
      createdById: org.user.id,
      kind: "zip",
      params: params as unknown as Prisma.InputJsonValue,
      filename: `${exportFilename(label)}.zip`,
      itemCount: images.length,
      expiresAt: new Date(Date.now() + EXPORT_TTL_MS),
    },
  });
  await enqueueExport(exp.id);
  await recordAudit({
    orgId: org.org.id,
    userId: org.user.id,
    action: "export.zip",
    targetType: body.source.type === "board" ? "board" : "export",
    targetId: body.source.type === "board" ? body.source.boardId : exp.id,
    meta: { exportId: exp.id, images: images.length, variant: variant.variantName },
  });
  return Response.json({ export: toExportDto(exp) }, { status: 201 });
});
