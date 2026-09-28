"use client";

import { Scaling } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ImageListItem } from "@/lib/images/dto";
import { ResizeDialog } from "./resize-dialog";

export function ResizeButton({
  slug,
  image,
  canDownload,
  variant = "default",
}: {
  slug: string;
  image: ImageListItem;
  canDownload: boolean;
  variant?: "default" | "lightbox";
}) {
  const [open, setOpen] = useState(false);
  const disabled = image.status !== "READY";
  return (
    <>
      {variant === "lightbox" ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              disabled={disabled}
              aria-label="Resize & download"
              className="text-white hover:bg-white/15 hover:text-white"
              onClick={() => setOpen(true)}
            >
              <Scaling />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Resize & download</TooltipContent>
        </Tooltip>
      ) : (
        <Button variant="outline" size="sm" disabled={disabled} onClick={() => setOpen(true)}>
          <Scaling />
          Resize & download
        </Button>
      )}
      {open && (
        <ResizeDialog
          slug={slug}
          image={image}
          open={open}
          onOpenChange={setOpen}
          canDownload={canDownload}
        />
      )}
    </>
  );
}
