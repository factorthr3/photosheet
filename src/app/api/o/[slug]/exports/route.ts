import type { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { HttpError, parseJson, requireOrgApi, route } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { getBoard, toViewer } from "@/lib/boards";
import { prisma } from "@/lib/db";
import {
  EXPORT_TTL_MS,
  exportFilename,
  MAX_PDF_IMAGES,
  type PdfExportParams,
  exportSourceSchema,
  resolveExportImages,
  resolveVariant,
  toExportDto,
  type ZipExportParams,
} from "@/lib/exports";
import { pdfOptionsSchema } from "@/lib/pdf/layout";
import { enqueueExport } from "@/lib/queue";

const bodySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("zip"),
    source: exportSourceSchema,
    variant: z.discriminatedUnion("type", [
      z.object({ type: z.literal("original") }),
      z.object({ type: z.literal("preset"), presetId: z.string() }),
    ]),
  }),
  z.object({
    kind: z.literal("pdf"),
    source: exportSourceSchema,
    options: pdfOptionsSchema,
    title: z.string().trim().max(120).optional(),
  }),
]);

/**
 * Queue a ZIP of images (originals or one preset) or a contact-sheet PDF, for a selection or a
 * whole board. Poll GET /exports/[id] for progress.
 */
export const POST = route(async (req: Request, ctx: RouteContext<"/api/o/[slug]/exports">) => {
  const { slug } = await ctx.params;
  const org = await requireOrgApi(req, slug, "image:download");
  const body = await parseJson(req, bodySchema);

  let label = "photosheet";
  if (body.kind === "pdf" && body.source.type === "images") label = "selection";
  if (body.source.type === "board") {
    label = (await getBoard(toViewer(org), body.source.boardId)).name;
  }
  const images = await resolveExportImages(org.org.id, body.source);
  if (images.length === 0)
    throw new HttpError(400, "There are no downloadable images in this selection", "empty");

  let params: ZipExportParams | PdfExportParams;
  let meta: Record<string, string | number>;
  if (body.kind === "zip") {
    const variant = await resolveVariant(org.org.id, body.variant);
    if (!variant) throw new HttpError(404, "Preset not found", "not_found");
    params = { source: body.source, ...variant };
    meta = { variant: variant.variantName };
  } else {
    const title = body.title || (body.source.type === "board" ? label : "Contact sheet");
    params = { source: body.source, options: body.options, title, orgName: org.org.name };
    meta = { paper: body.options.paper, columns: body.options.columns };
  }

  const exp = await prisma.export.create({
    data: {
      orgId: org.org.id,
      createdById: org.user.id,
      kind: body.kind,
      params: params as unknown as Prisma.InputJsonValue,
      filename: `${exportFilename(body.kind === "pdf" ? `${body.title || label} contact sheet` : label)}.${body.kind}`,
      itemCount: Math.min(images.length, body.kind === "pdf" ? MAX_PDF_IMAGES : images.length),
      expiresAt: new Date(Date.now() + EXPORT_TTL_MS),
    },
  });
  await enqueueExport(exp.id);
  await recordAudit({
    orgId: org.org.id,
    userId: org.user.id,
    action: body.kind === "zip" ? "export.zip" : "export.pdf",
    targetType: body.source.type === "board" ? "board" : "export",
    targetId: body.source.type === "board" ? body.source.boardId : exp.id,
    meta: { exportId: exp.id, images: images.length, ...meta },
  });
  return Response.json({ export: toExportDto(exp) }, { status: 201 });
});
