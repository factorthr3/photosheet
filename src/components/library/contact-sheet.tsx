"use client";

import { Check, ImageOff, Loader2, Maximize2 } from "lucide-react";
import { memo, useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import type { ImageListItem } from "@/lib/images/dto";
import { cn } from "@/lib/utils";
import type { SelectModifiers, SheetBackground } from "./hooks";
import { ImageBadges } from "./image-badges";

export function displayName(image: Pick<ImageListItem, "title" | "filename">) {
  return image.title || image.filename;
}

export type DropSide = "before" | "after";
export type ReorderTarget = { beforeId?: string; afterId?: string };

interface TileProps {
  image: ImageListItem;
  index: number;
  size: number;
  selected: boolean;
  selectionActive: boolean;
  onSelect: (id: string, mods: SelectModifiers) => void;
  onOpen: (index: number) => void;
  onKeyNav: (index: number, key: string) => void;
  reorderable: boolean;
  dropSide: DropSide | null;
  onDragStartTile: (id: string, e: React.DragEvent) => void;
  onDragOverTile: (id: string, e: React.DragEvent) => void;
  onDropTile: (id: string, e: React.DragEvent) => void;
  onDragEndTile: () => void;
  onKeyMove: (index: number, direction: -1 | 1) => void;
}

const coarsePointer = () =>
  typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

const Tile = memo(function Tile({
  image,
  index,
  size,
  selected,
  selectionActive,
  onSelect,
  onOpen,
  onKeyNav,
  reorderable,
  dropSide,
  onDragStartTile,
  onDragOverTile,
  onDropTile,
  onDragEndTile,
  onKeyMove,
}: TileProps) {
  const name = displayName(image);
  const showCaption = size >= 120;

  function handleClick(e: React.MouseEvent) {
    // Touch: tap opens, unless we're already picking images.
    if (coarsePointer() && !selectionActive) {
      onOpen(index);
      return;
    }
    onSelect(image.id, {
      shift: e.shiftKey,
      toggle: e.metaKey || e.ctrlKey || (coarsePointer() && selectionActive),
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      onOpen(index);
    } else if (reorderable && e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      e.preventDefault();
      onKeyMove(index, e.key === "ArrowLeft" ? -1 : 1);
    } else if (e.key === " ") {
      e.preventDefault();
      onSelect(image.id, { toggle: true, shift: e.shiftKey });
    } else if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) {
      e.preventDefault();
      onKeyNav(index, e.key);
    }
  }

  return (
    <li
      className="group/tile relative [contain-intrinsic-size:auto_220px] [content-visibility:auto]"
      data-image-id={image.id}
    >
      <div
        role="button"
        tabIndex={0}
        data-tile-index={index}
        aria-pressed={selected}
        aria-label={`${name}${selected ? ", selected" : ""}`}
        aria-roledescription={reorderable ? "sortable image" : undefined}
        draggable={reorderable}
        onDragStart={reorderable ? (e) => onDragStartTile(image.id, e) : undefined}
        onDragOver={reorderable ? (e) => onDragOverTile(image.id, e) : undefined}
        onDrop={reorderable ? (e) => onDropTile(image.id, e) : undefined}
        onDragEnd={reorderable ? onDragEndTile : undefined}
        onClick={handleClick}
        onDoubleClick={() => onOpen(index)}
        onKeyDown={handleKeyDown}
        className={cn(
          "sheet-tile relative flex aspect-square cursor-default items-center justify-center overflow-hidden rounded-md p-2 outline-none select-none",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
          selected
            ? "bg-[var(--sheet-selected)] ring-2 ring-[var(--sheet-accent)] ring-inset"
            : "hover:bg-[var(--sheet-hover)]",
        )}
      >
        {image.thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image.thumbUrl}
            srcSet={
              image.previewUrl ? `${image.thumbUrl} 320w, ${image.previewUrl} 1280w` : undefined
            }
            sizes={`${size}px`}
            alt={name}
            loading="lazy"
            decoding="async"
            draggable={false}
            className="max-h-full max-w-full rounded-[2px] object-contain shadow-sm"
          />
        ) : image.status === "FAILED" ? (
          <span className="flex flex-col items-center gap-1 text-center text-xs text-destructive">
            <ImageOff className="size-6" aria-hidden="true" />
            Processing failed
          </span>
        ) : (
          <Loader2 className="size-6 animate-spin opacity-60" aria-label="Processing" />
        )}
        <ImageBadges image={image} />
      </div>
      {dropSide && (
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute top-0 bottom-6 w-1 rounded-full bg-[var(--sheet-accent)]",
            dropSide === "before" ? "-left-1.5" : "-right-1.5",
          )}
        />
      )}

      {/* Selection checkbox: always visible when selected or selecting, else on hover/focus. */}
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={(e) => {
          e.stopPropagation();
          onSelect(image.id, { toggle: true, shift: e.shiftKey });
        }}
        className={cn(
          "absolute top-1.5 left-1.5 flex size-6 items-center justify-center rounded-full border-2 transition-opacity",
          selected
            ? "border-[var(--sheet-accent)] bg-[var(--sheet-accent)] text-white opacity-100"
            : "border-white/90 bg-black/25 text-transparent opacity-0 group-focus-within/tile:opacity-100 group-hover/tile:opacity-100",
          selectionActive && "opacity-100",
        )}
      >
        <Check className="size-3.5" strokeWidth={3} />
      </button>

      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={(e) => {
          e.stopPropagation();
          onOpen(index);
        }}
        className="absolute top-1.5 right-1.5 flex size-7 items-center justify-center rounded-md bg-black/45 text-white opacity-0 transition-opacity group-hover/tile:opacity-100 pointer-coarse:hidden"
      >
        <Maximize2 className="size-3.5" />
      </button>

      {showCaption && (
        <p
          className="mt-1 truncate px-1 text-center text-xs text-[var(--sheet-caption)]"
          title={name}
        >
          {name}
        </p>
      )}
    </li>
  );
});

