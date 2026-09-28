"use client";

import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { renameOrganization } from "@/app/o/[slug]/settings/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function OrgSettingsForm({
  slug,
  name,
  canEdit,
}: {
  slug: string;
  name: string;
  canEdit: boolean;
}) {
  const [value, setValue] = useState(name);
  const [pending, startTransition] = useTransition();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Organisation</CardTitle>
        <CardDescription>
          {canEdit
            ? "Only owners can rename the organisation."
            : "Only owners can change these details."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              const res = await renameOrganization(slug, value);
              if (res.ok) toast.success("Organisation renamed");
              else toast.error(res.error);
            });
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="org-name">Name</Label>
            <Input
              id="org-name"
              value={value}
              maxLength={80}
              disabled={!canEdit}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="org-url">URL</Label>
            <Input id="org-url" value={`/o/${slug}`} readOnly disabled />
          </div>
          {canEdit && (
            <div>
              <Button type="submit" disabled={pending || value.trim() === name || !value.trim()}>
                {pending && <Loader2 className="animate-spin" />}
                Save
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
