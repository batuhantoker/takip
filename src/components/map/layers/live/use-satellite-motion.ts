'use client';

import { useEffect, type Dispatch, type RefObject, type SetStateAction } from 'react';
import type { SatelliteDetail } from '@/components/map/inspect/cards/satellite-inspect';
import { isWatched } from '@/components/map/inspect/track-request';
import { isFollowed } from '@/components/map/inspect/use-follow';
import type { MapRef, SatelliteLayer, SatelliteRow } from '@/components/map/types';
import { satColorFor, type MapPalette } from '@/lib/map/style/palette';
import { TRACKING_MOVE } from '@/lib/map/camera/tracking-moves';
import type { ReplayClock } from '@/lib/map/replay/clock';
import type { ReplaySession } from '@/lib/map/replay/session';
import { chaseCentre } from '@/lib/feeds/satellites/chase';
import { displayElevation, parseColor } from '@/lib/feeds/satellites/points';
import { createKeyframes, SAMPLE_STRIDE, sampleKeys, sampleLat, sampleLng } from '@/lib/feeds/satellites/motion';
import { orbitalPeriodMinutes, orbitPath, splitAtAntimeridian } from '@/lib/feeds/satellites/orbit';
import { createSatPropagator } from '@/lib/feeds/satellites/propagate-client';

type MotionClock = Pick<ReplayClock, 'time' | 'playing' | 'speed'>;
const LIVE: MotionClock = { time: () => Date.now(), playing: () => true, speed: () => 1 };

/** While playing, the rows that picking and the hover tip read catch up this often (wall ms). */
const ROWS_EVERY_MS = 250;
/** While playing, the selected satellite's card moves this often: each new 0.1° cell below it is a Nominatim lookup. */
const CARD_EVERY_MS = 2000;
/** The selected orbit is redrawn, centred on the satellite again, after this much of a revolution. */
const ORBIT_REDRAW = 1 / 8;
/*
 * MapLibre only renders when something changes, so the satellites move when a low one would have gone
 * half a pixel: about once a second over the whole globe at real time, every frame in fast replay.
 */
const LEO_KM_S = 7.8;
const MAX_STEP_MS = 1000;
/** Following, the camera tilts in over this long to look down on the satellite from behind it. */
const RIDE_IN_MS = 1200;
const RIDE_PITCH = 60;
const RIDE_ZOOM = 5.5;
const RIDE_ZOOM_HIGH = 4.5;
/** Drawn higher than this (MEO and GEO), the ride stands further back so the satellite isn't up against the lens. */
const HIGH_ELEV_M = 1_500_000;

/**
 * Satellites move with the clock, the replay's or real time: SGP4 in a worker at keyframes, interpolated
 * as they are drawn. Following one rides it: the camera keeps it at the middle of the view as the Earth
 * turns under it.
 */
