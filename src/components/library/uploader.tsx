"use client";

import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Copy,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatBytes } from "@/lib/format";
import { claimedMimeType, UPLOAD_ACCEPT } from "@/lib/image/types";
import { cn } from "@/lib/utils";

type ItemStatus = "queued" | "hashing" | "uploading" | "processing" | "done" | "failed" | "skipped";

interface UploadItem {
  clientId: string;
  name: string;
  size: number;
  status: ItemStatus;
  progress: number;
  message?: string;
  sha256?: string;
  imageId?: string;
}

interface DuplicatePrompt {
  items: { clientId: string; name: string; existing: string }[];
  resolve: (uploadAnyway: boolean) => void;
}

const UPLOAD_CONCURRENCY = 3;

async function hashFile(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function postToBucket(
  url: string,
  fields: Record<string, string>,
  file: File,
  onProgress: (fraction: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.append(k, v);
    form.append("file", file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(
            new Error(
              xhr.status === 400
                ? "Rejected by storage (too large or wrong type)"
                : `Upload failed (${xhr.status})`,
            ),
          );
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(form);
  });
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body as T;
}

interface UploaderContextValue {
  addFiles: (files: FileList | File[]) => void;
  openPicker: () => void;
  canUpload: boolean;
}

const UploaderContext = createContext<UploaderContextValue | null>(null);

export function useUploader() {
  const ctx = useContext(UploaderContext);
  if (!ctx) throw new Error("useUploader must be used inside <UploaderProvider>");
  return ctx;
}

/**
 * Drag-and-drop (anywhere on the page) or picker uploads straight to the bucket with progress,
 * duplicate warnings and processing status. Calls `onImagesReady` as images finish processing.
 */
export function UploaderProvider({
  slug,
  orgName,
  maxUploadMb,
  canUpload,
  onImagesReady,
  children,
}: {
  slug: string;
  orgName: string;
  maxUploadMb: number;
  canUpload: boolean;
  onImagesReady?: (imageIds: string[]) => void;
  children: React.ReactNode;
}) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [duplicatePrompt, setDuplicatePrompt] = useState<DuplicatePrompt | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const files = useRef(new Map<string, File>());
  const onReadyRef = useRef(onImagesReady);
  onReadyRef.current = onImagesReady;

  const update = useCallback((clientId: string, patch: Partial<UploadItem>) => {
    setItems((prev) => prev.map((i) => (i.clientId === clientId ? { ...i, ...patch } : i)));
  }, []);

  const base = `/api/o/${slug}`;
  const maxBytes = maxUploadMb * 1024 * 1024;

  const runBatch = useCallback(
    async (batch: UploadItem[]) => {
      // 1. Hash (for duplicate detection), de-duplicating within the batch.
      const seen = new Map<string, string>();
      const toCheck: UploadItem[] = [];
      for (const item of batch) {
        update(item.clientId, { status: "hashing" });
        try {
          const sha256 = await hashFile(files.current.get(item.clientId)!);
          item.sha256 = sha256;
          if (seen.has(sha256)) {
            update(item.clientId, {
              status: "skipped",
              message: `Same file as ${seen.get(sha256)}`,
            });
            continue;
          }
          seen.set(sha256, item.name);
          update(item.clientId, { status: "queued", sha256 });
          toCheck.push(item);
        } catch {
          update(item.clientId, { status: "failed", message: "Couldn't read file" });
        }
      }
      if (toCheck.length === 0) return;

      // 2. Warn about files already in the library.
      let toUpload = toCheck;
      try {
        const { duplicates } = await api<{
          duplicates: Record<string, { imageId: string; filename: string }>;
        }>(`${base}/uploads/check`, {
          method: "POST",
          body: JSON.stringify({ hashes: toCheck.map((i) => i.sha256) }),
        });
        const dupes = toCheck.filter((i) => duplicates[i.sha256!]);
        if (dupes.length) {
          const uploadAnyway = await new Promise<boolean>((resolve) =>
            setDuplicatePrompt({
              items: dupes.map((i) => ({
                clientId: i.clientId,
                name: i.name,
                existing: duplicates[i.sha256!].filename,
              })),
              resolve,
            }),
          );
          setDuplicatePrompt(null);
          if (!uploadAnyway) {
            for (const d of dupes)
              update(d.clientId, { status: "skipped", message: "Already in library" });
            toUpload = toCheck.filter((i) => !duplicates[i.sha256!]);
          }
        }
      } catch {
        // Duplicate check is advisory; carry on if it fails.
      }
      if (toUpload.length === 0) return;

      // 3. Reserve rows + presigned policies (in chunks of 50).
      const reserved = new Map<
        string,
        { imageId: string; url: string; fields: Record<string, string> }
      >();
      for (let i = 0; i < toUpload.length; i += 50) {
        const chunk = toUpload.slice(i, i + 50);
        try {
          const res = await api<{
            uploads: {
              clientId: string;
              imageId: string;
              url: string;
              fields: Record<string, string>;
            }[];
            rejected: { clientId: string; reason: string }[];
          }>(`${base}/uploads`, {
            method: "POST",
            body: JSON.stringify({
              files: chunk.map((c) => {
                const f = files.current.get(c.clientId)!;
                return {
                  clientId: c.clientId,
                  filename: f.name,
                  size: f.size,
                  type: f.type,
                  sha256: c.sha256,
                };
              }),
            }),
          });
          for (const u of res.uploads) reserved.set(u.clientId, u);
          for (const r of res.rejected) update(r.clientId, { status: "failed", message: r.reason });
        } catch (err) {
          for (const c of chunk)
            update(c.clientId, { status: "failed", message: (err as Error).message });
        }
      }

      // 4. Upload with limited concurrency, then confirm each.
      const queue = toUpload.filter((i) => reserved.has(i.clientId));
      const worker = async () => {
        for (let item = queue.shift(); item; item = queue.shift()) {
          const r = reserved.get(item.clientId)!;
          const file = files.current.get(item.clientId)!;
          update(item.clientId, { status: "uploading", progress: 0, imageId: r.imageId });
          try {
            await postToBucket(r.url, r.fields, file, (p) =>
              update(item!.clientId, { progress: Math.round(p * 100) }),
            );
            await api(`${base}/uploads/${r.imageId}/complete`, { method: "POST", body: "{}" });
            update(item.clientId, { status: "processing", progress: 100 });
          } catch (err) {
            update(item.clientId, { status: "failed", message: (err as Error).message });
          } finally {
            files.current.delete(item.clientId);
          }
        }
      };
      await Promise.all(Array.from({ length: UPLOAD_CONCURRENCY }, worker));
    },
    [base, update],
  );

  const addFiles = useCallback(
    (list: FileList | File[]) => {
      if (!canUpload) return;
      const incoming: UploadItem[] = [];
      for (const file of Array.from(list)) {
        const clientId = crypto.randomUUID();
        const item: UploadItem = {
          clientId,
          name: file.name,
          size: file.size,
          status: "queued",
          progress: 0,
        };
        if (!claimedMimeType(file.name, file.type)) {
          item.status = "failed";
          item.message = "Unsupported file type";
        } else if (file.size > maxBytes) {
          item.status = "failed";
          item.message = `Larger than ${maxUploadMb} MB`;
        } else {
          files.current.set(clientId, file);
        }
        incoming.push(item);
      }
      if (!incoming.length) return;
      setItems((prev) => [...prev, ...incoming]);
      setCollapsed(false);
      void runBatch(incoming.filter((i) => i.status === "queued"));
    },
    [canUpload, maxBytes, maxUploadMb, runBatch],
  );

  // Poll processing status until each image is ready or failed.
  // A string key so progress updates on other items don't restart the poll timer.
  const [pollTick, setPollTick] = useState(0);
  const processingKey = items
    .filter((i) => i.status === "processing" && i.imageId)
    .map((i) => i.imageId!)
    .join(",");
  useEffect(() => {
    if (!processingKey) return;
    const timer = setTimeout(async () => {
      try {
        const { images } = await api<{
          images: { id: string; status: string; error: string | null }[];
        }>(`${base}/images/status?ids=${processingKey}`);
        const byId = new Map(images.map((img) => [img.id, img]));
        setItems((prev) =>
          prev.map((i) => {
            const s = i.imageId ? byId.get(i.imageId) : undefined;
            if (!s || i.status !== "processing") return i;
            if (s.status === "READY") return { ...i, status: "done" };
            if (s.status === "FAILED") {
              return { ...i, status: "failed", message: s.error ?? "Processing failed" };
            }
            return i;
          }),
        );
        const ready = images.filter((img) => img.status === "READY").map((img) => img.id);
        if (ready.length) onReadyRef.current?.(ready);
      } catch {
        // try again next tick
      }
      setPollTick((t) => t + 1);
    }, 1500);
    return () => clearTimeout(timer);
  }, [processingKey, pollTick, base]);

  // Page-wide drag and drop.
  useEffect(() => {
    if (!canUpload) return;
    let depth = 0;
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth++;
      setDragging(true);
    };
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const onOver = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      if (e.dataTransfer?.files.length) addFiles(e.dataTransfer.files);
    };
    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("dragover", onOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("drop", onDrop);
    };
  }, [addFiles, canUpload]);

  const active = items.filter((i) =>
    ["queued", "hashing", "uploading", "processing"].includes(i.status),
  );
  const done = items.filter((i) => i.status === "done").length;
  const failed = items.filter((i) => i.status === "failed").length;
  const ctx = useMemo(
    () => ({ addFiles, openPicker: () => inputRef.current?.click(), canUpload }),
    [addFiles, canUpload],
  );

  return (
    <UploaderContext.Provider value={ctx}>
      {children}

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={UPLOAD_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        data-testid="upload-input"
        onChange={(e) => {
          if (e.target.files) addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-primary px-16 py-12 text-center">
            <Upload className="size-10" aria-hidden="true" />
            <p className="text-lg font-semibold">Drop images to upload</p>
            <p className="text-sm text-muted-foreground">
              to {orgName} · JPEG, PNG, WebP, HEIC, TIFF up to {maxUploadMb} MB
            </p>
          </div>
        </div>
      )}

      {items.length > 0 && (
        <section
          aria-label="Uploads"
          className="fixed right-4 bottom-4 z-40 w-[calc(100vw-2rem)] max-w-sm overflow-hidden rounded-xl border bg-popover shadow-lg"
        >
          <header className="flex items-center gap-2 border-b px-4 py-3">
            <p className="flex-1 text-sm font-medium" aria-live="polite">
              {active.length > 0
                ? `Uploading ${items.length - active.length} of ${items.length}…`
                : `${done} uploaded${failed ? `, ${failed} failed` : ""}`}
            </p>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={collapsed ? "Expand uploads" : "Collapse uploads"}
              onClick={() => setCollapsed((c) => !c)}
            >
              {collapsed ? <ChevronUp /> : <ChevronDown />}
            </Button>
            {active.length === 0 && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Close uploads"
                onClick={() => setItems([])}
              >
                <X />
              </Button>
            )}
          </header>
          {!collapsed && (
            <ul className="max-h-80 divide-y overflow-y-auto">
              {items.map((item) => (
                <li key={item.clientId} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{item.name}</p>
                    {item.status === "uploading" ? (
                      <Progress
                        value={item.progress}
                        className="mt-1.5 h-1.5"
                        aria-label={`Uploading ${item.name}`}
                      />
                    ) : (
                      <p
                        className={cn(
                          "text-xs text-muted-foreground",
                          item.status === "failed" && "text-destructive",
                        )}
                      >
                        {item.status === "hashing" && "Preparing…"}
                        {item.status === "queued" && "Waiting…"}
                        {item.status === "processing" && "Making thumbnails…"}
                        {item.status === "done" && formatBytes(item.size)}
                        {(item.status === "failed" || item.status === "skipped") && item.message}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0" aria-hidden="true">
                    {item.status === "done" && <CheckCircle2 className="size-4 text-emerald-600" />}
                    {item.status === "failed" && (
                      <CircleAlert className="size-4 text-destructive" />
                    )}
                    {item.status === "skipped" && <Copy className="size-4 text-muted-foreground" />}
                    {["hashing", "processing", "queued"].includes(item.status) && (
                      <Loader2 className="size-4 animate-spin text-muted-foreground" />
                    )}
                    {item.status === "uploading" && (
                      <span className="text-xs tabular-nums">{item.progress}%</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <AlertDialog open={!!duplicatePrompt}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {duplicatePrompt?.items.length === 1
                ? "This image is already in the library"
                : `${duplicatePrompt?.items.length} images are already in the library`}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>Identical files (same content) already exist:</p>
                <ul className="mt-2 max-h-40 list-disc overflow-y-auto pl-5 text-sm">
                  {duplicatePrompt?.items.map((d) => (
                    <li key={d.clientId}>
                      <span className="text-foreground">{d.name}</span>
                      {d.name !== d.existing && <> matches “{d.existing}”</>}
                    </li>
                  ))}
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => duplicatePrompt?.resolve(false)}>
              Skip duplicates
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => duplicatePrompt?.resolve(true)}>
              Upload anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </UploaderContext.Provider>
  );
}

export function UploadButton() {
  const { openPicker, canUpload } = useUploader();
  if (!canUpload) return null;
  return (
    <Button onClick={openPicker}>
      <Upload />
      Upload
    </Button>
  );
}
