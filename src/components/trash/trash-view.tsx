"use client";

import { Check, Loader2, RotateCcw, Trash2 } from "lucide-react";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { TrashItem } from "@/lib/trash-list";
import { cn } from "@/lib/utils";

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

export function TrashView({
  slug,
  initial,
  canPurge,
}: {
  slug: string;
  initial: { images: TrashItem[]; nextCursor: string | null; total: number | null };
  canPurge: boolean;
}) {
  const [items, setItems] = useState(initial.images);
  const [cursor, setCursor] = useState(initial.nextCursor);
  const [total, setTotal] = useState(initial.total ?? initial.images.length);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  function drop(ids: string[]) {
    const set = new Set(ids);
    setItems((all) => all.filter((i) => !set.has(i.id)));
    setTotal((t) => Math.max(0, t - ids.length));
    setSelected(new Set());
  }

  async function restore(ids: string[]) {
    setBusy(true);
    try {
      const { restored, skipped } = await post<{ restored: string[]; skipped: number }>(
        `/api/o/${slug}/images/restore`,
        { imageIds: ids },
      );
      drop(restored);
      toast.success(
        `Restored ${restored.length} ${restored.length === 1 ? "image" : "images"}${skipped ? ` (${skipped} not yours to restore)` : ""}`,
      );
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function purge(ids: string[]) {
    setBusy(true);
    try {
      const { purged } = await post<{ purged: string[] }>(`/api/o/${slug}/images/purge`, {
        imageIds: ids,
      });
      drop(purged);
      toast.success(
        `Permanently deleted ${purged.length} ${purged.length === 1 ? "image" : "images"}`,
      );
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function emptyTrash() {
    setBusy(true);
    try {
      await post(`/api/o/${slug}/images/purge`, { all: true });
      setItems([]);
      setTotal(0);
      toast.success("Emptying trash — this can take a moment for large libraries");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function loadMore() {
    const res = await fetch(`/api/o/${slug}/trash?cursor=${cursor}`);
    const page = await res.json();
    setItems((all) => [...all, ...page.images]);
    setCursor(page.nextCursor);
  }

  const ids = [...selected];

  if (items.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-12 text-center">
        <Trash2 className="size-8 text-muted-foreground" aria-hidden="true" />
        <p className="font-medium">Trash is empty</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-sm text-muted-foreground" aria-live="polite">
          {selected.size ? `${selected.size} selected` : `${total.toLocaleString()} in trash`}
        </p>
        <Button
          variant="outline"
          size="sm"
          disabled={!selected.size || busy}
          onClick={() => restore(ids)}
        >
          <RotateCcw /> Restore
        </Button>
        {canPurge && (
          <>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!selected.size || busy}
                  className="text-destructive"
                >
                  <Trash2 /> Delete permanently
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Delete {selected.size} {selected.size === 1 ? "image" : "images"} forever?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    The originals and every generated size are removed. This can&apos;t be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" onClick={() => purge(ids)}>
                    Delete forever
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={busy}>
                  {busy && <Loader2 className="animate-spin" />} Empty trash
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Empty the trash?</AlertDialogTitle>
                  <AlertDialogDescription>
                    All {total.toLocaleString()} images in the trash will be deleted permanently.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" onClick={emptyTrash}>
                    Empty trash
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </div>

      <ul
        className="grid grid-cols-[repeat(auto-fill,minmax(min(160px,calc(50%-0.5rem)),1fr))] gap-3"
        aria-label="Trashed images"
      >
        {items.map((img) => {
          const isSel = selected.has(img.id);
          return (
            <li key={img.id}>
              <button
                type="button"
                aria-pressed={isSel}
                aria-label={`${img.title || img.filename}, ${img.daysLeft} days left${isSel ? ", selected" : ""}`}
                onClick={() => toggle(img.id)}
                className={cn(
                  "relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-md bg-muted p-2 opacity-80 transition hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  isSel && "opacity-100 ring-2 ring-primary",
                )}
              >
                {img.thumbUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={img.thumbUrl}
                    alt=""
                    loading="lazy"
                    className="max-h-full max-w-full object-contain grayscale-[40%]"
                  />
                )}
                <span
                  className={cn(
                    "absolute top-1.5 left-1.5 flex size-5 items-center justify-center rounded-full border-2",
                    isSel
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-white/80 bg-black/20 text-transparent",
                  )}
                >
                  <Check className="size-3" strokeWidth={3} />
                </span>
              </button>
              <p className="mt-1 truncate text-xs">{img.title || img.filename}</p>
              <p className="text-xs text-muted-foreground">
                {img.daysLeft === 0
                  ? "Deleting soon"
                  : `${img.daysLeft} ${img.daysLeft === 1 ? "day" : "days"} left`}
                {img.deletedBy && ` · by ${img.deletedBy}`}
              </p>
            </li>
          );
        })}
      </ul>
      {cursor && (
        <Button variant="outline" className="justify-self-center" onClick={loadMore}>
          Load more
        </Button>
      )}
    </div>
  );
}
