"use client";

import { ImageOff, Loader2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { UploadButton, UploaderProvider, useUploader } from "@/components/library/uploader";
import { Button } from "@/components/ui/button";

export interface LibraryImage {
  id: string;
  filename: string;
  title: string | null;
  status: "UPLOADING" | "PROCESSING" | "READY" | "FAILED";
  thumbUrl: string | null;
}

function EmptyState() {
  const { openPicker, canUpload } = useUploader();
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-12 text-center">
      <div className="rounded-full bg-muted p-4">
        <Upload className="size-6 text-muted-foreground" aria-hidden="true" />
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

export function LibraryClient({
  slug,
  orgName,
  maxUploadMb,
  canUpload,
  images,
}: {
  slug: string;
  orgName: string;
  maxUploadMb: number;
  canUpload: boolean;
  images: LibraryImage[];
}) {
  const router = useRouter();
  return (
    <UploaderProvider
      slug={slug}
      orgName={orgName}
      maxUploadMb={maxUploadMb}
      canUpload={canUpload}
      onImagesReady={() => router.refresh()}
    >
      <PageHeader
        title="Library"
        description={`All images in ${orgName}.`}
        actions={<UploadButton />}
      />
      {images.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 p-4 sm:p-6">
          {images.map((img) => (
            <li key={img.id} className="overflow-hidden rounded-lg border bg-muted/40">
              <div className="flex aspect-square items-center justify-center">
                {img.thumbUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={img.thumbUrl}
                    alt={img.title || img.filename}
                    loading="lazy"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : img.status === "FAILED" ? (
                  <ImageOff className="size-6 text-destructive" aria-label="Processing failed" />
                ) : (
                  <Loader2
                    className="size-6 animate-spin text-muted-foreground"
                    aria-label="Processing"
                  />
                )}
              </div>
              <p className="truncate border-t px-2 py-1.5 text-xs">{img.title || img.filename}</p>
            </li>
          ))}
        </ul>
      )}
    </UploaderProvider>
  );
}
