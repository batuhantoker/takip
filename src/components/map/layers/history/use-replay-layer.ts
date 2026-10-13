'use client';

import { useEffect, useRef } from 'react';
import { lodForZoom } from '@takip/core/tracks';
import { chunkUrls, lodBucketS, type ReplaySession, type ReplayTrack } from '@/lib/replay/session';
import { BRIDGE_S, createReplayTrackLayer, HOLD_S, type ReplayEntity, TRAIL_S } from '@/lib/replay/track-layer';
import { SHIP_CLASSES, SHIP_FALLBACK_COLOR, SHIPS_UNDERWAY, UNDERWAY_KNOTS } from '@/lib/ships/filter';
import type { MapRef, WorldMapProps } from '@/components/map/types';

/* Ships and aircraft at the replay clock's time, through one WebGL layer, in the live layers' colours. */

const LAYER_ID = 'replay-tracks';

/** Which Layers toggle shows each aircraft category, as on the live map. */
const AIRCRAFT_TOGGLES: Record<string, string> = { commercial: 'flights', private: 'private', jet: 'jets', military: 'military' };

/** The Layers toggles decide what replays, exactly as they decide what shows live. */
function replayed(layers: Record<string, boolean>) {
  const aircraft = Object.entries(AIRCRAFT_TOGGLES).filter(([, key]) => layers[key]).map(([cat]) => cat);
  return { ships: Boolean(layers.maritime), aircraft };
}

/** The live map's ship-type and "underway" toggles, as a predicate (the layer isn't styled by expressions). */
function filterFor(layers: Record<string, boolean>) {
  const { ships, aircraft } = replayed(layers);
  const planes = new Set(aircraft);
  const shipTypes = new Set<string>(SHIP_CLASSES.filter(c => layers[c.key] !== false).map(c => c.type));
  const underway = Boolean(layers[SHIPS_UNDERWAY]);
  return (e: ReplayEntity, speedKn: number) =>
    e.cls === 'aircraft' ? planes.has(e.category) : ships && shipTypes.has(e.category) && (!underway || speedKn >= UNDERWAY_KNOTS);
}

