import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BoardView } from "@/components/boards/board-view";
import { HttpError } from "@/lib/api";
import { getBoard, listBoardImages } from "@/lib/boards";
import { feedQuery, parseFilters } from "@/lib/images/filters";
import { orgPeople, topTags } from "@/lib/images/list";
import { requireOrg } from "@/lib/org";
import { can } from "@/lib/permissions";

export async function generateMetadata(
  props: PageProps<"/o/[slug]/boards/[boardId]">,
): Promise<Metadata> {
  const { slug, boardId } = await props.params;
  const ctx = await requireOrg(slug, "board:view");
  const board = await getBoard(ctx.org.id, boardId).catch(() => null);
  return { title: board?.name ?? "Board" };
}

export default async function BoardPage(props: PageProps<"/o/[slug]/boards/[boardId]">) {
  const { slug, boardId } = await props.params;
  const ctx = await requireOrg(slug, "board:view");
  let board;
  try {
    board = await getBoard(ctx.org.id, boardId);
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) notFound();
    throw err;
  }

  const sp = await props.searchParams;
  const raw = Object.fromEntries(
    Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
  );
  let filters;
  try {
    filters = parseFilters(raw, { defaultSort: "manual" });
  } catch {
    filters = parseFilters({}, { defaultSort: "manual" });
  }

  const [page, tags, people] = await Promise.all([
    listBoardImages(ctx.org.id, board.id, filters),
    topTags(ctx.org.id),
    orgPeople(ctx.org.id),
  ]);

  return (
    <BoardView
      slug={slug}
      orgName={ctx.org.name}
      board={{
        id: board.id,
        name: board.name,
        description: board.description,
        coverImageId: board.coverImageId,
        createdBy: board.createdBy?.name || board.createdBy?.email || null,
        canDelete:
          can(ctx.role, "board:edit") &&
          (board.createdById === ctx.user.id || can(ctx.role, "board:delete:any")),
      }}
      capabilities={{
        canUpload: false,
        canDownload: can(ctx.role, "image:download"),
        canEdit: can(ctx.role, "image:edit"),
        canDelete: can(ctx.role, "image:delete:own"),
        canShare: can(ctx.role, "share:create"),
        canEditBoards: can(ctx.role, "board:edit"),
      }}
      facets={{ tags, people }}
      initial={{ query: feedQuery(filters, "manual"), page }}
    />
  );
}
