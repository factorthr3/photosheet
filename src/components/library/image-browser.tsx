"use client";

import { ImageIcon, SearchX, Upload } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { BulkEditButton } from "@/components/metadata/bulk-edit-dialog";
import { PageHeader } from "@/components/page-header";
import { ResizeButton } from "@/components/resize/resize-button";
import { Button } from "@/components/ui/button";
import type { ImageListItem } from "@/lib/images/dto";
import {
  activeFilterCount,
  type FeedSort,
  feedQuery,
  filtersToSearchParams,
  type ImageFilters,
  parseFilters,
} from "@/lib/images/filters";
import type { ImagePage } from "@/lib/images/list";
import { ContactSheet, type ReorderTarget } from "./contact-sheet";
import { useImageFeed, useSelection, useViewPrefs } from "./hooks";
import { invalidateImageDetail, Lightbox } from "./lightbox";
import { type FilterFacets, LibraryToolbar } from "./library-toolbar";
import { SelectionBar } from "./selection-bar";
import { UploadButton, UploaderProvider, useUploader } from "./uploader";

export interface Capabilities {
  canUpload: boolean;
  canDownload: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canShare: boolean;
  canEditBoards: boolean;
}

export type Feed = ReturnType<typeof useImageFeed>;

export interface SelectionContext {
  ids: string[];
  images: ImageListItem[];
  clear: () => void;
  feed: Feed;
}

const CLEARED_FILTERS: Partial<ImageFilters> = {
  q: "",
  tags: [],
  uploader: undefined,
  from: undefined,
  to: undefined,
  orientation: undefined,
  licence: undefined,
  board: undefined,
};

/** Filters live in the URL; update it without a server round-trip. */
function useUrlFilters(defaultSort: FeedSort) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filters = useMemo(() => {
    try {
      return parseFilters(searchParams, { defaultSort });
    } catch {
      return parseFilters({}, { defaultSort });
    }
  }, [searchParams, defaultSort]);
  const query = useMemo(() => feedQuery(filters, defaultSort), [filters, defaultSort]);

  const setFilters = useCallback(
    (patch: Partial<ImageFilters>) => {
      const next = filtersToSearchParams({ ...filters, ...patch }, { defaultSort });
      const image = searchParams.get("image");
      if (image) next.set("image", image);
      const qs = next.toString();
      window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
    },
    [filters, pathname, searchParams, defaultSort],
  );

  const openImage = searchParams.get("image");
  const setOpenImage = useCallback(
    (id: string | null) => {
      const next = new URLSearchParams(searchParams);
      if (id) next.set("image", id);
      else next.delete("image");
      const qs = next.toString();
      const url = qs ? `${pathname}?${qs}` : pathname;
      // Opening pushes history so Back closes the lightbox; paging replaces it.
      if (id && !searchParams.get("image")) window.history.pushState(null, "", url);
      else window.history.replaceState(null, "", url);
    },
    [pathname, searchParams],
  );

  return { filters, query, setFilters, openImage, setOpenImage };
}

function EmptyState({
  filtered,
  onClear,
  empty,
}: {
  filtered: boolean;
  onClear: () => void;
  empty?: React.ReactNode;
}) {
  const uploader = useUploader();
  if (filtered) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-12 text-center">
        <SearchX className="size-8 text-muted-foreground" aria-hidden="true" />
        <p className="font-medium">No images match these filters</p>
        <Button variant="outline" onClick={onClear}>
          Clear search and filters
        </Button>
      </div>
    );
  }
  if (empty) return <>{empty}</>;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-12 text-center">
      <div className="rounded-full bg-muted p-4">
        {uploader.canUpload ? (
          <Upload className="size-6 text-muted-foreground" aria-hidden="true" />
        ) : (
          <ImageIcon className="size-6 text-muted-foreground" aria-hidden="true" />
        )}
      </div>
      <div>
        <p className="font-medium">No images yet</p>
        <p className="text-sm text-muted-foreground">
          {uploader.canUpload
            ? "Drag photos anywhere on this page, or choose files."
            : "Nothing has been uploaded yet."}
        </p>
      </div>
      {uploader.canUpload && <Button onClick={uploader.openPicker}>Choose files</Button>}
    </div>
  );
}

export interface ImageBrowserProps {
  slug: string;
  orgName: string;
  title: string;
  description: (info: { total: number | null; filtered: boolean }) => React.ReactNode;
  headerActions?: React.ReactNode;
  /** Replaces the default page header (e.g. a board's header). */
  header?: (info: { total: number | null; feed: Feed }) => React.ReactNode;
  feedEndpoint: string;
  defaultSort: FeedSort;
  capabilities: Capabilities;
  facets: FilterFacets;
  initial: { query: string; page: ImagePage };
  /** Extra filters that scope "select all" (e.g. `{ board: id }`). */
  scopeParams?: Record<string, string>;
  /** Uploading is only offered in the library. */
  upload?: { maxUploadMb: number };
  /** Manual ordering (boards). Active only in manual sort with no filters. */
  onReorder?: (ids: string[], target: ReorderTarget) => Promise<void>;
  empty?: React.ReactNode;
  selectionActions?: (ctx: SelectionContext) => React.ReactNode;
  lightboxActions?: (image: ImageListItem, feed: Feed) => React.ReactNode;
}

export function ImageBrowser(props: ImageBrowserProps) {
  const inner = <ImageBrowserInner {...props} />;
  return (
    <UploaderProvider
      slug={props.slug}
      orgName={props.orgName}
      maxUploadMb={props.upload?.maxUploadMb ?? 0}
      canUpload={!!props.upload && props.capabilities.canUpload}
      onImagesReady={() => window.dispatchEvent(new Event("photosheet:images-ready"))}
    >
      {inner}
    </UploaderProvider>
  );
}

