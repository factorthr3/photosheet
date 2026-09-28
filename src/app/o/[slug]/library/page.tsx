import type { Metadata } from "next";
import { type LibraryImage, LibraryClient } from "@/components/library/library-client";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { requireOrg } from "@/lib/org";
import { can } from "@/lib/permissions";
import { presignThumb } from "@/lib/storage";

export const metadata: Metadata = { title: "Library" };

export default async function LibraryPage(props: PageProps<"/o/[slug]/library">) {
  const { slug } = await props.params;
  const ctx = await requireOrg(slug, "image:view");

  const rows = await prisma.image.findMany({
    where: { orgId: ctx.org.id, deletedAt: null, status: { not: "UPLOADING" } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 200,
    select: { id: true, filename: true, title: true, status: true, thumbKey: true },
  });
  const images: LibraryImage[] = await Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      filename: r.filename,
      title: r.title,
      status: r.status,
      thumbUrl: r.thumbKey ? await presignThumb(r.thumbKey) : null,
    })),
  );

  return (
    <LibraryClient
      slug={slug}
      orgName={ctx.org.name}
      maxUploadMb={env().MAX_UPLOAD_MB}
      canUpload={can(ctx.role, "image:upload")}
      images={images}
    />
  );
}
