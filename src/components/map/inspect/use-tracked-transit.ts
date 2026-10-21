'use client';

import { useEffect, useState } from 'react';
import type { MapRef } from '@/components/map/types';
import { setTransitRoutes, setTransitTrails, setTransitTracked } from '@/lib/feeds/transit/map-layers';
import { alongShape, MAX_OFF_M, metres, pointAlong, project, type LngLat, type OnShape } from '@/lib/feeds/transit/placement/snap';
import { TRANSIT_TRACK_MS, type TransitResponse, type TransitStop } from '@/lib/feeds/transit/view';
import type { TransitTarget } from './types';
import { isFollowed } from './use-follow';

export type LiveTransit = Omit<TransitTarget, 'kind' | 'id'>;

export interface TrackedTransit {
  live: LiveTransit | null;
  /** Where the marker has come to rest, on the route where possible. */
  shown: { lat: number; lng: number } | null;
}

/** Half the box asked for around the vehicle: a train at 120 km/h covers ~0.3 km between polls. */
const BOX = 0.04;
const MAX_TRAIL = 2_000;
/** A new fix is reached over this long, along the route, instead of in one jump. */
const GLIDE_MS = 3_000;

// Every tracked vehicle's trail and marker, drawn as one source each.
const trails = new Map<string, LngLat[]>();
const markers = new Map<string, { at: LngLat; bearing: number | null; mode?: TransitTarget['mode']; estimated?: boolean }>();

function draw(mapRef: MapRef) {
  const map = mapRef.current;
  if (!map) return;
  // Each trail runs up to its marker, so it grows behind the vehicle as it glides.
  setTransitTrails(map, [...trails].map(([key, t]) => (markers.has(key) ? [...t, markers.get(key)!.at] : t)));
  setTransitTracked(map, [...markers].map(([key, m]) => ({ key, ...m })));
}

const feedOf = (key: string) => key.slice(0, key.indexOf(':'));

/**
 * Keeps one vehicle current while its window is open, at any zoom and with the layer off: a small box
 * around its last position, so only the feed or two covering it are read. Between fixes it moves along
 * its trip's shape from the static GTFS, or along the roads for a bus feed without shapes.
 */
