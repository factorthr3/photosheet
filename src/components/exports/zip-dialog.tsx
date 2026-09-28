"use client";

import { CheckCircle2, Download, FileArchive, Loader2, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { triggerDownload } from "@/lib/download";
import type { ExportDto, ExportSource } from "@/lib/exports";
import { formatBytes } from "@/lib/format";
import { canonicalParams, describeParams } from "@/lib/image/render-params";
import type { PresetDto } from "@/lib/presets";

const MAX = 2000;

/** Create a ZIP of images (originals or one preset), show progress, then download it. */
export function ZipButton({
  slug,
  source,
  count,
  label = "Download ZIP",
  size = "sm",
}: {
  slug: string;
  source: ExportSource;
  count: number;
  label?: string;
  size?: "sm" | "default";
}) {
  const [open, setOpen] = useState(false);
  const [presets, setPresets] = useState<PresetDto[] | null>(null);
  const [variant, setVariant] = useState("original");
  const [exp, setExp] = useState<ExportDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!open || presets) return;
    fetch(`/api/o/${slug}/presets`)
      .then((r) => r.json())
      .then((b) => setPresets(b.presets))
      .catch(() => setPresets([]));
  }, [open, presets, slug]);

  // Poll progress while the worker builds the ZIP.
  useEffect(() => {
    if (!exp || exp.status === "READY" || exp.status === "FAILED") return;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/o/${slug}/exports/${exp.id}`);
        const body = await res.json();
        if (res.ok) {
          setExp(body.export);
          if (body.export.status === "READY") {
            triggerDownload(`/api/o/${slug}/exports/${exp.id}/download`);
          }
        }
      } catch {
        // keep polling
      }
    }, 1000);
    return () => clearTimeout(t);
  }, [exp, slug]);

  async function start() {
    setStarting(true);
    setError(null);
    try {
      const res = await fetch(`/api/o/${slug}/exports`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "zip",
          source,
          variant:
            variant === "original" ? { type: "original" } : { type: "preset", presetId: variant },
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't start the download");
      setExp(body.export);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setStarting(false);
    }
  }

  const tooMany = count > MAX;
  const n = Math.min(count, MAX);

  return (
    <>
      <Button variant="outline" size={size} onClick={() => setOpen(true)}>
        <FileArchive />
        {label}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) {
            setExp(null);
            setError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Download as ZIP</DialogTitle>
            <DialogDescription>
              {n.toLocaleString()} {n === 1 ? "image" : "images"}
              {tooMany && ` (the first ${MAX.toLocaleString()} of ${count.toLocaleString()})`}.
              Large downloads are prepared in the background.
            </DialogDescription>
          </DialogHeader>

          {!exp ? (
            <div className="grid gap-2">
              <Label htmlFor="zip-variant">Size</Label>
              <Select value={variant} onValueChange={setVariant}>
                <SelectTrigger id="zip-variant" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="original">Original files (untouched)</SelectItem>
                  {presets?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} — {describeParams(canonicalParams(p))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {error && (
                <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
                  <TriangleAlert className="size-4" /> {error}
                </p>
              )}
            </div>
          ) : (
            <div className="grid gap-3" role="status" aria-live="polite">
              {exp.status === "FAILED" ? (
                <p className="flex items-center gap-2 text-sm text-destructive">
                  <TriangleAlert className="size-4" /> {exp.error ?? "The ZIP couldn't be created"}
                </p>
              ) : exp.status === "READY" ? (
                <p className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="size-4 text-emerald-600" /> Ready ·{" "}
                  {formatBytes(exp.bytes)} — your download should start automatically.
                </p>
              ) : (
                <>
                  <p className="flex items-center gap-2 text-sm">
                    <Loader2 className="size-4 animate-spin" />
                    {exp.status === "PENDING"
                      ? "Waiting to start…"
                      : `Adding images… ${exp.progress}%`}
                  </p>
                  <Progress value={exp.progress} aria-label="ZIP progress" />
                </>
              )}
            </div>
          )}

          <DialogFooter>
            {!exp ? (
              <Button onClick={start} disabled={starting}>
                {starting ? <Loader2 className="animate-spin" /> : <FileArchive />}
                Create ZIP
              </Button>
            ) : exp.status === "READY" ? (
              <Button asChild>
                <a href={`/api/o/${slug}/exports/${exp.id}/download`}>
                  <Download /> Download {exp.filename}
                </a>
              </Button>
            ) : (
              <Button variant="outline" onClick={() => setOpen(false)}>
                {exp.status === "FAILED" ? "Close" : "Hide"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
