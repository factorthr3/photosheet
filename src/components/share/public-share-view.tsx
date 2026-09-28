"use client";

import { ChevronLeft, ChevronRight, Download, FileArchive, Loader2, X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useCallback, useEffect, useRef, useState } from "react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { triggerDownload } from "@/lib/download";
import { formatBytes, formatDate } from "@/lib/format";
import type { PublicImage } from "@/lib/public-share";

interface Variant {
  id: string;
  label: string;
  detail: string;
}

interface Page {
  images: PublicImage[];
  nextCursor: number | null;
  total: number | null;
}

function DownloadMenu({
  token,
  imageId,
  variants,
  dark = false,
}: {
  token: string;
  imageId: string;
  variants: Variant[];
  dark?: boolean;
}) {
  if (variants.length === 0) return null;
  const href = (v: Variant) =>
    `/api/s/${token}/download?image=${imageId}&variant=${encodeURIComponent(v.id)}`;
  const cls = dark ? "text-white hover:bg-white/15 hover:text-white" : undefined;
  if (variants.length === 1) {
    return (
      <Button asChild variant={dark ? "ghost" : "outline"} size="sm" className={cls}>
        <a href={href(variants[0])}>
          <Download /> Download
        </a>
      </Button>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={dark ? "ghost" : "outline"} size="sm" className={cls}>
          <Download /> Download
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Choose a size
        </DropdownMenuLabel>
        {variants.map((v) => (
          <DropdownMenuItem key={v.id} asChild>
            <a href={href(v)} className="flex flex-col items-start gap-0">
              <span>{v.label}</span>
              <span className="text-xs text-muted-foreground">{v.detail}</span>
            </a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DownloadAll({
  token,
  variants,
  count,
}: {
  token: string;
  variants: Variant[];
  count: number;
}) {
  const [state, setState] = useState<{
    id: string;
    status: string;
    progress: number;
    bytes: number | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!state || state.status === "READY" || state.status === "FAILED") return;
    const t = setTimeout(async () => {
      const res = await fetch(`/api/s/${token}/exports/${state.id}`);
      if (!res.ok) return;
      const { export: e } = await res.json();
      setState({ id: e.id, status: e.status, progress: e.progress, bytes: e.bytes });
      if (e.status === "READY") triggerDownload(`/api/s/${token}/exports/${e.id}/download`);
      if (e.status === "FAILED") setError(e.error ?? "The ZIP couldn't be made");
    }, 1000);
    return () => clearTimeout(t);
  }, [state, token]);

  async function start(variant: Variant) {
    setError(null);
    const res = await fetch(`/api/s/${token}/zip`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ variant: variant.id }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Couldn't start the download");
      return;
    }
    setState({ id: body.export.id, status: body.export.status, progress: 0, bytes: null });
  }

  if (variants.length === 0) return null;
  const busy = state && state.status !== "READY" && state.status !== "FAILED";

  return (
    <div className="flex flex-wrap items-center gap-3">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button disabled={!!busy}>
            {busy ? <Loader2 className="animate-spin" /> : <FileArchive />}
            {busy ? `Preparing ZIP… ${state!.progress}%` : `Download all (${count})`}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            ZIP of every photo as…
          </DropdownMenuLabel>
          {variants.map((v) => (
            <DropdownMenuItem
              key={v.id}
              onSelect={() => start(v)}
              className="flex flex-col items-start gap-0"
            >
              <span>{v.label}</span>
              <span className="text-xs text-muted-foreground">{v.detail}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <span role="status" aria-live="polite" className="text-sm text-muted-foreground">
        {state?.status === "READY" && (
          <>
            Ready ({formatBytes(state.bytes)}).{" "}
            <a className="underline" href={`/api/s/${token}/exports/${state.id}/download`}>
              Download again
            </a>
          </>
        )}
      </span>
      {error && (
        <span role="alert" className="text-sm text-destructive">
          {error}
        </span>
      )}
    </div>
  );
}

function Viewer({
  token,
  images,
  index,
  onIndex,
  variants,
  hasMore,
  loadMore,
}: {
  token: string;
  images: PublicImage[];
  index: number | null;
  onIndex: (i: number | null) => void;
  variants: Variant[];
  hasMore: boolean;
  loadMore: () => void;
}) {
  const open = index !== null && !!images[index];
  const img = open ? images[index] : null;
  const touch = useRef<number | null>(null);

  const go = useCallback(
    (d: number) => {
      if (index === null) return;
      const next = index + d;
      if (next < 0) return;
      if (next >= images.length) {
        if (hasMore) loadMore();
        return;
      }
      onIndex(next);
      if (next > images.length - 4 && hasMore) loadMore();
    },
    [index, images.length, hasMore, loadMore, onIndex],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, go]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onIndex(null)}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 flex flex-col text-white outline-none"
          aria-describedby={undefined}
        >
          {img && (
            <>
              <header className="flex items-center gap-2 px-3 py-2">
                <DialogPrimitive.Title className="min-w-0 flex-1 truncate text-sm font-medium">
                  {img.name}
                  <span className="ml-2 font-normal text-white/60 tabular-nums">
                    {index! + 1} / {images.length}
                    {hasMore ? "+" : ""}
                  </span>
                </DialogPrimitive.Title>
                <DownloadMenu token={token} imageId={img.id} variants={variants} dark />
                <DialogPrimitive.Close asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/15 hover:text-white"
                    aria-label="Close"
                  >
                    <X />
                  </Button>
                </DialogPrimitive.Close>
              </header>
              <div
                className="relative flex min-h-0 flex-1 items-center justify-center p-2 sm:p-6"
                onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
                onTouchEnd={(e) => {
                  if (touch.current === null) return;
                  const dx = e.changedTouches[0].clientX - touch.current;
                  if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
                  touch.current = null;
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.previewUrl ?? img.thumbUrl ?? ""}
                  alt={img.name}
                  className="max-h-full max-w-full object-contain"
                />
                <button
                  type="button"
                  onClick={() => go(-1)}
                  disabled={index === 0}
                  aria-label="Previous photo"
                  className="absolute top-1/2 left-2 hidden -translate-y-1/2 rounded-full bg-black/40 p-2 hover:bg-black/60 disabled:opacity-0 sm:block"
                >
                  <ChevronLeft className="size-6" />
                </button>
                <button
                  type="button"
                  onClick={() => go(1)}
                  disabled={index === images.length - 1 && !hasMore}
                  aria-label="Next photo"
                  className="absolute top-1/2 right-2 hidden -translate-y-1/2 rounded-full bg-black/40 p-2 hover:bg-black/60 disabled:opacity-0 sm:block"
                >
                  <ChevronRight className="size-6" />
                </button>
              </div>
              {img.licenceExpired && (
                <p
                  role="status"
                  className="bg-red-600 px-4 py-2 text-center text-sm font-medium text-white"
                >
                  The licence for this photo has expired — please don&apos;t publish it.
                </p>
              )}
              {(img.description || img.credit || img.copyright || img.licence) && (
                <footer className="space-y-1 px-4 pb-4 text-center text-sm text-white/80">
                  {img.description && <p>{img.description}</p>}
                  <p className="text-xs text-white/60">
                    {[
                      img.credit && `Photo: ${img.credit}`,
                      img.copyright,
                      img.licence && `Licence: ${img.licence}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </footer>
              )}
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function PublicShareView({
  token,
  orgName,
  title,
  message,
  description,
  isBoard,
  expiresAt,
  variants,
  initial,
}: {
  token: string;
  orgName: string;
  title: string;
  message: string | null;
  description: string | null;
  isBoard: boolean;
  expiresAt: string | null;
  variants: Variant[];
  initial: Page;
}) {
  const [images, setImages] = useState(initial.images);
  const [cursor, setCursor] = useState(initial.nextCursor);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const total = initial.total ?? images.length;

  // Count one view per browser session.
  useEffect(() => {
    try {
      const key = `ps-viewed-${token}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // storage unavailable: count anyway
    }
    void fetch(`/api/s/${token}/view`, { method: "POST" });
  }, [token]);

  const loadMore = useCallback(async () => {
    if (cursor === null || loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/s/${token}/images?cursor=${cursor}`);
      const page: Page = await res.json();
      setImages((prev) => [
        ...prev,
        ...page.images.filter((p) => !prev.some((i) => i.id === p.id)),
      ]);
      setCursor(page.nextCursor);
    } finally {
      setLoading(false);
    }
  }, [cursor, loading, token]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || cursor === null) return;
    const io = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && void loadMore(), {
      rootMargin: "800px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, [cursor, loadMore]);

  return (
    <div className="flex min-h-svh flex-col bg-neutral-50 dark:bg-neutral-950">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <p className="truncate text-sm font-medium">{orgName}</p>
          <Logo compact className="opacity-70" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        <div className="mb-8 grid gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">
            {total} {total === 1 ? "photo" : "photos"} shared by {orgName}
            {expiresAt &&
              ` · available until ${formatDate(new Date(new Date(expiresAt).getTime() - 1))}`}
          </p>
          {message && (
            <p className="max-w-2xl rounded-lg border bg-background p-4 text-sm whitespace-pre-wrap">
              {message}
            </p>
          )}
          {description && !message && (
            <p className="max-w-2xl text-sm whitespace-pre-wrap text-muted-foreground">
              {description}
            </p>
          )}
          {isBoard && total > 0 && <DownloadAll token={token} variants={variants} count={total} />}
          {!isBoard && images[0] && (
            <div>
              <DownloadMenu token={token} imageId={images[0].id} variants={variants} />
            </div>
          )}
        </div>

        {images.length === 0 ? (
          <p className="py-16 text-center text-muted-foreground">
            There are no photos here right now.
          </p>
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(200px,calc(50%-0.5rem)),1fr))] gap-4">
            {images.map((img, i) => (
              <li key={img.id} className="group">
                <button
                  type="button"
                  onClick={() => setOpen(i)}
                  className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg bg-neutral-200/60 p-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none dark:bg-neutral-900"
                  aria-label={`Open ${img.name}`}
                >
                  {img.thumbUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={img.thumbUrl}
                      srcSet={
                        img.previewUrl ? `${img.thumbUrl} 320w, ${img.previewUrl} 1280w` : undefined
                      }
                      sizes="220px"
                      alt={img.name}
                      loading="lazy"
                      className="max-h-full max-w-full object-contain shadow-sm transition-transform group-hover:scale-[1.02]"
                    />
                  )}
                </button>
                <p className="mt-1.5 truncate text-center text-xs text-muted-foreground">
                  {img.name}
                </p>
              </li>
            ))}
          </ul>
        )}
        <div ref={sentinel} aria-hidden="true" />
        {loading && (
          <div className="flex justify-center py-6" role="status">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
            <span className="sr-only">Loading more photos</span>
          </div>
        )}
      </main>

      <footer className="py-6 text-center text-xs text-muted-foreground">
        Shared with PhotoSheet
      </footer>

      <Viewer
        token={token}
        images={images}
        index={open}
        onIndex={setOpen}
        variants={variants}
        hasMore={cursor !== null}
        loadMore={loadMore}
      />
    </div>
  );
}
