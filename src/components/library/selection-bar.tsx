"use client";

import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SelectionBar({
  count,
  total,
  onSelectAll,
  selectingAll,
  onClear,
  children,
}: {
  count: number;
  total: number | null;
  onSelectAll?: () => void;
  selectingAll?: boolean;
  onClear: () => void;
  children?: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <div
      role="region"
      aria-label="Selection"
      className="sticky bottom-0 z-30 flex flex-wrap items-center gap-2 border-t bg-background/95 px-4 py-2.5 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] backdrop-blur sm:px-6"
    >
      <Button variant="ghost" size="icon-sm" onClick={onClear} aria-label="Clear selection">
        <X />
      </Button>
      <p className="text-sm font-medium tabular-nums" aria-live="polite">
        {count.toLocaleString()} selected
      </p>
      {onSelectAll && total !== null && count < total && (
        <Button variant="link" size="sm" onClick={onSelectAll} disabled={selectingAll}>
          {selectingAll && <Loader2 className="animate-spin" />}
          Select all {total.toLocaleString()}
        </Button>
      )}
      <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
