'use client';

import { useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { FLIGHT_BUCKET_KEYS, NEARBY_MIN_ZOOM, mergeNearby } from '@/lib/feeds/aviation/nearby-flights';
import type { ActiveLayers } from '@/lib/map/layers/defaults';
import type { LiveData, MapCenter } from './types';

const POLL_MS = 15_000;
/** A nearby read older than this is not laid over a newer global snapshot. */
const KEEP_MS = 60_000;

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
 * Near-real-time aircraft around the view while a flight layer is on and the map is zoomed in: polls
 * /api/flights/nearby and lays its rows over the global snapshot, again whenever a new snapshot lands.
 */
export function useNearbyFlights({ dataRef, dataVersion, setDataVersion, mapCenter, zoom, activeLayers, replayActive }: Args) {
  const nearby = useRef<{ at: number; rows: Record<string, unknown>[] } | null>(null);
  const merged = useRef(new WeakSet<object>());
  const centre = useRef(mapCenter);
  useEffect(() => { centre.current = mapCenter; }, [mapCenter]);

  const anyFlights = activeLayers.flights || activeLayers.private || activeLayers.jets || activeLayers.military;
  const on = !!anyFlights && !replayActive && zoom >= NEARBY_MIN_ZOOM && !!mapCenter;

  const apply = () => {
    const held = nearby.current;
    if (!held || Date.now() - held.at > KEEP_MS) return;
    const next = mergeNearby(dataRef.current, held.rows);
    for (const k of FLIGHT_BUCKET_KEYS) merged.current.add(next[k]);
    dataRef.current = { ...dataRef.current, ...next };
    setDataVersion(v => v + 1);
  };

  // A new global snapshot replaced the buckets; lay the nearby rows over it again.
  useEffect(() => {
    const buckets = FLIGHT_BUCKET_KEYS.map(k => dataRef.current[k]).filter(Boolean);
    if (buckets.length && !buckets.every(b => merged.current.has(b))) apply();
  }, [dataVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  const anchor = mapCenter ? `${mapCenter.lat.toFixed(1)},${mapCenter.lng.toFixed(1)}` : '';
  useEffect(() => {
    if (!on) return;
    const ctrl = new AbortController();
    const load = async () => {
      const c = centre.current;
      if (!c || document.hidden) return;
      try {
        const res = await fetch(`/api/flights/nearby?lat=${c.lat.toFixed(3)}&lon=${c.lng.toFixed(3)}`, { signal: ctrl.signal, cache: 'no-store' });
        if (!res.ok) return;
        const body = await res.json() as { flights?: Record<string, unknown>[]; at?: string | null };
        const at = body.at ? Date.parse(body.at) : NaN;
        if (!body.flights?.length || !Number.isFinite(at) || at === nearby.current?.at) return;
        nearby.current = { at, rows: body.flights };
        apply();
      } catch (e) {
        if (!ctrl.signal.aborted) console.warn('[TAKIP] Nearby flights failed:', e instanceof Error ? e.message : e);
      }
    };
    load();
    const id = setInterval(load, POLL_MS);
    return () => { ctrl.abort(); clearInterval(id); };
  }, [on, anchor]); // eslint-disable-line react-hooks/exhaustive-deps
}
