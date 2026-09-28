"use client";

import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CreateOrgForm } from "@/components/org/create-org-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth/client";

export interface OrgSummary {
  id: string;
  name: string;
  slug: string;
}

function Initials({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span
      aria-hidden="true"
      className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground"
    >
      {initials || "?"}
    </span>
  );
}

export function OrgSwitcher({
  current,
  orgs,
}: {
  current: { name: string; slug: string };
  orgs: OrgSummary[];
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  async function switchTo(org: OrgSummary) {
    if (org.slug === current.slug) return;
    await authClient.organization.setActive({ organizationId: org.id });
    router.push(`/o/${org.slug}`);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-auto w-full justify-start gap-2 px-2 py-2"
            aria-label={`Organisation: ${current.name}. Switch organisation`}
          >
            <Initials name={current.name} />
            <span className="min-w-0 flex-1 truncate text-left font-semibold">{current.name}</span>
            <ChevronsUpDown className="size-4 text-muted-foreground" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Organisations
          </DropdownMenuLabel>
          {orgs.map((org) => (
            <DropdownMenuItem key={org.id} onSelect={() => switchTo(org)} className="gap-2">
              <Initials name={org.name} />
              <span className="flex-1 truncate">{org.name}</span>
              {org.slug === current.slug && <Check className="size-4" aria-label="Current" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setCreating(true)} className="gap-2">
            <Plus className="size-4" aria-hidden="true" />
            Create organisation
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create organisation</DialogTitle>
            <DialogDescription>
              Each organisation has its own library, boards and members.
            </DialogDescription>
          </DialogHeader>
          <CreateOrgForm onCreated={() => setCreating(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
