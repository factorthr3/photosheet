import { cn } from "@/lib/utils";

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6 shrink-0">
        <rect x="2" y="2" width="9" height="9" rx="2" className="fill-foreground" />
        <rect x="13" y="2" width="9" height="9" rx="2" className="fill-foreground/60" />
        <rect x="2" y="13" width="9" height="9" rx="2" className="fill-foreground/60" />
        <rect x="13" y="13" width="9" height="9" rx="2" className="fill-foreground/30" />
      </svg>
      {!compact && <span>PhotoSheet</span>}
    </span>
  );
}
