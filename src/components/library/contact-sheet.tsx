"use client";

import { Check, ImageOff, Loader2, Maximize2 } from "lucide-react";
import { memo, useCallback, useEffect, useEffectEvent, useRef } from "react";
import type { ImageListItem } from "@/lib/images/dto";
import { cn } from "@/lib/utils";
import type { SelectModifiers, SheetBackground } from "./hooks";
import { ImageBadges } from "./image-badges";

export function displayName(image: Pick<ImageListItem, "title" | "filename">) {
  return image.title || image.filename;
}

interface TileProps {
  image: ImageListItem;
  index: number;
  size: number;
  selected: boolean;
  selectionActive: boolean;
  onSelect: (id: string, mods: SelectModifiers) => void;
  onOpen: (index: number) => void;
  onKeyNav: (index: number, key: string) => void;
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
}: ContactSheetProps) {
  const gridRef = useRef<HTMLUListElement>(null);
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
