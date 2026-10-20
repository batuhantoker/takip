'use client';

import { useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { focusPosition, useFocusedAircraft } from '@/components/map/inspect/aircraft-focus';
import { FLIGHT_BUCKET_KEYS, NEARBY_MIN_ZOOM, mergeNearby } from '@/lib/feeds/aviation/nearby-flights';
import type { ActiveLayers } from '@/lib/map/layers/defaults';
import type { LiveData, MapCenter } from './types';

const POLL_MS = 15_000;
const FOCUS_POLL_MS = 10_000;
/** A nearby read older than this is not laid over a newer global snapshot. */
const KEEP_MS = 60_000;

type Read = { at: number; rows: Record<string, unknown>[] };
type Anchor = 'view' | 'focus';

interface Args {
  dataRef: MutableRefObject<LiveData>;
  dataVersion: number;
  setDataVersion: Dispatch<SetStateAction<number>>;
  mapCenter: MapCenter | null;
  zoom: number;
  activeLayers: ActiveLayers;
  replayActive: boolean;
}

/**
 * Near-real-time aircraft around the view while a flight layer is on and the map is zoomed in, and around
 * the aircraft whose card is open at any zoom: polls /api/flights/nearby and lays its rows over the global
 * snapshot, again whenever a new snapshot lands.
 */
export function useNearbyFlights({ dataRef, dataVersion, setDataVersion, mapCenter, zoom, activeLayers, replayActive }: Args) {
  const reads = useRef<Record<Anchor, Read | null>>({ view: null, focus: null });
  const merged = useRef(new WeakSet<object>());
  const centre = useRef(mapCenter);
  useEffect(() => { centre.current = mapCenter; }, [mapCenter]);
  const focused = useFocusedAircraft();

  const anyFlights = activeLayers.flights || activeLayers.private || activeLayers.jets || activeLayers.military;
  const live = !!anyFlights && !replayActive;
  const on = live && zoom >= NEARBY_MIN_ZOOM && !!mapCenter;
  const focusOn = live && !!focused;

  const apply = () => {
    const held = Object.values(reads.current)
      .filter((r): r is Read => !!r && Date.now() - r.at <= KEEP_MS)
      .sort((a, b) => a.at - b.at);
    if (!held.length) return;
    // An aircraft in both reads keeps the newer row.
    const rows = new Map<unknown, Record<string, unknown>>();
    for (const r of held) for (const row of r.rows) rows.set(row.icao24 ?? row, row);
    const next = mergeNearby(dataRef.current, [...rows.values()]);
    for (const k of FLIGHT_BUCKET_KEYS) merged.current.add(next[k]);
    dataRef.current = { ...dataRef.current, ...next };
    setDataVersion(v => v + 1);
  };

  // A new global snapshot replaced the buckets; lay the nearby rows over it again.
  useEffect(() => {
    const buckets = FLIGHT_BUCKET_KEYS.map(k => dataRef.current[k]).filter(Boolean);
    if (buckets.length && !buckets.every(b => merged.current.has(b))) apply();
  }, [dataVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  const poll = (anchor: Anchor, where: () => { lat: number; lng: number } | null, every: number) => {
    const ctrl = new AbortController();
    const load = async () => {
      const c = where();
      if (!c || document.hidden) return;
      try {
        const res = await fetch(`/api/flights/nearby?lat=${c.lat.toFixed(3)}&lon=${c.lng.toFixed(3)}`, { signal: ctrl.signal, cache: 'no-store' });
        if (!res.ok) return;
        const body = await res.json() as { flights?: Record<string, unknown>[]; at?: string | null };
        const at = body.at ? Date.parse(body.at) : NaN;
        if (!body.flights?.length || !Number.isFinite(at) || at === reads.current[anchor]?.at) return;
        reads.current[anchor] = { at, rows: body.flights };
        apply();
      } catch (e) {
        if (!ctrl.signal.aborted) console.warn('[TAKIP] Nearby flights failed:', e instanceof Error ? e.message : e);
      }
    };
    load();
    const id = setInterval(load, every);
    return () => { ctrl.abort(); clearInterval(id); };
  };

  const anchor = mapCenter ? `${mapCenter.lat.toFixed(1)},${mapCenter.lng.toFixed(1)}` : '';
  useEffect(() => {
    if (!on) return;
    return poll('view', () => centre.current, POLL_MS);
  }, [on, anchor]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!focusOn) {
      reads.current.focus = null;
      return;
    }
    return poll('focus', focusPosition, FOCUS_POLL_MS);
  }, [focusOn, focused]); // eslint-disable-line react-hooks/exhaustive-deps
}
