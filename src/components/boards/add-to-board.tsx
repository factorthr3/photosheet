"use client";

import { FolderPlus, LayoutGrid, Loader2, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface BoardOption {
  id: string;
  name: string;
  imageCount: number;
  coverUrl: string | null;
}

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "content-type": "application/json" } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Request failed");
  return body as T;
}

/** Popover to put images on an existing board or a new one. */
export function AddToBoardButton({
  slug,
  imageIds,
  onDone,
  variant = "default",
}: {
  slug: string;
  imageIds: string[];
  onDone?: () => void;
  variant?: "default" | "lightbox";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [boards, setBoards] = useState<BoardOption[] | null>(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    try {
      const { boards } = await jsonFetch<{ boards: BoardOption[] }>(`/api/o/${slug}/boards`);
      setBoards(boards);
    } catch {
      toast.error("Couldn't load boards");
    }
  }

  const n = imageIds.length;
  const noun = `${n} ${n === 1 ? "image" : "images"}`;

  function done(board: { id: string; name: string }, added: number) {
    setOpen(false);
    setQ("");
    toast.success(
      added === 0
        ? `Already on “${board.name}”`
        : `Added ${added === n ? noun : `${added} of ${noun}`} to “${board.name}”`,
      {
        action: {
          label: "Open",
          onClick: () => router.push(`/o/${slug}/boards/${board.id}`),
        },
      },
    );
    onDone?.();
  }

  async function addTo(board: BoardOption) {
    setBusy(board.id);
    try {
      const { added } = await jsonFetch<{ added: number }>(
        `/api/o/${slug}/boards/${board.id}/images`,
        {
          method: "POST",
          body: JSON.stringify({ imageIds }),
        },
      );
      done(board, added);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function createWith(name: string) {
    setBusy("new");
    try {
      const { board, added } = await jsonFetch<{
        board: { id: string; name: string };
        added: number;
      }>(`/api/o/${slug}/boards`, { method: "POST", body: JSON.stringify({ name, imageIds }) });
      done(board, added);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const matches = (boards ?? []).filter((b) =>
    b.name.toLowerCase().includes(q.trim().toLowerCase()),
  );
  const exact = (boards ?? []).some((b) => b.name.toLowerCase() === q.trim().toLowerCase());

  const trigger =
    variant === "lightbox" ? (
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/15 hover:text-white"
              aria-label="Add to board"
            >
              <FolderPlus />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Add to board</TooltipContent>
      </Tooltip>
    ) : (
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <FolderPlus />
          Add to board
        </Button>
      </PopoverTrigger>
    );

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) void load();
      }}
    >
      {trigger}
      <PopoverContent align="end" className="w-72 p-0">
        <form
          className="border-b p-2"
          onSubmit={(e) => {
            e.preventDefault();
            const name = q.trim();
            if (!name) return;
            const match = matches.find((b) => b.name.toLowerCase() === name.toLowerCase());
            if (match) void addTo(match);
            else void createWith(name);
          }}
        >
          <Input
            autoFocus
            aria-label="Find or create a board"
            placeholder="Find or create a board…"
            className="h-8"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </form>
        <ul className="max-h-64 overflow-y-auto p-1" aria-label="Boards">
          {boards === null ? (
            <li className="flex justify-center p-4">
              <Loader2
                className="size-4 animate-spin text-muted-foreground"
                aria-label="Loading boards"
              />
            </li>
          ) : (
            <>
              {matches.map((b) => (
                <li key={b.id}>
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => addTo(b)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent disabled:opacity-60"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
                      {b.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={b.coverUrl} alt="" className="size-full object-cover" />
                      ) : (
                        <LayoutGrid className="size-4 text-muted-foreground" aria-hidden="true" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{b.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {b.imageCount} images
                      </span>
                    </span>
                    {busy === b.id && <Loader2 className="size-4 animate-spin" />}
                  </button>
                </li>
              ))}
              {q.trim() && !exact && (
                <li>
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => createWith(q.trim())}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-accent"
                  >
                    {busy === "new" ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Plus className="size-4" aria-hidden="true" />
                    )}
                    Create “{q.trim()}”
                  </button>
                </li>
              )}
              {matches.length === 0 && !q.trim() && (
                <li className="p-3 text-center text-sm text-muted-foreground">
                  No boards yet — type a name to create one.
                </li>
              )}
            </>
          )}
        </ul>
        <div className="border-t p-1">
          <Button asChild variant="ghost" size="sm" className="w-full justify-start">
            <Link href={`/o/${slug}/boards`}>View all boards</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
