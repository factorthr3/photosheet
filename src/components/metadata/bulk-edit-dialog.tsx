"use client";

import { Loader2, PencilLine } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { FormError } from "@/components/auth/form-error";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import type { ImageListItem } from "@/lib/images/dto";
import { LicenceField } from "./licence-field";
import { TagInput } from "./tag-input";

type Field = "title" | "description" | "credit" | "copyright" | "licence";

const FIELD_LABELS: Record<Exclude<Field, "licence">, string> = {
  title: "Title",
  description: "Description / caption",
  credit: "Photographer / credit",
  copyright: "Copyright holder",
};

/** Edit metadata across a selection. Only ticked fields change; tags are added/removed. */
export function BulkEditButton({
  slug,
  imageIds,
  tagSuggestions,
  onUpdated,
}: {
  slug: string;
  imageIds: string[];
  tagSuggestions: string[];
  onUpdated: (images: ImageListItem[] | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState<Record<Field, boolean>>({
    title: false,
    description: false,
    credit: false,
    copyright: false,
    licence: false,
  });
  const [values, setValues] = useState({
    title: "",
    description: "",
    credit: "",
    copyright: "",
    licence: "",
    licenceExpiresAt: "",
  });
  const [addTags, setAddTags] = useState<string[]>([]);
  const [removeTags, setRemoveTags] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const n = imageIds.length;
  const nothing = !Object.values(enabled).some(Boolean) && !addTags.length && !removeTags.length;

  function reset() {
    setEnabled({
      title: false,
      description: false,
      credit: false,
      copyright: false,
      licence: false,
    });
    setValues({
      title: "",
      description: "",
      credit: "",
      copyright: "",
      licence: "",
      licenceExpiresAt: "",
    });
    setAddTags([]);
    setRemoveTags([]);
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const set: Record<string, string | null> = {};
    for (const f of ["title", "description", "credit", "copyright"] as const)
      if (enabled[f]) set[f] = values[f];
    if (enabled.licence) {
      set.licence = values.licence;
      set.licenceExpiresAt = values.licenceExpiresAt || null;
    }
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/o/${slug}/images/bulk-update`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageIds, set, addTags, removeTags }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't update images");
      toast.success(`Updated ${body.updated} ${body.updated === 1 ? "image" : "images"}`);
      onUpdated(body.images);
      setOpen(false);
      reset();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <PencilLine />
        Edit metadata
      </Button>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) reset();
        }}
      >
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
          <form onSubmit={submit} className="grid gap-5">
            <DialogHeader>
              <DialogTitle>
                Edit {n} {n === 1 ? "image" : "images"}
              </DialogTitle>
              <DialogDescription>
                Tick a field to overwrite it on every selected image. Leave a ticked field empty to
                clear it.
              </DialogDescription>
            </DialogHeader>

            {(Object.keys(FIELD_LABELS) as (keyof typeof FIELD_LABELS)[]).map((f) => (
              <div key={f} className="grid gap-2">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <Checkbox
                    checked={enabled[f]}
                    onCheckedChange={(c) => setEnabled((s) => ({ ...s, [f]: !!c }))}
                    aria-label={`Change ${FIELD_LABELS[f]}`}
                  />
                  {FIELD_LABELS[f]}
                </label>
                {enabled[f] &&
                  (f === "description" ? (
                    <Textarea
                      aria-label={FIELD_LABELS[f]}
                      rows={3}
                      maxLength={5000}
                      value={values[f]}
                      onChange={(e) => setValues((v) => ({ ...v, [f]: e.target.value }))}
                    />
                  ) : (
                    <Input
                      aria-label={FIELD_LABELS[f]}
                      maxLength={300}
                      value={values[f]}
                      onChange={(e) => setValues((v) => ({ ...v, [f]: e.target.value }))}
                    />
                  ))}
              </div>
            ))}

            <div className="grid gap-2">
              <label className="flex items-center gap-2 text-sm font-medium">
                <Checkbox
                  checked={enabled.licence}
                  onCheckedChange={(c) => setEnabled((s) => ({ ...s, licence: !!c }))}
                  aria-label="Change usage rights"
                />
                Usage rights & expiry
              </label>
              {enabled.licence && (
                <LicenceField
                  idPrefix="bulk"
                  licence={values.licence}
                  expires={values.licenceExpiresAt}
                  onLicence={(v) => setValues((s) => ({ ...s, licence: v }))}
                  onExpires={(v) => setValues((s) => ({ ...s, licenceExpiresAt: v }))}
                />
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="bulk-add-tags">Add tags</Label>
              <TagInput
                id="bulk-add-tags"
                value={addTags}
                onChange={setAddTags}
                suggestions={tagSuggestions}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bulk-remove-tags">Remove tags</Label>
              <TagInput
                id="bulk-remove-tags"
                value={removeTags}
                onChange={setRemoveTags}
                suggestions={tagSuggestions}
                placeholder="Tags to remove…"
              />
            </div>

            <FormError message={error} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending || nothing}>
                {pending && <Loader2 className="animate-spin" />}
                Apply to {n} {n === 1 ? "image" : "images"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
