import { z } from "zod";
import { HttpError, route } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { renditionFilename } from "@/lib/image/render-params";
import { requirePublicShare, shareVariants } from "@/lib/public-share";
import { getOrCreateRendition } from "@/lib/renditions";
import { shareIncludesImage } from "@/lib/shares";
import { presignGet } from "@/lib/storage";

const query = z.object({ image: z.string().min(1), variant: z.string().min(1) });

/** Wait for a rendition the worker is making (renders take ~1s; give up after 25s). */
async function waitForRendition(id: string) {
  const deadline = Date.now() + 25_000;
  while (Date.now() < deadline) {
    const r = await prisma.rendition.findUnique({ where: { id } });
    if (!r || r.status === "FAILED") return null;
    if (r.status === "READY") return r;
    await new Promise((res) => setTimeout(res, 400));
  }
  return null;
}

/** Recipient download of one image in an allowed size. Redirects to a 5-minute signed URL. */
export const GET = route(async (req: Request, ctx: RouteContext<"/api/s/[token]/download">) => {
  const { token } = await ctx.params;
  const link = await requirePublicShare(req, token, {
    bucket: "download",
    limit: 60,
    windowSeconds: 60,
  });
  const { image: imageId, variant } = query.parse(
    Object.fromEntries(new URL(req.url).searchParams),
  );

  const allowed = (await shareVariants(link)).find((v) => v.id === variant);
  if (!allowed)
    throw new HttpError(403, "Downloads in this size aren't allowed for this link", "forbidden");
  if (!(await shareIncludesImage(link, imageId)))
    throw new HttpError(404, "Image not found", "not_found");
  const image = await prisma.image.findUniqueOrThrow({ where: { id: imageId } });

  let url: string;
  if (!allowed.params) {
    url = await presignGet(image.storageKey, { expiresIn: 300, downloadAs: image.filename });
  } else {
    const pending = await getOrCreateRendition(image.id, allowed.params);
    const r = pending.status === "READY" ? pending : await waitForRendition(pending.id);
    if (!r?.storageKey || !r.width || !r.height) {
      throw new HttpError(
        503,
        "This size is still being prepared — try again in a moment",
        "not_ready",
      );
    }
    url = await presignGet(r.storageKey, {
      expiresIn: 300,
      downloadAs: renditionFilename(
        image.filename,
        { width: r.width, height: r.height },
        allowed.params.format,
      ),
    });
  }

  await prisma.shareLink.update({ where: { id: link.id }, data: { downloads: { increment: 1 } } });
  await recordAudit({
    orgId: link.orgId,
    userId: null,
    action: "image.download",
    targetType: "image",
    targetId: image.id,
    meta: { via: "share", shareId: link.id, variant: allowed.label },
  });
  return Response.redirect(url, 302);
});
