import { CircleAlert, Clock, Lock } from "lucide-react";
import type { ImageListItem } from "@/lib/images/dto";
import { licenceLabel, licenceState } from "@/lib/images/licence";
import { cn } from "@/lib/utils";

/** Corner badges on a tile: licence warnings. */
export function ImageBadges({ image, className }: { image: ImageListItem; className?: string }) {
  const state = licenceState(image.licence, image.licenceExpiresAt);
  if (state === "ok" || state === "none") return null;

  const config = {
    expired: { icon: CircleAlert, label: "Licence expired", cls: "bg-red-600 text-white" },
    expiring: { icon: Clock, label: "Licence expiring soon", cls: "bg-amber-400 text-amber-950" },
    restricted: {
      icon: Lock,
      label: `Restricted: ${licenceLabel(image.licence)}`,
      cls: "bg-neutral-900/80 text-white",
    },
  }[state];

  return (
    <span
      title={config.label}
      className={cn(
        "absolute bottom-1.5 left-1.5 inline-flex max-w-[calc(100%-0.75rem)] items-center gap-1 rounded px-1.5 py-0.5 text-[11px] leading-4 font-medium shadow",
        config.cls,
        className,
      )}
    >
      <config.icon className="size-3 shrink-0" aria-hidden="true" />
      <span className="truncate">
        {state === "restricted" ? licenceLabel(image.licence) : config.label}
      </span>
    </span>
  );
}