const rgb = (css: string, fallback: string): [number, number, number] => {
  const hex = /^#([0-9a-f]{6})$/i.exec(css.trim())?.[1] ?? fallback.slice(1);
  return [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
};

function colorsFor() {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => rgb(css.getPropertyValue(name), fallback);
  const aircraft: Record<string, [number, number, number]> = {
    commercial: v('--map-flight-civil', '#00e5ff'),
    private: v('--map-flight-private', '#ffd700'),
    jet: v('--map-flight-gov', '#ff9500'),
    military: v('--map-flight-military', '#ff0000'),
  };
  const ships = Object.fromEntries(SHIP_CLASSES.map(c => [c.type, rgb(c.color, SHIP_FALLBACK_COLOR)]));
  return (cls: ReplayTrack['cls'], category: string) =>
    cls === 'aircraft' ? aircraft[category] ?? aircraft.commercial : ships[category] ?? rgb(SHIP_FALLBACK_COLOR, SHIP_FALLBACK_COLOR);
}

/** Segments grouped by entity, in time order; category and label from the latest. */
function toEntities(tracks: ReplayTrack[], color: ReturnType<typeof colorsFor>): ReplayEntity[] {
  const byId = new Map<number, ReplayEntity>();
  const latest = new Map<number, number>();
  for (const t of tracks) {
    let e = byId.get(t.entity);
    if (!e) byId.set(t.entity, (e = { entity: t.entity, cls: t.cls, category: t.category, label: t.label, segs: [], color: [0, 0, 0] }));
    e.segs.push(t.track);
    if (t.track.t[0] > (latest.get(t.entity) ?? -Infinity)) {
      latest.set(t.entity, t.track.t[0]);
      e.category = t.category;
      e.label = t.label || e.label;
    }
  }
  for (const e of byId.values()) {
    e.segs.sort((a, b) => a.t[0] - b.t[0]);
    e.color = color(e.cls, e.category);
  }
  return [...byId.values()];
}

export function useReplayLayer({ mapRef, mapReady, replay, activeLayers }: {
  mapRef: MapRef;
  mapReady: boolean;
  replay: ReplaySession | null;
  activeLayers: WorldMapProps['activeLayers'];
}) {
  const layersRef = useRef(activeLayers);
  const refilterRef = useRef<() => void>(() => {});

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !replay) return;
    let shown = 0;
    const layer = createReplayTrackLayer(LAYER_ID, { onCount: n => { shown = n; } });
    map.addLayer(layer);
    const color = colorsFor();
    layer.setFilter(filterFor(layersRef.current));

    let wanted = '';
    let generation = 0;
    let lastBucket = Number.NaN;
    let zoomIn = false;
    let retry: ReturnType<typeof setTimeout> | undefined;

    const load = () => {
      const manifest = replay.manifest();
      if (!manifest) return;
      const shownNow = replayed(layersRef.current);
      const classes: ('vessel' | 'aircraft')[] = [];
      if (shownNow.ships) classes.push('vessel');
      if (shownNow.aircraft.length) classes.push('aircraft');
      const lod = lodForZoom(map.getZoom());
      const b = map.getBounds();
      const t = replay.clock.time() / 1000;
      // Back far enough to hold or bridge from, and ahead far enough to bridge to.
      const ahead = BRIDGE_S + (replay.clock.playing() ? lodBucketS(lod) : 0);
      const urls = chunkUrls(manifest, lod, { w: b.getWest(), s: b.getSouth(), e: b.getEast(), n: b.getNorth() }, t - Math.max(HOLD_S, BRIDGE_S) - TRAIL_S, t + ahead, classes);
      zoomIn = urls === null;
      const key = urls ? urls.join('|') : '';
      if (key === wanted) return;
      wanted = key;
      const mine = ++generation;
      if (!urls?.length) {
        layer.setEntities([]);
        return;
      }
      replay.tracks(urls).then(({ tracks, retryAfterMs }) => {
        if (mine !== generation) return;
        layer.setEntities(toEntities(tracks, color));
        // Rate-limited chunks: ask again once allowed; the cache keeps the ones that arrived.
        if (retryAfterMs) {
          clearTimeout(retry);
          retry = setTimeout(() => {
            wanted = '';
            load();
          }, retryAfterMs);
        }
      });
    };

    const onClock = () => {
      const t = replay.clock.time() / 1000;
      layer.setTime(t);
      const bucket = Math.floor(t / lodBucketS(lodForZoom(map.getZoom())));
      if (bucket !== lastBucket) {
        lastBucket = bucket;
        load();
      }
    };
    refilterRef.current = () => {
      layer.setFilter(filterFor(layersRef.current));
      load();
    };

    // The timeline shows what is drawn; twice a second is plenty, and keeps the page from re-rendering per frame.
    const stats = setInterval(() => {
      const manifest = replay.manifest();
      const recorded = manifest?.tracks.lods.some(l => l.buckets.length > 0);
      const early = manifest && replay.clock.time() < manifest.limits.earliest * 1000;
      const selected = replayed(layersRef.current);
      const none = !selected.ships && !selected.aircraft.length;
      replay.setStats({ shown, state: !manifest ? 'loading' : none ? 'nothing_selected' : early ? 'before_window' : zoomIn ? 'zoom_in' : !recorded ? 'nothing_recorded' : 'ok' });
    }, 500);

    const unclock = replay.clock.subscribe(onClock);
    const unsession = replay.subscribe(load);
    map.on('moveend', load);
    onClock();
    return () => {
      generation++;
      clearTimeout(retry);
      clearInterval(stats);
      unclock();
      unsession();
      map.off('moveend', load);
      refilterRef.current = () => {};
      try {
        if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
      } catch {
        // The map itself was removed (a theme change remounts it), taking its layers with it.
      }
    };
  }, [mapRef, mapReady, replay]);

  useEffect(() => {
    layersRef.current = activeLayers;
    refilterRef.current();
  }, [activeLayers]);
}
