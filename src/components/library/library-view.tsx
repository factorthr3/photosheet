"use client";

import type { ImagePage } from "@/lib/images/list";
import { AddToBoardButton } from "@/components/boards/add-to-board";
import { type Capabilities, ImageBrowser } from "./image-browser";
import type { FilterFacets } from "./library-toolbar";

export function LibraryView({
  slug,
  orgName,
  maxUploadMb,
  capabilities,
  facets,
  initial,
}: {
  slug: string;
  orgName: string;
  maxUploadMb: number;
  capabilities: Capabilities;
  facets: FilterFacets;
  initial: { query: string; page: ImagePage };
}) {
  return (
    <ImageBrowser
      slug={slug}
      orgName={orgName}
      title="Library"
      description={({ total, filtered }) =>
        total === null
          ? `All images in ${orgName}.`
          : `${total.toLocaleString()} ${total === 1 ? "image" : "images"}${filtered ? " match" : ` in ${orgName}`}`
      }
      feedEndpoint={`/api/o/${slug}/images`}
      defaultSort="uploaded_desc"
      capabilities={capabilities}
      facets={facets}
      initial={initial}
      upload={{ maxUploadMb }}
      selectionActions={({ ids, clear }) =>
        capabilities.canEditBoards && <AddToBoardButton slug={slug} imageIds={ids} onDone={clear} />
      }
      lightboxActions={(image) =>
        capabilities.canEditBoards && (
          <AddToBoardButton slug={slug} imageIds={[image.id]} variant="lightbox" />
        )
      }
    />
  );
}
