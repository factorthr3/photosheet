"use client";

import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Info,
  Loader2,
  Maximize,
  Minimize,
  Pencil,
  X,
} from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useCallback, useEffect, useRef, useState } from "react";
import { MetadataEditor } from "@/components/metadata/metadata-editor";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatBytes, formatDate, formatDateTime } from "@/lib/format";
import { describeExposure } from "@/lib/image/exif";
import { type ImageDetail, type ImageListItem, isBrowserViewable } from "@/lib/images/dto";
import { licenceLabel, licenceState } from "@/lib/images/licence";
import { cn } from "@/lib/utils";
import { displayName } from "./contact-sheet";

function IconButton({
  label,
  onClick,
  children,
  pressed,
  href,
}: {
  label: string;
  onClick?: () => void;
  children: React.ReactNode;
  pressed?: boolean;
  href?: string;
}) {
  const cls = "text-white hover:bg-white/15 hover:text-white";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {href ? (
          <Button asChild variant="ghost" size="icon" className={cls}>
            <a href={href} aria-label={label}>
              {children}
            </a>
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className={cn(cls, pressed && "bg-white/20")}
            aria-label={label}
            aria-pressed={pressed}
            onClick={onClick}
          >
            {children}
          </Button>
        )}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

const detailCache = new Map<string, ImageDetail>();

function useImageDetail(slug: string, id: string | undefined, enabled: boolean) {
  const [detail, setDetail] = useState<ImageDetail | null>(
    id ? (detailCache.get(id) ?? null) : null,
  );
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!id || !enabled) return;
    const cached = detailCache.get(id);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- show cached detail immediately
    setDetail(cached ?? null);
    if (cached) return;
    let cancelled = false;
    fetch(`/api/o/${slug}/images/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (!body || cancelled) return;
        detailCache.set(id, body.image);
        setDetail(body.image);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [slug, id, enabled, version]);
  const update = useCallback((d: ImageDetail) => {
    cacheImageDetail(d);
    setVersion((v) => v + 1);
  }, []);
  return [detail, update] as const;
}

/** Drop cached details (after edits). */
export function invalidateImageDetail(ids: string[]) {
  for (const id of ids) detailCache.delete(id);
}

function cacheImageDetail(detail: ImageDetail) {
  detailCache.set(detail.id, detail);
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  if (children === null || children === undefined || children === "") return null;
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs text-white/60">{label}</dt>
      <dd className="text-sm break-words text-white">{children}</dd>
    </div>
  );
}

function InfoPanel({
  slug,
  image,
  detail,
  canEdit,
  tagSuggestions,
  onSaved,
}: {
  slug: string;
  image: ImageListItem;
  detail: ImageDetail | null;
  canEdit: boolean;
  tagSuggestions: string[];
  onSaved: (detail: ImageDetail) => void;
}) {
  const lstate = licenceState(image.licence, image.licenceExpiresAt);
  const [editing, setEditing] = useState<string | null>(null);
  const isEditing = editing === image.id && !!detail;
  return (
    <aside
      aria-label="Image details"
      className="dark w-full shrink-0 overflow-y-auto border-white/10 bg-neutral-900/95 p-5 text-white md:w-80 md:border-l"
    >
      <div className="mb-4 flex items-start justify-between gap-2">
        <h2 className="text-base font-semibold break-words text-white">{displayName(image)}</h2>
        {canEdit && detail && !isEditing && (
          <Button variant="secondary" size="sm" onClick={() => setEditing(image.id)}>
            <Pencil />
            Edit
          </Button>
        )}
      </div>
      {isEditing ? (
        <MetadataEditor
          key={detail.id}
          slug={slug}
          image={detail}
          tagSuggestions={tagSuggestions}
          onCancel={() => setEditing(null)}
          onSaved={(d) => {
            setEditing(null);
            onSaved(d);
          }}
        />
      ) : !detail ? (
        <Loader2 className="size-4 animate-spin text-white/60" aria-label="Loading details" />
      ) : (
        <dl className="grid gap-3">
          <InfoRow label="Description">{detail.description}</InfoRow>
          <InfoRow label="Tags">
            {detail.tags.length ? (
              <span className="flex flex-wrap gap-1">
                {detail.tags.map((t) => (
                  <span key={t} className="rounded bg-white/10 px-1.5 py-0.5 text-xs">
                    {t}
                  </span>
                ))}
              </span>
            ) : null}
          </InfoRow>
          <InfoRow label="Credit">{detail.credit}</InfoRow>
          <InfoRow label="Copyright">{detail.copyright}</InfoRow>
          <InfoRow label="Licence">
            {licenceLabel(detail.licence) || (lstate === "none" ? "Not set" : null)}
            {detail.licenceExpiresAt && (
              <span
                className={cn(
                  "block text-xs",
                  lstate === "expired"
                    ? "text-red-400"
                    : lstate === "expiring"
                      ? "text-amber-300"
                      : "text-white/70",
                )}
              >
                {lstate === "expired" ? "Expired" : "Expires"} {formatDate(detail.licenceExpiresAt)}
              </span>
            )}
          </InfoRow>
          <InfoRow label="File">
            {detail.filename}
            <span className="block text-xs text-white/70">
              {detail.width && detail.height ? `${detail.width} × ${detail.height} · ` : ""}
              {formatBytes(detail.bytes)} · {detail.mimeType.replace("image/", "").toUpperCase()}
            </span>
          </InfoRow>
          <InfoRow label="Taken">{detail.takenAt ? formatDateTime(detail.takenAt) : null}</InfoRow>
          <InfoRow label="Camera">{describeExposure(detail.exif)}</InfoRow>
          <InfoRow label="Lens">{detail.exif?.lens}</InfoRow>
          <InfoRow label="Location">
            {detail.exif?.latitude !== undefined && detail.exif?.longitude !== undefined
              ? `${detail.exif.latitude.toFixed(5)}, ${detail.exif.longitude.toFixed(5)}`
              : null}
          </InfoRow>
          <InfoRow label="Uploaded">
            {formatDateTime(detail.createdAt)}
            {detail.uploader && (
              <span className="block text-xs text-white/70">
                by {detail.uploader.name || detail.uploader.email}
              </span>
            )}
          </InfoRow>
        </dl>
      )}
    </aside>
  );
}

function LicenceBanner({ image }: { image: ImageListItem }) {
  const state = licenceState(image.licence, image.licenceExpiresAt);
  if (state !== "expired" && state !== "expiring" && state !== "restricted") return null;
  const label = licenceLabel(image.licence);
  const text =
    state === "expired"
      ? `Licence expired on ${formatDate(image.licenceExpiresAt)} — do not use this image.`
      : state === "expiring"
        ? `Licence expires on ${formatDate(image.licenceExpiresAt)}${label ? ` (${label})` : ""}.`
        : `Restricted: ${label}. Check usage rights before publishing.`;
  return (
    <div
      role="status"
      className={cn(
        "flex items-center gap-2 px-4 py-2 text-sm font-medium",
        state === "expired"
          ? "bg-red-600 text-white"
          : state === "expiring"
            ? "bg-amber-400 text-amber-950"
            : "bg-white/10 text-white",
      )}
    >
      <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
      {text}
    </div>
  );
}

export interface LightboxProps {
  slug: string;
  images: ImageListItem[];
  index: number | null;
  onIndexChange: (index: number | null) => void;
  hasMore: boolean;
  loadMore: () => void;
  canDownload: boolean;
  selected?: Set<string>;
  onToggleSelect?: (id: string) => void;
  /** Extra toolbar actions for the current image (resize, edit, add to board…). */
  actions?: (image: ImageListItem) => React.ReactNode;
  canEdit?: boolean;
  tagSuggestions?: string[];
  onImageUpdated?: (image: ImageListItem) => void;
}

/** Full-screen viewer. ←/→ to move, I for info, F for full size, S to select, Esc to close. */
export function Lightbox({
  slug,
  images,
  index,
  onIndexChange,
  hasMore,
  loadMore,
  canDownload,
  selected,
  onToggleSelect,
  actions,
  canEdit = false,
  tagSuggestions = [],
  onImageUpdated,
}: LightboxProps) {
  const open = index !== null && index >= 0 && index < images.length;
  const image = open ? images[index] : undefined;
  const [showInfo, setShowInfo] = useState(false);
  const [fullSize, setFullSize] = useState(false);
  const [loaded, setLoaded] = useState<string | null>(null);
  const [detail, setDetail] = useImageDetail(slug, image?.id, open && showInfo);
  const touchStart = useRef<number | null>(null);

  const go = useCallback(
    (delta: number) => {
      if (index === null) return;
      const next = index + delta;
      if (next < 0) return;
      if (next >= images.length) {
        if (hasMore) loadMore();
        return;
      }
      setFullSize(false);
      onIndexChange(next);
      if (next >= images.length - 5 && hasMore) loadMore();
    },
    [index, images.length, hasMore, loadMore, onIndexChange],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key.toLowerCase() === "i") setShowInfo((s) => !s);
      else if (e.key.toLowerCase() === "f") setFullSize((s) => !s);
      else if (e.key.toLowerCase() === "s" && image && onToggleSelect) onToggleSelect(image.id);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, go, image, onToggleSelect]);

  // Preload neighbours.
  useEffect(() => {
    if (index === null) return;
    for (const n of [images[index + 1], images[index - 1]]) {
      if (n?.previewUrl) new window.Image().src = n.previewUrl;
    }
  }, [index, images]);

  const canFullSize = image ? isBrowserViewable(image.mimeType) : false;
  const src = image
    ? fullSize && canFullSize
      ? `/api/o/${slug}/images/${image.id}/download?inline=1`
      : (image.previewUrl ?? image.thumbUrl)
    : null;
  const isSelected = image ? (selected?.has(image.id) ?? false) : false;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onIndexChange(null)}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 flex flex-col text-white outline-none"
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {image && (
            <>
              <header className="flex items-center gap-1 px-2 py-2 sm:px-4">
                <DialogPrimitive.Title className="min-w-0 flex-1 truncate text-sm font-medium">
                  {displayName(image)}
                  <span className="ml-2 font-normal text-white/60 tabular-nums">
                    {index! + 1} / {images.length}
                    {hasMore ? "+" : ""}
                  </span>
                </DialogPrimitive.Title>
                {onToggleSelect && (
                  <IconButton
                    label={isSelected ? "Deselect (S)" : "Select (S)"}
                    pressed={isSelected}
                    onClick={() => onToggleSelect(image.id)}
                  >
                    <Check />
                  </IconButton>
                )}
                {actions?.(image)}
                {canFullSize && (
                  <IconButton
                    label={fullSize ? "Fit preview (F)" : "Full size (F)"}
                    pressed={fullSize}
                    onClick={() => setFullSize((s) => !s)}
                  >
                    {fullSize ? <Minimize /> : <Maximize />}
                  </IconButton>
                )}
                {canDownload && (
                  <IconButton
                    label="Download original"
                    href={`/api/o/${slug}/images/${image.id}/download`}
                  >
                    <Download />
                  </IconButton>
                )}
                <IconButton
                  label="Info (I)"
                  pressed={showInfo}
                  onClick={() => setShowInfo((s) => !s)}
                >
                  <Info />
                </IconButton>
                <DialogPrimitive.Close asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/15 hover:text-white"
                    aria-label="Close (Esc)"
                  >
                    <X />
                  </Button>
                </DialogPrimitive.Close>
              </header>

              <LicenceBanner image={image} />
              <div className="flex min-h-0 flex-1 flex-col md:flex-row">
                <div
                  className={cn(
                    "relative flex min-h-0 flex-1 items-center justify-center",
                    fullSize ? "overflow-auto" : "overflow-hidden p-2 sm:p-6",
                  )}
                  onTouchStart={(e) => (touchStart.current = e.touches[0].clientX)}
                  onTouchEnd={(e) => {
                    if (touchStart.current === null) return;
                    const dx = e.changedTouches[0].clientX - touchStart.current;
                    if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
                    touchStart.current = null;
                  }}
                >
                  {src ? (
                    <>
                      {loaded !== src && image.thumbUrl && !fullSize && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={image.thumbUrl}
                          alt=""
                          aria-hidden="true"
                          className="absolute max-h-full max-w-full object-contain blur-sm"
                        />
                      )}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        key={src}
                        src={src}
                        alt={displayName(image)}
                        onLoad={() => setLoaded(src)}
                        className={cn(
                          "relative",
                          fullSize ? "max-w-none" : "max-h-full max-w-full object-contain",
                        )}
                      />
                      {loaded !== src && (
                        <Loader2
                          className="absolute size-6 animate-spin text-white/70"
                          aria-label="Loading image"
                        />
                      )}
                    </>
                  ) : (
                    <p className="text-white/70">
                      {image.status === "FAILED"
                        ? "This image couldn't be processed."
                        : "Still processing…"}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() => go(-1)}
                    disabled={index === 0}
                    aria-label="Previous image"
                    className="absolute top-1/2 left-2 hidden -translate-y-1/2 rounded-full bg-black/40 p-2 hover:bg-black/60 disabled:opacity-0 sm:block"
                  >
                    <ChevronLeft className="size-6" />
                  </button>
                  <button
                    type="button"
                    onClick={() => go(1)}
                    disabled={index === images.length - 1 && !hasMore}
                    aria-label="Next image"
                    className="absolute top-1/2 right-2 hidden -translate-y-1/2 rounded-full bg-black/40 p-2 hover:bg-black/60 disabled:opacity-0 sm:block"
                  >
                    <ChevronRight className="size-6" />
                  </button>
                </div>
                {showInfo && (
                  <InfoPanel
                    slug={slug}
                    image={image}
                    detail={detail}
                    canEdit={canEdit}
                    tagSuggestions={tagSuggestions}
                    onSaved={(d) => {
                      setDetail(d);
                      onImageUpdated?.(d);
                    }}
                  />
                )}
              </div>
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
