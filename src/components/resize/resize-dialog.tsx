"use client";

import { Download, FileImage, Link2, Link2Off, Loader2, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { formatBytes } from "@/lib/format";
import type { ImageListItem } from "@/lib/images/dto";
import {
  canonicalParams,
  describeParams,
  FIT_LABELS,
  type Fit,
  FITS,
  FORMAT_INFO,
  FORMATS,
  type OutputFormat,
  outputSize,
  type RenderParams,
} from "@/lib/image/render-params";
import type { PresetDto } from "@/lib/presets";
import type { RenditionDto } from "@/lib/renditions";
import { cn } from "@/lib/utils";

type Choice = { kind: "original" } | { kind: "preset"; id: string } | { kind: "custom" };

interface CustomState {
  width: string;
  height: string;
  lock: boolean;
  fit: Fit;
  format: OutputFormat;
  quality: number;
  strip: boolean;
}

const presetsCache = new Map<string, PresetDto[]>();

function usePresets(slug: string, enabled: boolean) {
  const [presets, setPresets] = useState<PresetDto[] | null>(presetsCache.get(slug) ?? null);
  useEffect(() => {
    if (!enabled || presetsCache.has(slug)) return;
    fetch(`/api/o/${slug}/presets`)
      .then((r) => r.json())
      .then((b) => {
        presetsCache.set(slug, b.presets);
        setPresets(b.presets);
      })
      .catch(() => setPresets([]));
  }, [slug, enabled]);
  return presets;
}

/** Validated params for the current custom form, or an error message. */
function customParams(c: CustomState): RenderParams | string {
  const width = c.width ? Number(c.width) : null;
  const height = c.height ? Number(c.height) : null;
  try {
    return canonicalParams({
      width,
      height,
      fit: c.lock ? "contain" : c.fit,
      format: c.format,
      quality: c.quality,
      stripMetadata: c.strip,
    });
  } catch (err) {
    const issue = (err as { issues?: { message: string }[] }).issues?.[0]?.message;
    return issue ?? "Check the size";
  }
}

/** Request (and poll) the rendition for `params`. */
function useRendition(
  slug: string,
  imageId: string,
  request: { presetId: string } | { params: RenderParams } | null,
) {
  const [state, setState] = useState<{
    key: string;
    rendition: RenditionDto | null;
    error: string | null;
  }>({ key: "", rendition: null, error: null });
  const key = request ? JSON.stringify(request) : "";

  useEffect(() => {
    if (!request) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const debounce = "params" in request ? 350 : 0;

    const poll = async (id: string) => {
      const res = await fetch(`/api/o/${slug}/renditions/${id}`);
      const body = await res.json();
      if (cancelled) return;
      setState({ key, rendition: body.rendition, error: null });
      if (body.rendition?.status === "PENDING") timer = setTimeout(() => void poll(id), 600);
    };

    timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/o/${slug}/images/${imageId}/renditions`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: key,
        });
        const body = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(body.error ?? "Couldn't prepare this size");
        setState({ key, rendition: body.rendition, error: null });
        if (body.rendition.status === "PENDING")
          timer = setTimeout(() => void poll(body.rendition.id), 400);
      } catch (err) {
        if (!cancelled) setState({ key, rendition: null, error: (err as Error).message });
      }
    }, debounce);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` captures `request`
  }, [slug, imageId, key]);

  return state.key === key ? state : { key, rendition: null, error: null };
}

export function ResizeDialog({
  slug,
  image,
  open,
  onOpenChange,
  canDownload,
}: {
  slug: string;
  image: ImageListItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canDownload: boolean;
}) {
  const presets = usePresets(slug, open);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [custom, setCustom] = useState<CustomState>({
    width: String(Math.min(image.width ?? 2048, 2048)),
    height: "",
    lock: true,
    fit: "contain",
    format: "jpeg",
    quality: 85,
    strip: true,
  });
  const src = { width: image.width ?? 0, height: image.height ?? 0 };
  const effectiveChoice: Choice =
    choice ?? (presets?.[0] ? { kind: "preset", id: presets[0].id } : { kind: "original" });

  const customResult = customParams(custom);
  const params: RenderParams | null =
    effectiveChoice.kind === "custom"
      ? typeof customResult === "string"
        ? null
        : customResult
      : effectiveChoice.kind === "preset"
        ? (() => {
            const p = presets?.find((x) => x.id === effectiveChoice.id);
            return p ? canonicalParams(p) : null;
          })()
        : null;

  const request =
    !open || effectiveChoice.kind === "original"
      ? null
      : effectiveChoice.kind === "preset"
        ? { presetId: effectiveChoice.id }
        : params
          ? { params }
          : null;

  const { rendition, error } = useRendition(slug, image.id, request);
  const predicted = params && src.width ? outputSize(src, params) : src;
  const ready = rendition?.status === "READY";
  const failed = rendition?.status === "FAILED";

  function setCustomField<K extends keyof CustomState>(k: K, v: CustomState[K]) {
    setCustom((c) => {
      const next = { ...c, [k]: v };
      // Lock aspect ratio: derive the other side from the original.
      if (next.lock && src.width && src.height) {
        if (k === "width")
          next.height = v ? String(Math.round((Number(v) * src.height) / src.width)) : "";
        if (k === "height")
          next.width = v ? String(Math.round((Number(v) * src.width) / src.height)) : "";
      }
      return next;
    });
  }

  const downloadHref =
    effectiveChoice.kind === "original"
      ? `/api/o/${slug}/images/${image.id}/download`
      : ready
        ? `/api/o/${slug}/renditions/${rendition!.id}/download`
        : undefined;

  const previewSrc =
    effectiveChoice.kind === "original"
      ? (image.previewUrl ?? image.thumbUrl)
      : ready
        ? rendition!.url
        : (image.previewUrl ?? image.thumbUrl);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid max-h-[92svh] w-[calc(100vw-1.5rem)] gap-0 overflow-hidden p-0 sm:max-w-4xl md:grid-cols-[1fr_320px]">
        <div className="relative flex min-h-56 items-center justify-center bg-neutral-100 p-4 md:min-h-[480px] dark:bg-neutral-900">
          {previewSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewSrc}
              alt={`Preview of ${image.title || image.filename}`}
              className={cn(
                "max-h-[60svh] max-w-full object-contain shadow-sm transition-opacity",
                !ready && effectiveChoice.kind !== "original" && "opacity-40",
              )}
            />
          ) : (
            <FileImage className="size-10 text-muted-foreground" aria-hidden="true" />
          )}
          {effectiveChoice.kind !== "original" && !ready && !failed && !error && (
            <div className="absolute inset-0 flex items-center justify-center" role="status">
              <span className="flex items-center gap-2 rounded-full bg-background/90 px-3 py-1.5 text-sm shadow">
                <Loader2 className="size-4 animate-spin" /> Rendering preview…
              </span>
            </div>
          )}
          {(failed || error) && (
            <div
              className="absolute inset-x-4 bottom-4 flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              <TriangleAlert className="size-4 shrink-0" />
              {error ?? rendition?.error ?? "Couldn't render this size"}
            </div>
          )}
        </div>

        <div className="flex max-h-[92svh] flex-col overflow-y-auto border-t md:border-t-0 md:border-l">
          <DialogHeader className="border-b p-4">
            <DialogTitle>Resize & download</DialogTitle>
            <DialogDescription className="truncate">
              {image.title || image.filename}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 p-4">
            <RadioGroup
              aria-label="Size"
              value={effectiveChoice.kind === "preset" ? effectiveChoice.id : effectiveChoice.kind}
              onValueChange={(v) =>
                setChoice(
                  v === "original"
                    ? { kind: "original" }
                    : v === "custom"
                      ? { kind: "custom" }
                      : { kind: "preset", id: v },
                )
              }
              className="gap-1"
            >
              {presets === null && (
                <Loader2
                  className="size-4 animate-spin text-muted-foreground"
                  aria-label="Loading presets"
                />
              )}
              {presets?.map((p) => (
                <Label
                  key={p.id}
                  className="flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 font-normal has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent"
                >
                  <RadioGroupItem value={p.id} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{p.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {describeParams(canonicalParams(p), src.width ? src : undefined)}
                    </span>
                  </span>
                </Label>
              ))}
              <Label className="flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 font-normal has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent">
                <RadioGroupItem value="custom" />
                <span className="text-sm font-medium">Custom size</span>
              </Label>
              <Label className="flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 font-normal has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent">
                <RadioGroupItem value="original" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">Original file</span>
                  <span className="block text-xs text-muted-foreground">
                    Untouched · {src.width} × {src.height} · {formatBytes(image.bytes)}
                  </span>
                </span>
              </Label>
            </RadioGroup>

            {effectiveChoice.kind === "custom" && (
              <fieldset className="grid gap-3 rounded-md border p-3">
                <legend className="px-1 text-xs font-medium text-muted-foreground">Custom</legend>
                <div className="flex items-end gap-2">
                  <div className="grid flex-1 gap-1">
                    <Label htmlFor="rs-w" className="text-xs">
                      Width
                    </Label>
                    <Input
                      id="rs-w"
                      inputMode="numeric"
                      placeholder="auto"
                      value={custom.width}
                      onChange={(e) => setCustomField("width", e.target.value.replace(/\D/g, ""))}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-pressed={custom.lock}
                    aria-label={custom.lock ? "Unlock aspect ratio" : "Lock aspect ratio"}
                    onClick={() => setCustomField("lock", !custom.lock)}
                  >
                    {custom.lock ? <Link2 /> : <Link2Off />}
                  </Button>
                  <div className="grid flex-1 gap-1">
                    <Label htmlFor="rs-h" className="text-xs">
                      Height
                    </Label>
                    <Input
                      id="rs-h"
                      inputMode="numeric"
                      placeholder="auto"
                      value={custom.height}
                      onChange={(e) => setCustomField("height", e.target.value.replace(/\D/g, ""))}
                    />
                  </div>
                </div>
                {!custom.lock && (
                  <div className="grid gap-1">
                    <Label htmlFor="rs-fit" className="text-xs">
                      Fit
                    </Label>
                    <Select
                      value={custom.fit}
                      onValueChange={(v) => setCustomField("fit", v as Fit)}
                    >
                      <SelectTrigger id="rs-fit" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FITS.map((f) => (
                          <SelectItem key={f} value={f}>
                            {FIT_LABELS[f]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="grid gap-1">
                  <Label htmlFor="rs-format" className="text-xs">
                    Format
                  </Label>
                  <Select
                    value={custom.format}
                    onValueChange={(v) => setCustomField("format", v as OutputFormat)}
                  >
                    <SelectTrigger id="rs-format" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FORMATS.map((f) => (
                        <SelectItem key={f} value={f}>
                          {FORMAT_INFO[f].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {FORMAT_INFO[custom.format].lossy && (
                  <div className="grid gap-2">
                    <div className="flex justify-between text-xs">
                      <Label id="rs-q-label">Quality</Label>
                      <span className="tabular-nums">{custom.quality}</span>
                    </div>
                    <Slider
                      aria-labelledby="rs-q-label"
                      min={30}
                      max={100}
                      step={1}
                      value={[custom.quality]}
                      onValueChange={([v]) => setCustomField("quality", v)}
                    />
                  </div>
                )}
                <label className="flex items-center justify-between gap-2 text-sm">
                  Strip EXIF & GPS
                  <Switch
                    checked={custom.strip}
                    onCheckedChange={(v) => setCustomField("strip", v)}
                  />
                </label>
                {typeof customResult === "string" && (
                  <p className="text-xs text-destructive">{customResult}</p>
                )}
              </fieldset>
            )}
          </div>

          <div className="mt-auto grid gap-3 border-t p-4">
            <dl className="grid grid-cols-2 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Output</dt>
              <dd className="text-right tabular-nums">
                {ready
                  ? `${rendition!.width} × ${rendition!.height}`
                  : `${predicted.width} × ${predicted.height}`}{" "}
                px
              </dd>
              <dt className="text-muted-foreground">File size</dt>
              <dd className="text-right tabular-nums" aria-live="polite">
                {effectiveChoice.kind === "original"
                  ? formatBytes(image.bytes)
                  : ready
                    ? formatBytes(rendition!.bytes)
                    : failed || error
                      ? "—"
                      : "Calculating…"}
              </dd>
              {params && (
                <>
                  <dt className="text-muted-foreground">Format</dt>
                  <dd className="text-right">
                    {FORMAT_INFO[params.format].label}
                    {params.stripMetadata ? " · no EXIF" : " · keeps EXIF"}
                  </dd>
                </>
              )}
            </dl>
            {canDownload && (
              <Button asChild={!!downloadHref} disabled={!downloadHref}>
                {downloadHref ? (
                  <a href={downloadHref}>
                    <Download /> Download
                  </a>
                ) : (
                  <span>
                    <Loader2 className="animate-spin" /> Preparing…
                  </span>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
