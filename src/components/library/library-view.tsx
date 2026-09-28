"use client";

import { ImageIcon, SearchX, Upload } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  activeFilterCount,
  filtersToSearchParams,
  type ImageFilters,
  parseFilters,
} from "@/lib/images/filters";
import type { ImageListItem } from "@/lib/images/dto";
import type { ImagePage } from "@/lib/images/list";
import { ContactSheet } from "./contact-sheet";
import { useImageFeed, useSelection, useViewPrefs } from "./hooks";
import { Lightbox } from "./lightbox";
import { type FilterFacets, LibraryToolbar } from "./library-toolbar";
import { SelectionBar } from "./selection-bar";
import { UploadButton, UploaderProvider, useUploader } from "./uploader";

export interface LibraryCapabilities {
  canUpload: boolean;
  canDownload: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canShare: boolean;
}

/** Filters live in the URL; update it without a server round-trip. */
function useUrlFilters() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filters = useMemo(() => {
    try {
      return parseFilters(searchParams);
    } catch {
      return parseFilters({});
    }
  }, [searchParams]);
  const query = useMemo(() => filtersToSearchParams(filters).toString(), [filters]);

  const setFilters = useCallback(
    (patch: Partial<ImageFilters>) => {
      const next = filtersToSearchParams({ ...filters, ...patch });
      const image = searchParams.get("image");
      if (image) next.set("image", image);
      const qs = next.toString();
      window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
    },
    [filters, pathname, searchParams],
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

function EmptyLibrary({ filtered, onClear }: { filtered: boolean; onClear: () => void }) {
  const { openPicker, canUpload } = useUploader();
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
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-12 text-center">
      <div className="rounded-full bg-muted p-4">
        {canUpload ? (
          <Upload className="size-6 text-muted-foreground" aria-hidden="true" />
        ) : (
          <ImageIcon className="size-6 text-muted-foreground" aria-hidden="true" />
        )}
      </div>
      <div>
        <p className="font-medium">No images yet</p>
        <p className="text-sm text-muted-foreground">
          {canUpload
            ? "Drag photos anywhere on this page, or choose files."
            : "Nothing has been uploaded yet."}
        </p>
      </div>
      {canUpload && <Button onClick={openPicker}>Choose files</Button>}
    </div>
  );
}

export interface SelectionContext {
  ids: string[];
  images: ImageListItem[];
  clear: () => void;
  feed: ReturnType<typeof useImageFeed>;
}

export function LibraryView({
  slug,
  orgName,
  maxUploadMb,
  capabilities,
  facets,
  initial,
  selectionActions,
  lightboxActions,
}: {
  slug: string;
  orgName: string;
  maxUploadMb: number;
  capabilities: LibraryCapabilities;
  facets: FilterFacets;
  initial: { query: string; page: ImagePage };
  selectionActions?: (ctx: SelectionContext) => React.ReactNode;
  lightboxActions?: (
    image: ImageListItem,
    feed: ReturnType<typeof useImageFeed>,
  ) => React.ReactNode;
}) {
  const { filters, query, setFilters, openImage, setOpenImage } = useUrlFilters();
  const [prefs, setPrefs] = useViewPrefs();
  const feed = useImageFeed(`/api/o/${slug}/images`, query, initial);
  const ids = useMemo(() => feed.images.map((i) => i.id), [feed.images]);
  const { selected, select, setMany, clear } = useSelection(ids);
  const [selectingAll, setSelectingAll] = useState(false);

  const openIndex = openImage ? feed.images.findIndex((i) => i.id === openImage) : -1;
  const filtered = !!filters.q || activeFilterCount(filters) > 0;

  const toggle = useCallback((id: string) => select(id, { toggle: true }), [select]);

  async function selectAllMatching() {
    setSelectingAll(true);
    try {
      const res = await fetch(`/api/o/${slug}/images/ids?${query}`);
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

  return (
    <UploaderProvider
      slug={slug}
      orgName={orgName}
      maxUploadMb={maxUploadMb}
      canUpload={capabilities.canUpload}
      onImagesReady={() => feed.reload()}
    >
      <PageHeader
        title="Library"
        description={
          feed.total === null
            ? `All images in ${orgName}.`
            : `${feed.total.toLocaleString()} ${feed.total === 1 ? "image" : "images"}${filtered ? " match" : ` in ${orgName}`}`
        }
        actions={<UploadButton />}
      />
      <LibraryToolbar
        filters={filters}
        facets={facets}
        onChange={setFilters}
        prefs={prefs}
        onPrefs={setPrefs}
      />

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
        <EmptyLibrary
          filtered={filtered}
          onClear={() =>
            setFilters({
              q: "",
              tags: [],
              uploader: undefined,
              from: undefined,
              to: undefined,
              orientation: undefined,
              licence: undefined,
              board: undefined,
            })
          }
        />
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
          label={`Images in ${orgName}`}
        />
      )}

      <SelectionBar
        count={selected.size}
        total={feed.total}
        onSelectAll={selectAllMatching}
        selectingAll={selectingAll}
        onClear={clear}
      >
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
        actions={lightboxActions ? (img) => lightboxActions(img, feed) : undefined}
      />
    </UploaderProvider>
  );
}
