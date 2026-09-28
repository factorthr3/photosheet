"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormError } from "@/components/auth/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";
import { isValidSlug, slugify } from "@/lib/slug";

export function CreateOrgForm({ onCreated }: { onCreated?: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const effectiveSlug = slugTouched ? slug : slugify(name);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidSlug(effectiveSlug)) {
      setError("URL must be 3–48 characters: lowercase letters, numbers and hyphens.");
      return;
    }
    setPending(true);
    setError(null);
    const { data, error } = await authClient.organization.create({
      name: name.trim(),
      slug: effectiveSlug,
    });
    if (error || !data) {
      setError(
        error?.message?.toLowerCase().includes("slug")
          ? "That URL is taken — try another."
          : (error?.message ?? "Could not create organisation"),
      );
      setPending(false);
      return;
    }
    await authClient.organization.setActive({ organizationId: data.id });
    onCreated?.();
    router.push(`/o/${data.slug}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="org-name">Organisation name</Label>
        <Input
          id="org-name"
          required
          maxLength={80}
          placeholder="Acme Studio"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="org-slug">URL</Label>
        <div className="flex items-center rounded-md border focus-within:ring-2 focus-within:ring-ring/50">
          <span className="pl-3 text-sm text-muted-foreground">/o/</span>
          <Input
            id="org-slug"
            required
            className="border-0 pl-1 shadow-none focus-visible:ring-0"
            value={effectiveSlug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value.toLowerCase());
            }}
          />
        </div>
      </div>
      <FormError message={error} />
      <Button type="submit" disabled={pending || !name.trim()}>
        {pending && <Loader2 className="animate-spin" />}
        Create organisation
      </Button>
    </form>
  );
}
