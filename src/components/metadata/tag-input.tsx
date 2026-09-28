"use client";

import { X } from "lucide-react";
import { useId, useState } from "react";
import { normalizeTag, parseTagInput } from "@/lib/images/tags";
import { cn } from "@/lib/utils";

/** Chip-style tag editor. Enter, comma or Tab commits; Backspace on empty removes the last tag. */
export function TagInput({
  value,
  onChange,
  suggestions = [],
  placeholder = "Add tags…",
  id,
  className,
  "aria-label": ariaLabel,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  id?: string;
  className?: string;
  "aria-label"?: string;
}) {
  const [draft, setDraft] = useState("");
  const listId = useId();

  function commit(text = draft) {
    const next = parseTagInput([...value, ...text.split(",")].join(","));
    if (next.join() !== value.join()) onChange(next);
    setDraft("");
  }

  const q = normalizeTag(draft);
  const matches = q
    ? suggestions.filter((s) => s.includes(q) && !value.includes(s)).slice(0, 8)
    : [];

  return (
    <div
      className={cn(
        "flex min-h-9 flex-wrap items-center gap-1 rounded-md border bg-transparent px-2 py-1 shadow-xs focus-within:ring-2 focus-within:ring-ring/50",
        className,
      )}
    >
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-0.5 rounded bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground"
        >
          {tag}
          <button
            type="button"
            aria-label={`Remove tag ${tag}`}
            className="rounded-sm p-0.5 hover:bg-foreground/10"
            onClick={() => onChange(value.filter((t) => t !== tag))}
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        id={id}
        aria-label={ariaLabel}
        list={matches.length ? listId : undefined}
        className="min-w-24 flex-1 bg-transparent py-0.5 text-sm outline-none placeholder:text-muted-foreground"
        placeholder={value.length ? "" : placeholder}
        value={draft}
        onChange={(e) => {
          const v = e.target.value;
          if (/[,;]/.test(v)) commit(v);
          else setDraft(v);
        }}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === "Tab") && draft.trim()) {
            e.preventDefault();
            commit();
          } else if (e.key === "Backspace" && !draft && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => draft.trim() && commit()}
      />
      {matches.length > 0 && (
        <datalist id={listId}>
          {matches.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      )}
    </div>
  );
}
