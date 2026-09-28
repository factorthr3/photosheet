"use client";

import { Eye, Image as ImageIcon, LayoutGrid, Lock, Share2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import type { ShareDto } from "@/lib/shares-dto";
import { CopyButton } from "./share-dialog";

export function SharesList({ slug, initial }: { slug: string; initial: ShareDto[] }) {
  const [shares, setShares] = useState(initial);
  const [show, setShow] = useState<"active" | "all">("active");
  const visible = show === "all" ? shares : shares.filter((s) => s.state === "active");

  async function revoke(id: string) {
    const res = await fetch(`/api/o/${slug}/shares/${id}/revoke`, {
      method: "POST",
      headers: { "content-type": "application/json" },
    });
    const body = await res.json();
    if (!res.ok) return toast.error(body.error ?? "Couldn't revoke");
    setShares((all) => all.map((s) => (s.id === id ? body.share : s)));
    toast.success("Link revoked");
  }

  if (shares.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-12 text-center">
        <Share2 className="size-8 text-muted-foreground" aria-hidden="true" />
        <p className="font-medium">No shared links yet</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Open a board or an image and choose Share to create a public link.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 p-4 sm:p-6">
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={show === "active" ? "secondary" : "ghost"}
          onClick={() => setShow("active")}
        >
          Active ({shares.filter((s) => s.state === "active").length})
        </Button>
        <Button
          size="sm"
          variant={show === "all" ? "secondary" : "ghost"}
          onClick={() => setShow("all")}
        >
          All ({shares.length})
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Shared</TableHead>
            <TableHead className="hidden md:table-cell">Created</TableHead>
            <TableHead className="hidden sm:table-cell">Expires</TableHead>
            <TableHead className="text-right">Activity</TableHead>
            <TableHead className="text-right">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.map((s) => (
            <TableRow key={s.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  {s.targetType === "board" ? (
                    <LayoutGrid className="size-4 text-muted-foreground" aria-label="Board" />
                  ) : (
                    <ImageIcon className="size-4 text-muted-foreground" aria-label="Image" />
                  )}
                  <Link
                    className="truncate font-medium hover:underline"
                    href={
                      s.targetType === "board"
                        ? `/o/${slug}/boards/${s.targetId}`
                        : `/o/${slug}/library?image=${s.targetId}`
                    }
                  >
                    {s.targetName}
                  </Link>
                  {s.hasPassword && (
                    <Lock
                      className="size-3.5 text-muted-foreground"
                      aria-label="Password protected"
                    />
                  )}
                  {s.state !== "active" && (
                    <Badge variant="secondary">
                      {s.state === "revoked" ? "Revoked" : "Expired"}
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="hidden text-muted-foreground md:table-cell">
                {formatDate(s.createdAt)}
                {s.createdBy && <span className="block text-xs">{s.createdBy}</span>}
              </TableCell>
              <TableCell className="hidden text-muted-foreground sm:table-cell">
                {s.expiresAt ? formatDate(new Date(new Date(s.expiresAt).getTime() - 1)) : "Never"}
              </TableCell>
              <TableCell className="text-right text-muted-foreground tabular-nums">
                <span className="inline-flex items-center gap-1">
                  <Eye className="size-3.5" aria-hidden="true" /> {s.views}
                </span>
                <span className="block text-xs">{s.downloads} downloads</span>
              </TableCell>
              <TableCell className="text-right whitespace-nowrap">
                {s.state === "active" && (
                  <>
                    <CopyButton text={s.url} label="Copy" />{" "}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => revoke(s.id)}
                    >
                      Revoke
                    </Button>
                  </>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