export interface ContactSheetProps {
  images: ImageListItem[];
  selected: Set<string>;
  onSelect: (id: string, mods: SelectModifiers) => void;
  onOpen: (index: number) => void;
  onSelectAll?: () => void;
  onClearSelection?: () => void;
  tileSize: number;
  background: SheetBackground;
  hasMore: boolean;
  loading: boolean;
  onEndReached: () => void;
  label: string;
  /** Enable drag-and-drop (and Alt+←/→) reordering. */
  onReorder?: (ids: string[], target: ReorderTarget) => void;
}

/** Responsive contact-sheet grid with lazy thumbnails and infinite scroll. */
export function ContactSheet({
  images,
  selected,
  onSelect,
  onOpen,
  onSelectAll,
  onClearSelection,
  tileSize,
  background,
  hasMore,
  loading,
  onEndReached,
  label,
  onReorder,
}: ContactSheetProps) {
  const gridRef = useRef<HTMLUListElement>(null);
  const dragIds = useRef<string[] | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; side: DropSide } | null>(null);
  const reorderable = !!onReorder;

  /** Dragging a selected tile moves the whole selection (in grid order). */
  const idsToMove = useCallback(
    (id: string) =>
      selected.has(id) ? images.filter((i) => selected.has(i.id)).map((i) => i.id) : [id],
    [images, selected],
  );

  const onDragStartTile = useCallback(
    (id: string, e: React.DragEvent) => {
      dragIds.current = idsToMove(id);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", dragIds.current.join(","));
    },
    [idsToMove],
  );

  const onDragOverTile = useCallback((id: string, e: React.DragEvent) => {
    if (!dragIds.current) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const side: DropSide = e.clientX < rect.left + rect.width / 2 ? "before" : "after";
    setDropTarget((t) => (t?.id === id && t.side === side ? t : { id, side }));
  }, []);

  const onDropTile = useCallback(
    (id: string, e: React.DragEvent) => {
      const ids = dragIds.current;
      if (!ids || !onReorder) return;
      e.preventDefault();
      const side = dropTarget?.id === id ? dropTarget.side : "before";
      if (!ids.includes(id)) onReorder(ids, side === "before" ? { beforeId: id } : { afterId: id });
      dragIds.current = null;
      setDropTarget(null);
    },
    [dropTarget, onReorder],
  );

  const onDragEndTile = useCallback(() => {
    dragIds.current = null;
    setDropTarget(null);
  }, []);

  const onKeyMove = useCallback(
    (index: number, direction: -1 | 1) => {
      if (!onReorder) return;
      const id = images[index].id;
      const moving = new Set(idsToMove(id));
      let j = index + direction;
      while (j >= 0 && j < images.length && moving.has(images[j].id)) j += direction;
      if (j < 0 || j >= images.length) return;
      onReorder(
        [...moving],
        direction < 0 ? { beforeId: images[j].id } : { afterId: images[j].id },
      );
      requestAnimationFrame(() =>
        gridRef.current
          ?.querySelector<HTMLElement>(`[data-image-id="${id}"] [data-tile-index]`)
          ?.focus(),
      );
    },
    [images, idsToMove, onReorder],
  );
  const sentinelRef = useRef<HTMLDivElement>(null);
  const endReached = useEffectEvent(() => onEndReached());

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => entries.some((e) => e.isIntersecting) && endReached(),
      { rootMargin: "1200px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, images.length]);

  const onKeyNav = useCallback(
    (index: number, key: string) => {
      const grid = gridRef.current;
      if (!grid) return;
      const cols = getComputedStyle(grid).gridTemplateColumns.split(" ").length || 1;
      const delta: Record<string, number> = {
        ArrowLeft: -1,
        ArrowRight: 1,
        ArrowUp: -cols,
        ArrowDown: cols,
      };
      let next = index + (delta[key] ?? 0);
      if (key === "Home") next = 0;
      if (key === "End") next = images.length - 1;
      next = Math.max(0, Math.min(images.length - 1, next));
      grid.querySelector<HTMLElement>(`[data-tile-index="${next}"]`)?.focus();
      if (next >= images.length - cols * 2) onEndReached();
    },
    [images.length, onEndReached],
  );

  return (
    <div
      className={cn(
        "sheet flex-1 px-3 py-4 sm:px-5",
        background === "dark" ? "sheet-dark" : "sheet-light",
      )}
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a" && onSelectAll) {
          e.preventDefault();
          onSelectAll();
        } else if (e.key === "Escape" && selected.size && onClearSelection) {
          onClearSelection();
        }
      }}
    >
      {reorderable && (
        <p className="sr-only">
          Drag images to reorder, or press Alt with the left or right arrow.
        </p>
      )}
      <ul
        ref={gridRef}
        aria-label={label}
        className="grid gap-x-2 gap-y-3"
        // At least two columns on phones, whatever the slider says.
        style={{
          gridTemplateColumns: `repeat(auto-fill, minmax(min(${tileSize}px, calc(50% - 0.5rem)), 1fr))`,
        }}
      >
        {images.map((image, index) => (
          <Tile
            key={image.id}
            image={image}
            index={index}
            size={tileSize}
            selected={selected.has(image.id)}
            selectionActive={selected.size > 0}
            onSelect={onSelect}
            onOpen={onOpen}
            onKeyNav={onKeyNav}
            reorderable={reorderable}
            dropSide={dropTarget?.id === image.id ? dropTarget.side : null}
            onDragStartTile={onDragStartTile}
            onDragOverTile={onDragOverTile}
            onDropTile={onDropTile}
            onDragEndTile={onDragEndTile}
            onKeyMove={onKeyMove}
          />
        ))}
      </ul>
      <div ref={sentinelRef} aria-hidden="true" className="h-px" />
      {loading && (
        <div className="flex justify-center py-8" role="status">
          <Loader2 className="size-5 animate-spin opacity-60" />
          <span className="sr-only">Loading more images</span>
        </div>
      )}
    </div>
  );
}
