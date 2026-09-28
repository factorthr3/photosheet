"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { FormError } from "@/components/auth/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ImageDetail } from "@/lib/images/dto";
import { toDateInput } from "@/lib/images/metadata";
import { LicenceField } from "./licence-field";
import { TagInput } from "./tag-input";

/** Edit one image's golden-source metadata. */
export function MetadataEditor({
  slug,
  image,
  tagSuggestions,
  onSaved,
  onCancel,
}: {
  slug: string;
  image: ImageDetail;
  tagSuggestions: string[];
  onSaved: (image: ImageDetail) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    title: image.title ?? "",
    description: image.description ?? "",
    tags: image.tags,
    credit: image.credit ?? "",
    copyright: image.copyright ?? "",
    licence: image.licence ?? "",
    licenceExpiresAt: toDateInput(image.licenceExpiresAt),
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const id = (f: string) => `meta-${image.id}-${f}`;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/o/${slug}/images/${image.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, licenceExpiresAt: form.licenceExpiresAt || null }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't save");
      onSaved(body.image);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={save} className="grid gap-4" aria-label="Edit image details">
      <div className="grid gap-2">
        <Label htmlFor={id("title")}>Title</Label>
        <Input
          id={id("title")}
          maxLength={300}
          value={form.title}
          placeholder={image.filename}
          onChange={(e) => set("title", e.target.value)}
        />
        <p className="text-xs text-muted-foreground">Also used as the image&apos;s alt text.</p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={id("description")}>Description / caption</Label>
        <Textarea
          id={id("description")}
          rows={3}
          maxLength={5000}
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={id("tags")}>Tags</Label>
        <TagInput
          id={id("tags")}
          value={form.tags}
          onChange={(t) => set("tags", t)}
          suggestions={tagSuggestions}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={id("credit")}>Photographer / credit</Label>
        <Input
          id={id("credit")}
          maxLength={300}
          value={form.credit}
          onChange={(e) => set("credit", e.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={id("copyright")}>Copyright holder</Label>
        <Input
          id={id("copyright")}
          maxLength={300}
          value={form.copyright}
          onChange={(e) => set("copyright", e.target.value)}
        />
      </div>
      <LicenceField
        idPrefix={id("lic")}
        licence={form.licence}
        expires={form.licenceExpiresAt}
        onLicence={(v) => set("licence", v)}
        onExpires={(v) => set("licenceExpiresAt", v)}
      />
      <FormError message={error} />
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          Save
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
