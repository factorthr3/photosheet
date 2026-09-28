"use client";

import { LayoutGrid, Lock, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import type { BoardSummary } from "@/lib/boards";
import { formatDate } from "@/lib/format";
import { BoardFormDialog } from "./board-form-dialog";

export function BoardsIndex({
  slug,
  boards,
  canEdit,
}: {
  slug: string;
  boards: BoardSummary[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  async function create(values: { name: string; description: string }) {
    const res = await fetch(`/api/o/${slug}/boards`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(values),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? "Couldn't create board");
    router.push(`/o/${slug}/boards/${body.board.id}`);
  }

  return (
    <>
      <PageHeader
        title="Boards"
        description="Collections of images for a campaign, client or project."
        actions={
          canEdit && (
            <Button onClick={() => setCreating(true)}>
              <Plus />
              New board
            </Button>
          )
        }
      />
      {boards.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-12 text-center">
          <div className="rounded-full bg-muted p-4">
            <LayoutGrid className="size-6 text-muted-foreground" aria-hidden="true" />
          </div>
          <div>
            <p className="font-medium">No boards yet</p>
            <p className="text-sm text-muted-foreground">
              Create a board, or select images in the library and choose “Add to board”.
            </p>
          </div>
          {canEdit && <Button onClick={() => setCreating(true)}>New board</Button>}
        </div>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(240px,100%),1fr))] gap-5 p-4 sm:p-6">
          {boards.map((b) => (
            <li key={b.id}>
              <Link
                href={`/o/${slug}/boards/${b.id}`}
                className="group block overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <div className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-muted">
                  {b.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={b.coverUrl}
                      alt=""
                      loading="lazy"
                      className="size-full object-cover transition-transform group-hover:scale-[1.02]"
                    />
                  ) : (
                    <LayoutGrid className="size-8 text-muted-foreground" aria-hidden="true" />
                  )}
                </div>
                <div className="p-3">
                  <p className="flex items-center gap-1.5 truncate font-medium">
                    {b.visibility === "PRIVATE" && (
                      <Lock
                        className="size-3.5 shrink-0 text-muted-foreground"
                        aria-label="Private"
                      />
                    )}
                    {b.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {b.imageCount} {b.imageCount === 1 ? "image" : "images"} · Updated{" "}
                    {formatDate(b.updatedAt)}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <BoardFormDialog
        open={creating}
        onOpenChange={setCreating}
        title="New board"
        submitLabel="Create board"
        onSubmit={create}
      />
    </>
  );
}
