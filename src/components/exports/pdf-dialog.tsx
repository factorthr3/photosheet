"use client";

import { CheckCircle2, Download, FileText, Loader2, TriangleAlert } from "lucide-react";
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
import { Input } from "@/components/ui/input";
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
import { computeGrid, type PdfOptions } from "@/lib/pdf/layout";

const MAX = 1000;

/** Printable contact sheet (A4/Letter grid of thumbnails with captions). */
export function PdfButton({
  slug,
  source,
  count,
  defaultTitle,
  size = "sm",
}: {
  slug: string;
  source: ExportSource;
  count: number;
  defaultTitle: string;
  size?: "sm" | "default";
}) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<PdfOptions>({
    paper: "A4",
    orientation: "portrait",
    columns: 4,
    caption: "filename",
  });
  const [title, setTitle] = useState(defaultTitle);
  const [exp, setExp] = useState<ExportDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const set = <K extends keyof PdfOptions>(k: K, v: PdfOptions[K]) =>
    setOptions((o) => ({ ...o, [k]: v }));

  useEffect(() => {
    if (!exp || exp.status === "READY" || exp.status === "FAILED") return;
    const t = setTimeout(async () => {
      const res = await fetch(`/api/o/${slug}/exports/${exp.id}`);
      if (!res.ok) return;
      const body = await res.json();
      setExp(body.export);
      if (body.export.status === "READY")
        triggerDownload(`/api/o/${slug}/exports/${exp.id}/download`);
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
        body: JSON.stringify({ kind: "pdf", source, options, title }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't start the PDF");
      setExp(body.export);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setStarting(false);
    }
  }

  const n = Math.min(count, MAX);
  const grid = computeGrid(options);
  const pages = Math.max(1, Math.ceil(n / grid.perPage));

  return (
    <>
      <Button variant="outline" size={size} onClick={() => setOpen(true)}>
        <FileText /> Contact sheet PDF
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
            <DialogTitle>Export contact sheet</DialogTitle>
            <DialogDescription>
              A printable PDF of {n.toLocaleString()} {n === 1 ? "thumbnail" : "thumbnails"}
              {count > MAX && ` (the first ${MAX.toLocaleString()})`} with captions.
            </DialogDescription>
          </DialogHeader>

          {!exp ? (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="pdf-title">Title</Label>
                <Input
                  id="pdf-title"
                  maxLength={120}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="pdf-paper">Paper</Label>
                  <Select
                    value={options.paper}
                    onValueChange={(v) => set("paper", v as PdfOptions["paper"])}
                  >
                    <SelectTrigger id="pdf-paper" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A4">A4</SelectItem>
                      <SelectItem value="Letter">US Letter</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pdf-orientation">Orientation</Label>
                  <Select
                    value={options.orientation}
                    onValueChange={(v) => set("orientation", v as PdfOptions["orientation"])}
                  >
                    <SelectTrigger id="pdf-orientation" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="portrait">Portrait</SelectItem>
                      <SelectItem value="landscape">Landscape</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pdf-columns">Columns</Label>
                  <Select
                    value={String(options.columns)}
                    onValueChange={(v) => set("columns", Number(v))}
                  >
                    <SelectTrigger id="pdf-columns" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[2, 3, 4, 5, 6, 8].map((c) => (
                        <SelectItem key={c} value={String(c)}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pdf-caption">Captions</Label>
                  <Select
                    value={options.caption}
                    onValueChange={(v) => set("caption", v as PdfOptions["caption"])}
                  >
                    <SelectTrigger id="pdf-caption" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="filename">Filename</SelectItem>
                      <SelectItem value="title">Title</SelectItem>
                      <SelectItem value="none">None</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {grid.perPage} per page · about {pages} {pages === 1 ? "page" : "pages"}
              </p>
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
                  <TriangleAlert className="size-4" /> {exp.error ?? "The PDF couldn't be created"}
                </p>
              ) : exp.status === "READY" ? (
                <p className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="size-4 text-emerald-600" /> Ready ·{" "}
                  {formatBytes(exp.bytes)}
                </p>
              ) : (
                <>
                  <p className="flex items-center gap-2 text-sm">
                    <Loader2 className="size-4 animate-spin" />{" "}
                    {exp.status === "PENDING"
                      ? "Waiting to start…"
                      : `Laying out pages… ${exp.progress}%`}
                  </p>
                  <Progress value={exp.progress} aria-label="PDF progress" />
                </>
              )}
            </div>
          )}

          <DialogFooter>
            {!exp ? (
              <Button onClick={start} disabled={starting}>
                {starting ? <Loader2 className="animate-spin" /> : <FileText />} Create PDF
              </Button>
            ) : exp.status === "READY" ? (
              <Button asChild>
                <a href={`/api/o/${slug}/exports/${exp.id}/download`}>
                  <Download /> Download PDF
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