export function useTrackedTransit(mapRef: MapRef, target: TransitTarget | null): TrackedTransit {
  const [live, setLive] = useState<LiveTransit | null>(null);
  const [shown, setShown] = useState<{ lat: number; lng: number } | null>(null);
  const key = target?.id ?? null;
  const startLng = target?.lng, startLat = target?.lat;
  const startTrip = target?.trip, startBearing = target?.bearing;
  const startMode = target?.mode, startEstimated = target?.estimated;

  useEffect(() => {
    if (!key || startLng == null || startLat == null) return;
    const feed = feedOf(key);
    const abort = new AbortController();
    let fix: LngLat = [startLng, startLat];
    let at: LngLat = fix;
    let bearing: number | null = startBearing ?? null;
    let look = { mode: startMode, estimated: startEstimated };
    let shape: LngLat[] | null = null;
    let stops: TransitStop[] | null = null;
    let onShape: OnShape | null = null;
    let road = false;
    let shapeTrip: string | null | undefined;
    // The trip `shape` was loaded for: a new trip's stops wait for its shape.
    let drawnTrip: string | null | undefined;
    let frame = 0;
    let next: ReturnType<typeof setTimeout> | undefined;

    const place = (p: LngLat, b: number | null) => {
      at = p;
      bearing = b ?? bearing;
      markers.set(key, { at, bearing, ...look });
      draw(mapRef);
    };
    const settle = () => setShown({ lng: at[0], lat: at[1] });
    trails.set(key, []);
    place(fix, bearing);

    // Apart from place(), which runs every animation frame: a route only changes with its trip.
    const showRoute = (on = true) => {
      if (mapRef.current) setTransitRoutes(mapRef.current, `tracked:${key}`, on ? [{ shape, stops: drawnTrip === shapeTrip ? stops : null, mode: look.mode }] : null);
    };

    const loadStops = async (trip: string) => {
      const res = await fetch(`/api/transit/stops?feed=${encodeURIComponent(feed)}&trip=${encodeURIComponent(trip)}`, { signal: abort.signal });
      const body = res.ok ? (await res.json()) as { stops: TransitStop[] | null } : null;
      if (!body || trip !== shapeTrip) return;
      stops = body.stops;
      showRoute();
    };

    const loadShape = async (trip: string | undefined) => {
      if (trip === shapeTrip) return;
      shapeTrip = trip ?? null;
      stops = null;
      // Stops take a scan of the feed's timetable, so the line doesn't wait for them.
      if (trip) void loadStops(trip).catch(() => {});
      const res = await fetch(`/api/transit/shape?feed=${encodeURIComponent(feed)}${trip ? `&trip=${encodeURIComponent(trip)}` : ''}`, { signal: abort.signal });
      if (!res.ok || trip !== (shapeTrip ?? undefined)) return;
      const body = await res.json() as { shape: LngLat[] | null; road: boolean };
      shape = body.shape;
      road = body.road;
      onShape = null;
      drawnTrip = shapeTrip;
      showRoute();
      const p = shape && project(shape, fix);
      if (p && p.off <= MAX_OFF_M) {
        onShape = p;
        place(p.at, bearing);
      }
    };

    const roadPath = async (a: LngLat, b: LngLat): Promise<LngLat[] | null> => {
      const res = await fetch(`/api/transit/path?feed=${encodeURIComponent(feed)}&from=${a.join(',')}&to=${b.join(',')}`, { signal: abort.signal });
      return res.ok ? ((await res.json()) as { path: LngLat[] | null }).path : null;
    };

    const glide = (path: LngLat[], feedBearing: number | null) => new Promise<void>(done => {
      cancelAnimationFrame(frame);
      const end = path[path.length - 1];
      // A hidden tab never runs animation frames: go straight there.
      if (document.hidden || path.length < 2 || metres(path[0], end) < 1) {
        place(end, feedBearing);
        done();
        return;
      }
      const t0 = performance.now();
      const step = (now: number) => {
        const share = Math.min(1, (now - t0) / GLIDE_MS);
        const p = pointAlong(path, share);
        place(p.at, feedBearing ?? p.bearing);
        if (isFollowed(`transit:${key}`)) mapRef.current?.jumpTo({ center: p.at });
        if (share < 1 && !abort.signal.aborted) frame = requestAnimationFrame(step);
        else done();
      };
      frame = requestAnimationFrame(step);
    });

    const moveTo = async (to: LngLat, feedBearing: number | null) => {
      let path: LngLat[] | null = null;
      const along = shape && alongShape(shape, fix, to, onShape);
      if (along) {
        path = along.path;
        onShape = along.end;
      } else {
        onShape = null;
        if (road) path = await roadPath(at, to).catch(() => null);
      }
      path ??= [at, to];
      if (metres(path[0], at) > 1) path = [at, ...path];
      fix = to;
      const trail = trails.get(key);
      await glide(path, feedBearing);
      if (trail) {
        trail.push(...(trail.length ? path.slice(1) : path));
        if (trail.length > MAX_TRAIL) trail.splice(0, trail.length - MAX_TRAIL);
      }
      draw(mapRef);
      settle();
    };

    const poll = async () => {
      const started = Date.now();
      if (!document.hidden) {
        const [lng, lat] = fix;
        try {
          const res = await fetch(`/api/transit?bbox=${[lng - BOX, lat - BOX, lng + BOX, lat + BOX].map(v => v.toFixed(4)).join(',')}`, { signal: abort.signal });
          const data = res.ok ? (await res.json() as TransitResponse) : null;
          const v = data?.vehicles.find(x => x.key === key);
          if (data && v) {
            const { key: _key, feed: index, ...rest } = v; // eslint-disable-line @typescript-eslint/no-unused-vars
            setLive({ ...rest, feed: data.feeds[index]?.name, license: data.feeds[index]?.license });
            look = { mode: v.mode, estimated: v.estimated };
            await loadShape(v.trip).catch(() => {});
            if (v.lng !== fix[0] || v.lat !== fix[1]) await moveTo([v.lng, v.lat], v.bearing ?? null);
          }
        } catch {
          // Aborted on close, or a failed poll: the window keeps the last position and its age.
        }
      }
      // The glide is part of the wait, so a fix is still asked for every TRANSIT_TRACK_MS.
      if (!abort.signal.aborted) next = setTimeout(poll, Math.max(1_000, TRANSIT_TRACK_MS - (Date.now() - started)));
    };

    void loadShape(startTrip).catch(() => {}).finally(settle);
    next = setTimeout(poll, TRANSIT_TRACK_MS / 2);
    return () => {
      abort.abort();
      cancelAnimationFrame(frame);
      clearTimeout(next);
      trails.delete(key);
      markers.delete(key);
      draw(mapRef);
      showRoute(false);
    };
  }, [key, startLng, startLat, startTrip, startBearing, startMode, startEstimated, mapRef]);

  return { live, shown };
}
