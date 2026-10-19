'use client';

import { useEffect, useState, type Dispatch, type RefObject, type SetStateAction } from 'react';
import { embedQuery, type EmbedSpec } from '@/lib/map/embed/spec';
import type { LiveData } from '@/components/shell/state/types';

export type WindowShown =
  | { status: 'loading' }
  | { status: 'failed' }
  /** `until` is the window's end, or now when it reaches today. */
  | { status: 'ready'; shown: number; total: number | null; limit: number; from: number; until: number; minMag: number };

/** A window that reaches today gains quakes as they happen. */
const REFRESH_MS = 15 * 60_000;

/**
 * Loads a past window into the map's data in place of today's feed: earthquakes, the one windowed
 * layer so far (lib/map/embed/windows.ts). Null when the spec has no window over a windowed layer.
 */
export function useWindowData({ spec, dataRef, setDataVersion }: {
  spec: EmbedSpec;
  dataRef: RefObject<LiveData>;
  setDataVersion: Dispatch<SetStateAction<number>>;
}): WindowShown | null {
  const query = spec.window && spec.layers.includes('earthquakes')
    ? embedQuery({ layers: [], bbox: spec.bbox, window: spec.window, minMag: spec.minMag })
    : null;
  const [shown, setShown] = useState<WindowShown | null>(query ? { status: 'loading' } : null);

  useEffect(() => {
    if (!query) return;
    let live = true;
    let open = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/earthquakes/range?${query}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = await res.json();
        if (!live) return;
        open = body.to > Date.now();
        dataRef.current = { ...dataRef.current, earthquakes: body.earthquakes };
        setDataVersion(v => v + 1);
        setShown({ status: 'ready', shown: body.earthquakes.length, total: body.total, limit: body.limit, from: body.from, until: Math.min(body.to, Date.now()), minMag: body.minMag });
      } catch {
        if (live) setShown(s => (s?.status === 'ready' ? s : { status: 'failed' }));
      }
    };
    void load();
    const timer = setInterval(() => { if (open && !document.hidden) void load(); }, REFRESH_MS);
    return () => { live = false; clearInterval(timer); };
  }, [query, dataRef, setDataVersion]);

  return shown;
}
