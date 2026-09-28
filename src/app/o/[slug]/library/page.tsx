import type { Metadata } from "next";
import { LibraryView } from "@/components/library/library-view";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { feedQuery, parseFilters } from "@/lib/images/filters";
import { listImages, orgPeople, topTags } from "@/lib/images/list";
import { requireOrg } from "@/lib/org";
import { can } from "@/lib/permissions";

export const metadata: Metadata = { title: "Library" };

export default async function LibraryPage(props: PageProps<"/o/[slug]/library">) {
  const { slug } = await props.params;
  const ctx = await requireOrg(slug, "image:view");
  const sp = await props.searchParams;
  const raw = Object.fromEntries(
    Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
  );
  let filters;
  try {
    filters = parseFilters(raw);
  } catch {
    filters = parseFilters({});
  }

  const [page, tags, people, boards] = await Promise.all([
    listImages(ctx.org.id, filters),
    topTags(ctx.org.id),
    orgPeople(ctx.org.id),
    prisma.board.findMany({
      where: { orgId: ctx.org.id },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <LibraryView
      slug={slug}
      orgName={ctx.org.name}
      maxUploadMb={env().MAX_UPLOAD_MB}
      capabilities={{
        canUpload: can(ctx.role, "image:upload"),
        canDownload: can(ctx.role, "image:download"),
        canEdit: can(ctx.role, "image:edit"),
        canDelete: can(ctx.role, "image:delete:own"),
        canShare: can(ctx.role, "share:create"),
        canEditBoards: can(ctx.role, "board:edit"),
      }}
      facets={{ tags, people, boards }}
      initial={{ query: feedQuery(filters, "uploaded_desc"), page }}
    />
  );
}
