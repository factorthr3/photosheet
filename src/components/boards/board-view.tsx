"use client";

import {
  ArrowDownToLine,
  ArrowUpToLine,
  ImagePlus,
  LayoutGrid,
  MoreHorizontal,
  Pencil,
  Star,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ImagePage } from "@/lib/images/list";
import { type Capabilities, type Feed, ImageBrowser } from "@/components/library/image-browser";
import type { FilterFacets } from "@/components/library/library-toolbar";
import { BoardFormDialog } from "./board-form-dialog";

export interface BoardInfo {
  id: string;
  name: string;
  description: string | null;
  coverImageId: string | null;
  createdBy: string | null;
  canDelete: boolean;
}

async function api(url: string, init: RequestInit) {
  const res = await fetch(url, { ...init, headers: { "content-type": "application/json" } });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Request failed");
  return res.status === 204 ? null : res.json();
}

export function BoardView({
  slug,
  orgName,
  board: initialBoard,
  capabilities,
  facets,
  initial,
}: {
  slug: string;
  orgName: string;
  board: BoardInfo;
  capabilities: Capabilities;
  facets: FilterFacets;
  initial: { query: string; page: ImagePage };
}) {
  const router = useRouter();
  const [board, setBoard] = useState(initialBoard);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const base = `/api/o/${slug}/boards/${board.id}`;
  const canEdit = capabilities.canEditBoards;

  async function update(patch: Partial<Pick<BoardInfo, "name" | "description" | "coverImageId">>) {
    const { board: updated } = await api(base, { method: "PATCH", body: JSON.stringify(patch) });
    setBoard((b) => ({ ...b, ...updated }));
  }

  async function setCover(imageId: string) {
    try {
      await update({ coverImageId: imageId });
      toast.success("Cover image updated");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function remove(ids: string[], feed: Feed, clear?: () => void) {
    try {
      const { removed } = await api(`${base}/images/remove`, {
        method: "POST",
        body: JSON.stringify({ imageIds: ids }),
      });
      feed.removeImages(ids);
      clear?.();
      if (board.coverImageId && ids.includes(board.coverImageId))
        setBoard((b) => ({ ...b, coverImageId: null }));
      toast.success(`Removed ${removed} ${removed === 1 ? "image" : "images"} from the board`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function moveTo(ids: string[], where: "start" | "end", feed: Feed) {
    const target =
      where === "start" && feed.images[0]
        ? { beforeId: feed.images.find((i) => !ids.includes(i.id))?.id }
        : {};
    try {
      await api(`${base}/reorder`, {
        method: "POST",
        body: JSON.stringify({ imageIds: ids, ...target }),
      });
      void feed.reload();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function destroy() {
    try {
      await api(base, { method: "DELETE" });
      toast.success(`Deleted “${board.name}”`);
      router.push(`/o/${slug}/boards`);
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <>
      <ImageBrowser
        slug={slug}
        orgName={orgName}
        title={board.name}
        description={() => null}
        header={({ total }) => (
          <div className="flex flex-wrap items-start justify-between gap-4 border-b px-4 py-5 sm:px-6">
            <div className="min-w-0">
              <nav aria-label="Breadcrumb" className="mb-1 text-sm text-muted-foreground">
                <Link
                  href={`/o/${slug}/boards`}
                  className="inline-flex items-center gap-1 hover:text-foreground"
                >
                  <LayoutGrid className="size-3.5" aria-hidden="true" />
                  Boards
                </Link>
              </nav>
              <h1 className="truncate text-2xl font-semibold tracking-tight">{board.name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {total === null
                  ? ""
                  : `${total.toLocaleString()} ${total === 1 ? "image" : "images"}`}
                {board.createdBy ? ` · Created by ${board.createdBy}` : ""}
              </p>
              {board.description && (
                <p className="mt-2 max-w-2xl text-sm whitespace-pre-wrap">{board.description}</p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline">
                <Link href={`/o/${slug}/library`}>
                  <ImagePlus />
                  Add from library
                </Link>
              </Button>
              {(canEdit || board.canDelete) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" aria-label="Board options">
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {canEdit && (
                      <DropdownMenuItem onSelect={() => setEditing(true)}>
                        <Pencil /> Edit name & description
                      </DropdownMenuItem>
                    )}
                    {canEdit && board.coverImageId && (
                      <DropdownMenuItem
                        onSelect={() =>
                          update({ coverImageId: null }).then(
                            () => toast.success("Cover reset to the first image"),
                            (e) => toast.error(e.message),
                          )
                        }
                      >
                        <X /> Reset cover image
                      </DropdownMenuItem>
                    )}
                    {board.canDelete && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(true)}>
                          <Trash2 /> Delete board
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        )}
        feedEndpoint={`${base}/images`}
        defaultSort="manual"
        capabilities={capabilities}
        facets={facets}
        initial={initial}
        scopeParams={{ board: board.id }}
        onReorder={async (ids, target) => {
          await api(`${base}/reorder`, {
            method: "POST",
            body: JSON.stringify({ imageIds: ids, ...target }),
          });
        }}
        empty={
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-12 text-center">
            <div className="rounded-full bg-muted p-4">
              <LayoutGrid className="size-6 text-muted-foreground" aria-hidden="true" />
            </div>
            <div>
              <p className="font-medium">This board is empty</p>
              <p className="text-sm text-muted-foreground">
                Select images in the library and choose “Add to board”.
              </p>
            </div>
            <Button asChild>
              <Link href={`/o/${slug}/library`}>Go to library</Link>
            </Button>
          </div>
        }
        selectionActions={({ ids, clear, feed }) =>
          canEdit && (
            <>
              {ids.length === 1 && (
                <Button variant="outline" size="sm" onClick={() => setCover(ids[0])}>
                  <Star />
                  Set as cover
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    Move
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => moveTo(ids, "start", feed)}>
                    <ArrowUpToLine /> Move to start
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => moveTo(ids, "end", feed)}>
                    <ArrowDownToLine /> Move to end
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="outline" size="sm" onClick={() => remove(ids, feed, clear)}>
                <X />
                Remove from board
              </Button>
            </>
          )
        }
        lightboxActions={(image, feed) =>
          canEdit && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Set as board cover"
                    aria-pressed={board.coverImageId === image.id}
                    className="text-white hover:bg-white/15 hover:text-white"
                    onClick={() => setCover(image.id)}
                  >
                    <Star
                      className={board.coverImageId === image.id ? "fill-current" : undefined}
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Set as board cover</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Remove from board"
                    className="text-white hover:bg-white/15 hover:text-white"
                    onClick={() => remove([image.id], feed)}
                  >
                    <X />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Remove from board</TooltipContent>
              </Tooltip>
            </>
          )
        }
      />

      <BoardFormDialog
        open={editing}
        onOpenChange={setEditing}
        title="Edit board"
        submitLabel="Save"
        initial={{ name: board.name, description: board.description }}
        onSubmit={(v) => update({ name: v.name, description: v.description || null })}
      />

      <AlertDialog open={deleting} onOpenChange={setDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{board.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              The board and its order are deleted. The images stay in the library and on any other
              boards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={destroy}>
              Delete board
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
