"use client";

import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

async function post(url: string, imageIds: string[]) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ imageIds }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

/** Move to Trash with an Undo toast. `onTrashed` gets the ids actually trashed. */
export function TrashButton({
  slug,
  imageIds,
  onTrashed,
  onRestored,
  variant = "default",
}: {
  slug: string;
  imageIds: string[];
  onTrashed: (ids: string[]) => void;
  onRestored?: () => void;
  variant?: "default" | "lightbox";
}) {
  async function trash() {
    try {
      const { trashed, skipped } = await post(`/api/o/${slug}/images/trash`, imageIds);
      if (trashed.length === 0) {
        toast.error("You can only delete images you uploaded");
        return;
      }
      onTrashed(trashed);
      toast.success(
        `Moved ${trashed.length} ${trashed.length === 1 ? "image" : "images"} to trash${skipped ? ` · ${skipped} skipped (not yours)` : ""}`,
        {
          action: {
            label: "Undo",
            onClick: async () => {
              await post(`/api/o/${slug}/images/restore`, trashed);
              onRestored?.();
              toast.success("Restored");
            },
          },
        },
      );
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return variant === "lightbox" ? (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Move to trash"
      className="text-white hover:bg-white/15 hover:text-white"
      onClick={trash}
    >
      <Trash2 />
    </Button>
  ) : (
    <Button variant="outline" size="sm" onClick={trash}>
      <Trash2 /> Move to trash
    </Button>
  );
}
