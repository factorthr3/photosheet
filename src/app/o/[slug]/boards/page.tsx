import type { Metadata } from "next";
import { BoardsIndex } from "@/components/boards/boards-index";
import { listBoards, toViewer } from "@/lib/boards";
import { requireOrg } from "@/lib/org";
import { can } from "@/lib/permissions";

export const metadata: Metadata = { title: "Boards" };

export default async function BoardsPage(props: PageProps<"/o/[slug]/boards">) {
  const { slug } = await props.params;
  const ctx = await requireOrg(slug, "board:view");
  const boards = await listBoards(toViewer(ctx));
  return <BoardsIndex slug={slug} boards={boards} canEdit={can(ctx.role, "board:edit")} />;
}