export function useSatelliteMotion({ mapRef, replay, satLayerRef, satRowsRef, satPickedRef, satSelectedIdRef, satEpochRef, paletteRef, setSelectedSat, clearSat }: {
  mapRef: MapRef;
  replay: ReplaySession | null;
  satLayerRef: RefObject<SatelliteLayer | null>;
  satRowsRef: RefObject<SatelliteRow[]>;
  satPickedRef: RefObject<number | null>;
  satSelectedIdRef: RefObject<string | null>;
  satEpochRef: RefObject<number | null>;
  paletteRef: RefObject<MapPalette>;
  setSelectedSat: Dispatch<SetStateAction<SatelliteDetail | null>>;
  clearSat: () => void;
}) {
  useEffect(() => {
    const clock: MotionClock = replay?.clock ?? LIVE;
    const propagator = createSatPropagator();
    const keys = createKeyframes();
    let rows: SatelliteRow[] | null = null;
    let ready = false;
    let generation = 0;
    let pending = false;
    // A keyframe's round trip, so one asked for after a jump lands about when the clock reaches it.
    let leadMs = 50;
    let out = new Float32Array(0);
    let changed = false;
    let drawnT = Number.NaN;
    let drawnAt = 0;
    let rowsAt = 0;
    let cardAt = 0;
    let orbit: { id: string; t: number; period: number } | null = null;
    let ride: { id: string; start: number; from: { zoom: number; pitch: number }; to: { zoom: number; pitch: number } } | null = null;
    let frame = 0;

    const tick = () => {
      frame = requestAnimationFrame(tick);
      const current = satRowsRef.current;
      if (current !== rows) {
        rows = current;
        generation++;
        keys.clear();
        out = new Float32Array(rows.length * SAMPLE_STRIDE);
        // Rows without element sets (an older answer) stay where they were placed.
        ready = rows.length > 0 && rows.every(r => r.line1 && r.line2);
        if (ready) propagator.set(rows.map(r => [r.line1!, r.line2!]));
      }
      const layer = satLayerRef.current;
      const map = mapRef.current;
      if (!ready || !layer || !map) return;
      const t = clock.time();
      const playing = clock.playing();
      const speed = clock.speed();

      if (!pending) {
        const want = keys.next(t, playing, speed, leadMs);
        if (want) {
          pending = true;
          const mine = generation;
          const sent = performance.now();
          propagator.at(want.t).then(key => {
            pending = false;
            if (mine !== generation) return;
            leadMs += (performance.now() - sent - leadMs) * 0.3;
            keys.add(key, want.follows);
            changed = true;
          }, () => { pending = false; });
        }
      }

      const pair = keys.around(t);
      if (!pair) return;
      const id = satSelectedIdRef.current;
      const i = satPickedRef.current;
      const row = i === null ? undefined : current[i];
      const selected = id && row && row.noradId === id ? i : null;
      const following = selected !== null && isFollowed(`satellite:${id}`);
      const now = performance.now();
      const kmPerPx = 40_075 / (512 * 2 ** map.getZoom());
      const stepMs = following ? 0 : Math.min(MAX_STEP_MS, (500 * kmPerPx) / (LEO_KM_S * speed));

      if (changed || (t !== drawnT && now - drawnAt >= stepMs)) {
        changed = false;
        drawnT = t;
        drawnAt = now;
        sampleKeys(pair[0], pair[1], t, out);
        layer.setPositions(out);
        satEpochRef.current = t;
        if (!playing || now - rowsAt >= ROWS_EVERY_MS) {
          rowsAt = now;
          for (let k = 0; k < current.length; k++) {
            if (Number.isNaN(out[k * SAMPLE_STRIDE])) continue;
            current[k].lng = sampleLng(out, k);
            current[k].lat = sampleLat(out, k);
            current[k].alt = Math.round(out[k * SAMPLE_STRIDE + 2]);
          }
        }
        // Out of its orbit data's reach, the selected satellite has nowhere to be: its card closes.
        if (selected !== null && Number.isNaN(out[selected * SAMPLE_STRIDE])) clearSat();
        else if (selected !== null) {
          if (orbit?.id !== id || Math.abs(t - orbit.t) > orbit.period * 60_000 * ORBIT_REDRAW) {
            const period = orbitalPeriodMinutes(row!.line2!);
            if (period) {
              orbit = { id: id!, t, period };
              const path = orbitPath(row!.line1!, row!.line2!, 180, new Date(t - period * 30_000));
              layer.setOrbit(splitAtAntimeridian(path), parseColor(satColorFor(row!.category, row!.color, paletteRef.current)));
            }
          }
          if (!playing || now - cardAt >= CARD_EVERY_MS) {
            cardAt = now;
            const lat = sampleLat(out, selected);
            const lng = sampleLng(out, selected);
            const alt = Math.round(out[selected * SAMPLE_STRIDE + 2]);
            // The orbit here is drawn from the same element sets, so it is ready whatever the orbit route said.
            const track = orbit ? { track: 'ready' as const, periodMinutes: orbit.period } : {};
            setSelectedSat(prev => (prev && prev.noradId === id ? { ...prev, lat, lng, alt, ...track } : prev));
          }
        }
      }
      if (selected === null) orbit = null;

      if (selected === null || !following || Number.isNaN(out[selected * SAMPLE_STRIDE])) {
        ride = null;
        return;
      }
      const elevM = displayElevation(out[selected * SAMPLE_STRIDE + 2], layer.exaggeration());
      const globe = /globe|vertical-perspective/.test(JSON.stringify(map.getProjection()?.type ?? ''));
      if (ride?.id !== id) {
        const from = { zoom: map.getZoom(), pitch: map.getPitch() };
        // Flat, the satellite's height isn't along the line of sight, so tilting would push it off centre.
        ride = { id: id!, start: now, from, to: isWatched(`satellite:${id}`)
          ? { zoom: from.zoom, pitch: 0 }
          : { zoom: elevM > HIGH_ELEV_M ? RIDE_ZOOM_HIGH : RIDE_ZOOM, pitch: globe ? RIDE_PITCH : from.pitch } };
      }
      const k = Math.min(1, (now - ride.start) / RIDE_IN_MS);
      const e = k * k * (3 - 2 * k);
      const zoom = k < 1 ? ride.from.zoom + (ride.to.zoom - ride.from.zoom) * e : map.getZoom();
      const pitch = k < 1 ? ride.from.pitch + (ride.to.pitch - ride.from.pitch) * e : map.getPitch();
      const lng = sampleLng(out, selected);
      const lat = sampleLat(out, selected);
      const center = globe
        ? chaseCentre(lng, lat, elevM, { zoom, pitch, bearing: map.getBearing(), fovDeg: map.getVerticalFieldOfView(), heightPx: map.getCanvas().clientHeight })
        : [lng, lat] as [number, number];
      map.jumpTo(k < 1 ? { center, zoom, pitch } : { center }, TRACKING_MOVE);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      propagator.dispose();
    };
  }, [replay, mapRef, satLayerRef, satRowsRef, satPickedRef, satSelectedIdRef, satEpochRef, paletteRef, setSelectedSat, clearSat]);
}
