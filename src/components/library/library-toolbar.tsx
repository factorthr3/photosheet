"use client";

import { Moon, Search, SlidersHorizontal, Sun, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  activeFilterCount,
  type FeedSort,
  type ImageFilters,
  SORT_LABELS,
  SORTS,
} from "@/lib/images/filters";
import { LICENCE_PRESETS } from "@/lib/images/licence";
import type { SheetBackground, ViewPrefs } from "./hooks";

export interface FilterFacets {
  tags: { tag: string; count: number }[];
  people: { id: string; name: string }[];
  boards?: { id: string; name: string }[];
}

type Patch = Partial<ImageFilters>;

function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  // Follow external changes (e.g. a cleared chip) without an effect.
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setDraft(value);
  }
  useEffect(() => {
    if (draft === value) return;
    const t = setTimeout(() => onChange(draft.trim()), 300);
    return () => clearTimeout(t);
  }, [draft, value, onChange]);

  return (
    <div className="relative w-full min-w-0 sm:w-auto sm:max-w-xs sm:flex-1">
      <Search
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        type="search"
        aria-label="Search images"
        placeholder="Search names, titles, tags…"
        className="pl-8"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
    </div>
  );
}

function TagPicker({
  facets,
  selected,
  onChange,
}: {
  facets: FilterFacets["tags"];
  selected: string[];
  onChange: (tags: string[]) => void;
}) {
  const [q, setQ] = useState("");
  const list = facets.filter((t) => t.tag.includes(q.toLowerCase())).slice(0, 50);
  const toggle = (tag: string) =>
    onChange(selected.includes(tag) ? selected.filter((t) => t !== tag) : [...selected, tag]);

  if (facets.length === 0) return <p className="text-sm text-muted-foreground">No tags yet.</p>;
  return (
    <div className="grid gap-2">
      {facets.length > 8 && (
        <Input
          aria-label="Find a tag"
          placeholder="Find a tag…"
          className="h-8"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      )}
      <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
        {list.map((t) => (
          <label
            key={t.tag}
            className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-accent"
          >
            <Checkbox checked={selected.includes(t.tag)} onCheckedChange={() => toggle(t.tag)} />
            <span className="flex-1 truncate">{t.tag}</span>
            <span className="text-xs text-muted-foreground tabular-nums">{t.count}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function FiltersPopover({
  filters,
  facets,
  onChange,
}: {
  filters: ImageFilters;
  facets: FilterFacets;
  onChange: (p: Patch) => void;
}) {
  const count = activeFilterCount(filters);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" aria-label={count ? `Filters (${count} active)` : "Filters"}>
          <SlidersHorizontal />
          Filters
          {count > 0 && (
            <Badge variant="secondary" className="ml-0.5 h-5 min-w-5 px-1 tabular-nums">
              {count}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="grid w-80 gap-5">
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">Tags</legend>
          <TagPicker
            facets={facets.tags}
            selected={filters.tags}
            onChange={(tags) => onChange({ tags })}
          />
        </fieldset>

        {facets.boards && facets.boards.length > 0 && (
          <div className="grid gap-2">
            <Label htmlFor="filter-board">Board</Label>
            <Select
              value={filters.board ?? "any"}
              onValueChange={(v) => onChange({ board: v === "any" ? undefined : v })}
            >
              <SelectTrigger id="filter-board" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any board</SelectItem>
                {facets.boards.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="grid gap-2">
          <Label htmlFor="filter-uploader">Uploaded by</Label>
          <Select
            value={filters.uploader ?? "anyone"}
            onValueChange={(v) => onChange({ uploader: v === "anyone" ? undefined : v })}
          >
            <SelectTrigger id="filter-uploader" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="anyone">Anyone</SelectItem>
              {facets.people.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">Date</legend>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={filters.dateField}
            onValueChange={(v) => v && onChange({ dateField: v as ImageFilters["dateField"] })}
            aria-label="Date field"
          >
            <ToggleGroupItem value="uploaded">Uploaded</ToggleGroupItem>
            <ToggleGroupItem value="taken">Taken</ToggleGroupItem>
          </ToggleGroup>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1">
              <Label htmlFor="filter-from" className="text-xs text-muted-foreground">
                From
              </Label>
              <Input
                id="filter-from"
                type="date"
                className="h-8"
                value={filters.from ?? ""}
                max={filters.to}
                onChange={(e) => onChange({ from: e.target.value || undefined })}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="filter-to" className="text-xs text-muted-foreground">
                To
              </Label>
              <Input
                id="filter-to"
                type="date"
                className="h-8"
                value={filters.to ?? ""}
                min={filters.from}
                onChange={(e) => onChange({ to: e.target.value || undefined })}
              />
            </div>
          </div>
        </fieldset>

        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">Orientation</legend>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={filters.orientation ?? "any"}
            onValueChange={(v) =>
              v &&
              onChange({
                orientation: v === "any" ? undefined : (v as ImageFilters["orientation"]),
              })
            }
            aria-label="Orientation"
          >
            <ToggleGroupItem value="any">Any</ToggleGroupItem>
            <ToggleGroupItem value="landscape">Landscape</ToggleGroupItem>
            <ToggleGroupItem value="portrait">Portrait</ToggleGroupItem>
            <ToggleGroupItem value="square">Square</ToggleGroupItem>
          </ToggleGroup>
        </fieldset>

        <div className="grid gap-2">
          <Label htmlFor="filter-licence">Licence</Label>
          <Select
            value={filters.licence ?? "any"}
            onValueChange={(v) =>
              onChange({ licence: v === "any" ? undefined : (v as ImageFilters["licence"]) })
            }
          >
            <SelectTrigger id="filter-licence" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any licence</SelectItem>
              <SelectItem value="restricted">
                Restricted (not {LICENCE_PRESETS.unlimited.toLowerCase()})
              </SelectItem>
              <SelectItem value="expiring">Expiring within 30 days</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {count > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              onChange({
                tags: [],
                uploader: undefined,
                from: undefined,
                to: undefined,
                orientation: undefined,
                licence: undefined,
                board: undefined,
              })
            }
          >
            Clear filters
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

function ActiveChips({
  filters,
  facets,
  onChange,
}: {
  filters: ImageFilters;
  facets: FilterFacets;
  onChange: (p: Patch) => void;
}) {
  const chips: { key: string; label: string; clear: Patch }[] = [];
  if (filters.q) chips.push({ key: "q", label: `“${filters.q}”`, clear: { q: "" } });
  for (const t of filters.tags)
    chips.push({
      key: `tag:${t}`,
      label: `#${t}`,
      clear: { tags: filters.tags.filter((x) => x !== t) },
    });
  if (filters.board) {
    const b = facets.boards?.find((x) => x.id === filters.board);
    chips.push({ key: "board", label: `Board: ${b?.name ?? "…"}`, clear: { board: undefined } });
  }
  if (filters.uploader) {
    const p = facets.people.find((x) => x.id === filters.uploader);
    chips.push({
      key: "uploader",
      label: `By ${p?.name ?? "someone"}`,
      clear: { uploader: undefined },
    });
  }
  if (filters.from || filters.to) {
    chips.push({
      key: "date",
      label: `${filters.dateField === "taken" ? "Taken" : "Uploaded"} ${filters.from ?? "…"} – ${filters.to ?? "…"}`,
      clear: { from: undefined, to: undefined },
    });
  }
  if (filters.orientation)
    chips.push({
      key: "o",
      label: filters.orientation[0].toUpperCase() + filters.orientation.slice(1),
      clear: { orientation: undefined },
    });
  if (filters.licence)
    chips.push({ key: "l", label: `Licence: ${filters.licence}`, clear: { licence: undefined } });
  if (!chips.length) return null;

  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Active filters">
      {chips.map((c) => (
        <li key={c.key}>
          <Badge variant="secondary" className="gap-1 pr-1">
            {c.label}
            <button
              type="button"
              className="rounded-full p-0.5 hover:bg-foreground/10"
              aria-label={`Remove filter ${c.label}`}
              onClick={() => onChange(c.clear)}
            >
              <X className="size-3" />
            </button>
          </Badge>
        </li>
      ))}
    </ul>
  );
}

export function LibraryToolbar({
  filters,
  facets,
  onChange,
  prefs,
  onPrefs,
  includeManualSort = false,
}: {
  filters: ImageFilters;
  facets: FilterFacets;
  onChange: (patch: Patch) => void;
  prefs: ViewPrefs;
  onPrefs: (patch: Partial<ViewPrefs>) => void;
  /** Offer "Board order" (boards only). */
  includeManualSort?: boolean;
}) {
  const sorts: FeedSort[] = includeManualSort ? ["manual", ...SORTS] : [...SORTS];
  return (
    <div className="sticky top-0 z-20 grid gap-2 border-b bg-background/95 px-4 py-3 backdrop-blur sm:px-6 md:top-0">
      <div className="flex flex-wrap items-center gap-2">
        <SearchBox value={filters.q} onChange={(q) => onChange({ q })} />
        <FiltersPopover filters={filters} facets={facets} onChange={onChange} />
        <Select value={filters.sort} onValueChange={(v) => onChange({ sort: v as FeedSort })}>
          <SelectTrigger className="w-auto min-w-44" aria-label="Sort by">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sorts.map((s) => (
              <SelectItem key={s} value={s}>
                {SORT_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-3">
          <Slider
            aria-label="Thumbnail size"
            className="hidden w-28 sm:flex"
            min={100}
            max={360}
            step={20}
            value={[prefs.tileSize]}
            onValueChange={([v]) => onPrefs({ tileSize: v })}
          />
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={prefs.background}
            onValueChange={(v) => v && onPrefs({ background: v as SheetBackground })}
            aria-label="Contact sheet background"
          >
            <ToggleGroupItem value="light" aria-label="Light background">
              <Sun />
            </ToggleGroupItem>
            <ToggleGroupItem value="dark" aria-label="Dark background">
              <Moon />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>
      <ActiveChips filters={filters} facets={facets} onChange={onChange} />
    </div>
  );
}
