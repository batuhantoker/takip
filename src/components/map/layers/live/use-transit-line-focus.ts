'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { setTransitLineFocus, setTransitRoutes, type TransitRoute } from '@/lib/feeds/transit/map-layers';
import { subscribeTransitLines, transitLinesState } from '@/lib/feeds/transit/lines';
import type { MapRef } from '@/components/map/types';

const focusOf = () => transitLinesState().focus;

/**
 * The line picked in the Layers panel or a vehicle's window: its route and stops drawn from a trip or two
 * under way on it (both directions where both are in view), and every other vehicle faded.
 */
export function useTransitLineFocus({ mapRef, mapReady }: { mapRef: MapRef; mapReady: boolean }) {
  const focus = useSyncExternalStore(subscribeTransitLines, focusOf, () => null);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    setTransitLineFocus(map, focus);
    if (!focus) return;
    const abort = new AbortController();
    const routes: TransitRoute[] = focus.trips.map(() => ({ shape: null, stops: null, mode: focus.mode }));
    const show = () => { if (!abort.signal.aborted) setTransitRoutes(map, 'line', routes); };
    const get = async <T,>(what: 'shape' | 'stops', trip: string): Promise<T | null> => {
      const res = await fetch(`/api/transit/${what}?feed=${encodeURIComponent(focus.feed)}&trip=${encodeURIComponent(trip)}`, { signal: abort.signal });
      return res.ok ? ((await res.json()) as T) : null;
    };
    // The line first: stops can take a scan of the feed's timetable.
    focus.trips.forEach((trip, i) => {
      void get<{ shape: TransitRoute['shape'] }>('shape', trip).then(b => { routes[i].shape = b?.shape ?? null; show(); }).catch(() => {});
      void get<{ stops: TransitRoute['stops'] }>('stops', trip).then(b => { routes[i].stops = b?.stops ?? null; show(); }).catch(() => {});
    });
    return () => {
      abort.abort();
      setTransitRoutes(map, 'line', null);
      setTransitLineFocus(map, null);
    };
  }, [focus, mapReady, mapRef]);
}
