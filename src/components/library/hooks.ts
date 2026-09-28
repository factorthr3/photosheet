"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ImageListItem } from "@/lib/images/dto";
import type { ImagePage } from "@/lib/images/list";
import { moveIds } from "@/lib/move-ids";
import { rangeBetween } from "./selection-range";

// ─── View preferences (per browser) ───────────────────────────────────────────

export type SheetBackground = "light" | "dark";
export interface ViewPrefs {
  tileSize: number;
  background: SheetBackground;
}
const PREFS_KEY = "photosheet:view";
const DEFAULT_PREFS: ViewPrefs = { tileSize: 180, background: "light" };

export function useViewPrefs() {
  const [prefs, setPrefs] = useState<ViewPrefs>(DEFAULT_PREFS);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "null");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from storage after mount
      if (saved) setPrefs({ ...DEFAULT_PREFS, ...saved });
    } catch {
      // storage unavailable — defaults are fine
    }
  }, []);
  const update = useCallback((patch: Partial<ViewPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);
  return [prefs, update] as const;
}

// ─── Paged image feed ─────────────────────────────────────────────────────────

interface FeedState {
  query: string;
  images: ImageListItem[];
  nextCursor: string | null;
  total: number | null;
  loading: boolean;
  error: string | null;
}

/**
 * Infinite list of images for a filter query string. Starts from the server-rendered first page
 * and resets whenever the query changes.
 */
export function useImageFeed(
  endpoint: string,
  query: string,
  initial: { query: string; page: ImagePage },
) {
  const [state, setState] = useState<FeedState>({
    query: initial.query,
    images: initial.page.images,
    nextCursor: initial.page.nextCursor,
    total: initial.page.total,
    loading: false,
    error: null,
  });
  const requestId = useRef(0);

  const fetchPage = useCallback(
    async (cursor: string | null) => {
      const id = ++requestId.current;
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const params = new URLSearchParams(query);
        if (cursor) params.set("cursor", cursor);
        const res = await fetch(`${endpoint}?${params}`);
        if (!res.ok)
          throw new Error((await res.json().catch(() => ({}))).error ?? "Couldn't load images");
        const page: ImagePage = await res.json();
        if (id !== requestId.current) return;
        setState((s) => {
          const have = cursor ? new Set(s.images.map((i) => i.id)) : null;
          return {
            query,
            images: have
              ? [...s.images, ...page.images.filter((p) => !have.has(p.id))]
              : page.images,
            nextCursor: page.nextCursor,
            total: page.total ?? s.total,
            loading: false,
            error: null,
          };
        });
      } catch (err) {
        if (id !== requestId.current) return;
        setState((s) => ({ ...s, loading: false, error: (err as Error).message }));
      }
    },
    [endpoint, query],
  );

  // Reset when filters change.
  useEffect(() => {
    if (query !== state.query) void fetchPage(null);
  }, [query, state.query, fetchPage]);

  const loadMore = useCallback(() => {
    if (state.nextCursor && !state.loading && state.query === query)
      void fetchPage(state.nextCursor);
  }, [state.nextCursor, state.loading, state.query, query, fetchPage]);

  const reload = useCallback(() => fetchPage(null), [fetchPage]);

  const patchImages = useCallback((ids: string[], patch: Partial<ImageListItem>) => {
    const set = new Set(ids);
    setState((s) => ({
      ...s,
      images: s.images.map((i) => (set.has(i.id) ? { ...i, ...patch } : i)),
    }));
  }, []);

  const replaceImages = useCallback((updated: ImageListItem[]) => {
    const byId = new Map(updated.map((u) => [u.id, u]));
    setState((s) => ({ ...s, images: s.images.map((i) => byId.get(i.id) ?? i) }));
  }, []);

  const removeImages = useCallback((ids: string[]) => {
    const set = new Set(ids);
    setState((s) => ({
      ...s,
      images: s.images.filter((i) => !set.has(i.id)),
      total: s.total === null ? null : Math.max(0, s.total - ids.length),
    }));
  }, []);

  /** Optimistically reorder loaded images (board manual order). */
  const moveLocal = useCallback(
    (ids: string[], target: { beforeId?: string; afterId?: string }) => {
      setState((s) => {
        const byId = new Map(s.images.map((i) => [i.id, i]));
        const order = moveIds(
          s.images.map((i) => i.id),
          ids,
          target,
        );
        return { ...s, images: order.map((id) => byId.get(id)!) };
      });
    },
    [],
  );

  const stale = state.query !== query;
  return {
    images: state.images,
    total: state.total,
    hasMore: !!state.nextCursor,
    loading: state.loading || stale,
    error: state.error,
    loadMore,
    reload,
    patchImages,
    replaceImages,
    removeImages,
    moveLocal,
  };
}

// ─── Multi-select ─────────────────────────────────────────────────────────────

export interface SelectModifiers {
  shift?: boolean;
  toggle?: boolean;
}

/** Finder-style selection over an ordered list: click, ⌘/Ctrl-click to toggle, Shift-click range. */
export function useSelection(ids: string[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const anchor = useRef<string | null>(null);

  const select = useCallback(
    (id: string, mods: SelectModifiers = {}) => {
      setSelected((prev) => {
        if (mods.shift && anchor.current) {
          const next = mods.toggle ? new Set(prev) : new Set<string>();
          for (const rid of rangeBetween(ids, anchor.current, id)) next.add(rid);
          return next;
        }
        anchor.current = id;
        if (mods.toggle) {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        }
        return new Set([id]);
      });
    },
    [ids],
  );

  const setMany = useCallback((next: Iterable<string>) => setSelected(new Set(next)), []);
  const clear = useCallback(() => {
    anchor.current = null;
    setSelected(new Set());
  }, []);

  return { selected, select, setMany, clear };
}
