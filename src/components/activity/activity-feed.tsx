"use client";

import {
  Activity,
  Download,
  Image as ImageIcon,
  LayoutGrid,
  Loader2,
  Share2,
  Trash2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ACTIVITY_GROUPS, describeEvent } from "@/lib/activity-describe";
import type { ActivityItem } from "@/lib/activity";
import { formatDateTime, formatRelative } from "@/lib/format";

function iconFor(action: string) {
  if (
    action.startsWith("image.trash") ||
    action.startsWith("image.purge") ||
    action === "board.delete"
  )
    return Trash2;
  if (action.includes("download") || action.startsWith("export.")) return Download;
  if (action.startsWith("share.") || action === "board.share_internal") return Share2;
  if (action.startsWith("board.")) return LayoutGrid;
  if (action.startsWith("member.") || action.startsWith("org.")) return Users;
  if (action.startsWith("image.")) return ImageIcon;
  return Activity;
}

function targetHref(slug: string, e: ActivityItem) {
  if (!e.targetId) return null;
  if (e.targetType === "board" && e.action !== "board.delete")
    return `/o/${slug}/boards/${e.targetId}`;
  if (e.targetType === "image" && !["image.purge", "image.trash"].includes(e.action))
    return `/o/${slug}/library?image=${e.targetId}`;
  return null;
}

export function ActivityFeed({
  slug,
  initial,
  people,
}: {
  slug: string;
  initial: { events: ActivityItem[]; nextCursor: string | null };
  people: { id: string; name: string }[];
}) {
  const [group, setGroup] = useState("all");
  const [person, setPerson] = useState("anyone");
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(false);
  const filtered = group !== "all" || person !== "anyone";

  function query(cursor?: string | null) {
    const p = new URLSearchParams();
    if (group !== "all") p.set("group", group);
    if (person !== "anyone") p.set("user", person);
    if (cursor) p.set("cursor", cursor);
    return `/api/o/${slug}/activity?${p}`;
  }

  useEffect(() => {
    if (!filtered) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- back to the server-rendered page
      setData(initial);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(query())
      .then((r) => r.json())
      .then((d) => !cancelled && setData(d))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group, person]);

  async function more() {
    setLoading(true);
    try {
      const d = await (await fetch(query(data.nextCursor))).json();
      setData((prev) => ({ events: [...prev.events, ...d.events], nextCursor: d.nextCursor }));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid max-w-4xl gap-4 p-4 sm:p-6">
      <div className="flex flex-wrap gap-3">
        <div className="grid gap-1">
          <Label htmlFor="act-group" className="text-xs text-muted-foreground">
            Type
          </Label>
          <Select value={group} onValueChange={setGroup}>
            <SelectTrigger id="act-group" className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All activity</SelectItem>
              {Object.entries(ACTIVITY_GROUPS).map(([k, g]) => (
                <SelectItem key={k} value={k}>
                  {g.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1">
          <Label htmlFor="act-person" className="text-xs text-muted-foreground">
            Person
          </Label>
          <Select value={person} onValueChange={setPerson}>
            <SelectTrigger id="act-person" className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="anyone">Anyone</SelectItem>
              {people.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {data.events.length === 0 && !loading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No activity {filtered ? "matches these filters" : "yet"}.
        </p>
      ) : (
        <ol className="divide-y rounded-lg border" aria-label="Activity">
          {data.events.map((e) => {
            const Icon = iconFor(e.action);
            const href = targetHref(slug, e);
            const text = (
              <>
                <span className="font-medium">
                  {e.actor?.name ??
                    (e.meta.via === "share" ? "Someone with a shared link" : "PhotoSheet")}
                </span>{" "}
                {describeEvent(e)}
              </>
            );
            return (
              <li key={e.id} className="flex items-start gap-3 px-4 py-3">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
                  <Icon className="size-3.5 text-muted-foreground" aria-hidden="true" />
                </span>
                <p className="min-w-0 flex-1 text-sm">
                  {href ? (
                    <Link href={href} className="hover:underline">
                      {text}
                    </Link>
                  ) : (
                    text
                  )}
                </p>
                <time
                  suppressHydrationWarning
                  dateTime={e.createdAt}
                  title={formatDateTime(e.createdAt)}
                  className="shrink-0 text-xs text-muted-foreground"
                >
                  {formatRelative(e.createdAt)}
                </time>
              </li>
            );
          })}
        </ol>
      )}
      {loading && (
        <Loader2
          className="mx-auto size-5 animate-spin text-muted-foreground"
          aria-label="Loading"
        />
      )}
      {data.nextCursor && !loading && (
        <Button variant="outline" onClick={more} className="justify-self-center">
          Load more
        </Button>
      )}
    </div>
  );
}
