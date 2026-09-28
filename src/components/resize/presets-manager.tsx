"use client";

import { Loader2, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { FormError } from "@/components/auth/form-error";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  canonicalParams,
  describeParams,
  FIT_LABELS,
  type Fit,
  FITS,
  FORMAT_INFO,
  FORMATS,
  type OutputFormat,
} from "@/lib/image/render-params";
import type { PresetDto } from "@/lib/presets";

type Draft = {
  name: string;
  width: string;
  height: string;
  fit: Fit;
  format: OutputFormat;
  quality: string;
  stripMetadata: boolean;
};

const toDraft = (p?: PresetDto): Draft => ({
  name: p?.name ?? "",
  width: p?.width ? String(p.width) : "",
  height: p?.height ? String(p.height) : "",
  fit: p?.fit ?? "contain",
  format: p?.format ?? "jpeg",
  quality: String(p?.quality ?? 85),
  stripMetadata: p?.stripMetadata ?? true,
});

async function api<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "content-type": "application/json" } });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Request failed");
  return body;
}

function PresetDialog({
  slug,
  preset,
  open,
  onOpenChange,
  onSaved,
}: {
  slug: string;
  preset?: PresetDto;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const [d, setD] = useState<Draft>(toDraft(preset));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const body = {
      name: d.name,
      width: d.width ? Number(d.width) : null,
      height: d.height ? Number(d.height) : null,
      fit: d.fit,
      format: d.format,
      quality: Number(d.quality),
      stripMetadata: d.stripMetadata,
    };
    try {
      await api(preset ? `/api/o/${slug}/presets/${preset.id}` : `/api/o/${slug}/presets`, {
        method: preset ? "PATCH" : "POST",
        body: JSON.stringify(body),
      });
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (o) {
          setD(toDraft(preset));
          setError(null);
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <form onSubmit={save} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{preset ? "Edit preset" : "New preset"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="p-name">Name</Label>
            <Input
              id="p-name"
              required
              maxLength={60}
              value={d.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Newsletter header"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="p-w">Max width (px)</Label>
              <Input
                id="p-w"
                inputMode="numeric"
                placeholder="original"
                value={d.width}
                onChange={(e) => set("width", e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="p-h">Max height (px)</Label>
              <Input
                id="p-h"
                inputMode="numeric"
                placeholder="original"
                value={d.height}
                onChange={(e) => set("height", e.target.value.replace(/\D/g, ""))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="p-fit">Fit</Label>
              <Select value={d.fit} onValueChange={(v) => set("fit", v as Fit)}>
                <SelectTrigger id="p-fit" className="w-full">
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
            <div className="grid gap-2">
              <Label htmlFor="p-format">Format</Label>
              <Select value={d.format} onValueChange={(v) => set("format", v as OutputFormat)}>
                <SelectTrigger id="p-format" className="w-full">
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
          </div>
          {FORMAT_INFO[d.format].lossy && (
            <div className="grid gap-2">
              <Label htmlFor="p-q">Quality (1–100)</Label>
              <Input
                id="p-q"
                inputMode="numeric"
                value={d.quality}
                onChange={(e) => set("quality", e.target.value.replace(/\D/g, ""))}
              />
            </div>
          )}
          <label className="flex items-center justify-between text-sm">
            Strip EXIF & GPS
            <Switch checked={d.stripMetadata} onCheckedChange={(v) => set("stripMetadata", v)} />
          </label>
          <FormError message={error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              Save preset
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function PresetsManager({ slug, initial }: { slug: string; initial: PresetDto[] }) {
  const [presets, setPresets] = useState(initial);
  const [editing, setEditing] = useState<PresetDto | "new" | null>(null);

  async function refresh() {
    const { presets } = await api<{ presets: PresetDto[] }>(`/api/o/${slug}/presets`, {
      method: "GET",
    });
    setPresets(presets);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base">Resize presets</CardTitle>
          <CardDescription>
            Sizes everyone can pick when downloading, zipping or sharing images.
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm">
                <RotateCcw /> Reset
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset presets to defaults?</AlertDialogTitle>
                <AlertDialogDescription>
                  Your custom presets will be replaced by the six built-in ones.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={async () => {
                    const { presets } = await api<{ presets: PresetDto[] }>(
                      `/api/o/${slug}/presets/reset`,
                      { method: "POST" },
                    );
                    setPresets(presets);
                    toast.success("Presets reset");
                  }}
                >
                  Reset
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus /> Add preset
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-0 sm:px-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Output</TableHead>
              <TableHead className="hidden sm:table-cell">Fit</TableHead>
              <TableHead className="text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {presets.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {describeParams(canonicalParams(p))}
                  {!p.stripMetadata && " · keeps EXIF"}
                </TableCell>
                <TableCell className="hidden text-muted-foreground sm:table-cell">
                  {FIT_LABELS[p.fit]}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Edit ${p.name}`}
                    onClick={() => setEditing(p)}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Delete ${p.name}`}
                    onClick={async () => {
                      try {
                        await api(`/api/o/${slug}/presets/${p.id}`, { method: "DELETE" });
                        setPresets((ps) => ps.filter((x) => x.id !== p.id));
                        toast.success(`Deleted “${p.name}”`);
                      } catch (err) {
                        toast.error((err as Error).message);
                      }
                    }}
                  >
                    <Trash2 />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <PresetDialog
        slug={slug}
        preset={editing && editing !== "new" ? editing : undefined}
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        onSaved={() => {
          void refresh();
          toast.success("Preset saved");
        }}
      />
    </Card>
  );
}