function ImageBrowserInner({
  slug,
  title,
  description,
  headerActions,
  header,
  feedEndpoint,
  defaultSort,
  capabilities,
  facets,
  initial,
  upload,
  scopeParams,
  onReorder,
  empty,
  selectionActions,
  lightboxActions,
}: ImageBrowserProps) {
  const { filters, query, setFilters, openImage, setOpenImage } = useUrlFilters(defaultSort);
  const [prefs, setPrefs] = useViewPrefs();
  const feed = useImageFeed(feedEndpoint, query, initial);
  const ids = useMemo(() => feed.images.map((i) => i.id), [feed.images]);
  const { selected, select, setMany, clear } = useSelection(ids);
  const [selectingAll, setSelectingAll] = useState(false);
  const { reload } = feed;

  // Refresh when uploads finish processing.
  useEffect(() => {
    const handler = () => void reload();
    window.addEventListener("photosheet:images-ready", handler);
    return () => window.removeEventListener("photosheet:images-ready", handler);
  }, [reload]);

  const openIndex = openImage ? feed.images.findIndex((i) => i.id === openImage) : -1;
  const filtered = !!filters.q || activeFilterCount(filters) > 0;
  const canReorder =
    !!onReorder && capabilities.canEditBoards && filters.sort === "manual" && !filtered;

  const toggle = useCallback((id: string) => select(id, { toggle: true }), [select]);

  const reorder = useCallback(
    async (moveIds: string[], target: ReorderTarget) => {
      feed.moveLocal(moveIds, target);
      try {
        await onReorder?.(moveIds, target);
      } catch {
        toast.error("Couldn't save the new order");
        void feed.reload();
      }
    },
    [feed, onReorder],
  );

  async function selectAllMatching() {
    setSelectingAll(true);
    try {
      const params = new URLSearchParams(query);
      for (const [k, v] of Object.entries(scopeParams ?? {})) params.set(k, v);
      const res = await fetch(`/api/o/${slug}/images/ids?${params}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      setMany(body.ids);
      if (body.capped) toast.info(`Selected the first ${body.ids.length.toLocaleString()} images`);
    } catch {
      toast.error("Couldn't select all images");
    } finally {
      setSelectingAll(false);
    }
  }

  const selectedImages = feed.images.filter((i) => selected.has(i.id));
  const tagSuggestions = useMemo(() => facets.tags.map((t) => t.tag), [facets.tags]);

  return (
    <>
      {header ? (
        header({ total: feed.total, feed })
      ) : (
        <PageHeader
          title={title}
          description={description({ total: feed.total, filtered })}
          actions={
            <>
              {headerActions}
              {upload && <UploadButton />}
            </>
          }
        />
      )}
      <LibraryToolbar
        filters={filters}
        facets={facets}
        onChange={setFilters}
        prefs={prefs}
        onPrefs={setPrefs}
        includeManualSort={defaultSort === "manual"}
      />
      {onReorder && capabilities.canEditBoards && filters.sort === "manual" && filtered && (
        <p className="border-b bg-muted/50 px-6 py-1.5 text-xs text-muted-foreground">
          Clear search and filters to drag images into a new order.
        </p>
      )}

      {feed.error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 border-b bg-destructive/10 px-6 py-2 text-sm text-destructive"
        >
          {feed.error}
          <Button size="sm" variant="outline" onClick={() => feed.reload()}>
            Retry
          </Button>
        </div>
      )}

      {feed.images.length === 0 && !feed.loading ? (
        <EmptyState filtered={filtered} onClear={() => setFilters(CLEARED_FILTERS)} empty={empty} />
      ) : (
        <ContactSheet
          images={feed.images}
          selected={selected}
          onSelect={select}
          onOpen={(i) => setOpenImage(feed.images[i]?.id ?? null)}
          onSelectAll={() => setMany(ids)}
          onClearSelection={clear}
          tileSize={prefs.tileSize}
          background={prefs.background}
          hasMore={feed.hasMore}
          loading={feed.loading}
          onEndReached={feed.loadMore}
          label={`Images in ${title}`}
          onReorder={canReorder ? reorder : undefined}
        />
      )}

      <SelectionBar
        count={selected.size}
        total={feed.total}
        onSelectAll={selectAllMatching}
        selectingAll={selectingAll}
        onClear={clear}
      >
        {selectedImages.length === 1 && selected.size === 1 && (
          <ResizeButton
            slug={slug}
            image={selectedImages[0]}
            canDownload={capabilities.canDownload}
          />
        )}
        {capabilities.canEdit && (
          <BulkEditButton
            slug={slug}
            imageIds={[...selected]}
            tagSuggestions={tagSuggestions}
            onUpdated={(images) => {
              invalidateImageDetail([...selected]);
              if (images) feed.replaceImages(images);
              else void feed.reload();
            }}
          />
        )}
        {selectionActions?.({ ids: [...selected], images: selectedImages, clear, feed })}
      </SelectionBar>

      <Lightbox
        slug={slug}
        images={feed.images}
        index={openIndex === -1 ? null : openIndex}
        onIndexChange={(i) => setOpenImage(i === null ? null : (feed.images[i]?.id ?? null))}
        hasMore={feed.hasMore}
        loadMore={feed.loadMore}
        canDownload={capabilities.canDownload}
        selected={selected}
        onToggleSelect={toggle}
        actions={(img) => (
          <>
            <ResizeButton
              slug={slug}
              image={img}
              canDownload={capabilities.canDownload}
              variant="lightbox"
            />
            {lightboxActions?.(img, feed)}
          </>
        )}
        canEdit={capabilities.canEdit}
        tagSuggestions={tagSuggestions}
        onImageUpdated={(img) => feed.replaceImages([img])}
      />
    </>
  );
}
