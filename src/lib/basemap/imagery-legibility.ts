import type * as maplibregl from 'maplibre-gl';
import { BASEMAP_SOURCE } from '@/lib/basemap/provider';
import { MAP_INK } from '@/lib/map/tokens';

export type Ground = 'dark' | 'satellite' | 'topo';

type Layer = { id: string; type: string; source?: unknown };

/** Detail a photo already shows or that only clutters it: land fills, rails, ferries, shops, house numbers. */
const OFF_ON_PHOTO = /^(detail-(ice|rock-sand|industrial|military|ferry|rail|transit|poi|park-label)$|poi_|housenumber)/;

/** On imagery every label steps up one ink. */
const LIFT: Record<string, string> = {
  [MAP_INK.ink3.toLowerCase()]: MAP_INK.ink2,
  [MAP_INK.ink2.toLowerCase()]: MAP_INK.ink1,
};

const isBase = (l: Layer) => l.source === BASEMAP_SOURCE;

/** Where satellite imagery goes: over the base map's ground and roads, under its borders and names. */
export function photoBefore(map: maplibregl.Map): string | undefined {
  const layers = (map.getStyle().layers ?? []) as Layer[];
  return layers.find(l => l.id.startsWith('boundary_country'))?.id
    ?? layers.find(l => l.type === 'symbol' && isBase(l))?.id
    ?? (map.getLayer('day-night-fill') ? 'day-night-fill' : undefined);
}

/** Where a raster with its own names (Topo) goes: over the whole base map, under every overlay. */
export function rasterBefore(map: maplibregl.Map): string | undefined {
  const layers = (map.getStyle().layers ?? []) as Layer[];
  return layers.find(l => l.type !== 'background' && !isBase(l) && !l.id.endsWith('-layer'))?.id;
}

interface State { ground: Ground; seen: Set<string>; undo: (() => void)[] }
const states = new WeakMap<maplibregl.Map, State>();

/** Paint and visibility that keep markers and names legible on bright ground; undone on the way back to dark. */
export function setGround(map: maplibregl.Map, ground: Ground) {
  let st = states.get(map);
  if (!st) {
    const fresh: State = { ground: 'dark', seen: new Set(), undo: [] };
    states.set(map, fresh);
    // Overlays added later (history, war, hiking…) get the same treatment.
    map.on('styledata', () => { if (fresh.ground !== 'dark') adjust(map, fresh); });
    st = fresh;
  }
  if (st.ground === ground) return;
  for (const u of st.undo.splice(0).reverse()) u();
  st.seen.clear();
  st.ground = ground;
  if (ground !== 'dark') adjust(map, st);
}

function adjust(map: maplibregl.Map, st: State) {
  const photo = st.ground === 'satellite';
  type Paint = Parameters<maplibregl.Map['setPaintProperty']>;
  const set = (id: string, prop: Paint[1], value: Paint[2]) => {
    const before = map.getPaintProperty(id, prop);
    map.setPaintProperty(id, prop, value);
    st.undo.push(() => { if (map.getLayer(id)) map.setPaintProperty(id, prop, before); });
  };
  for (const l of (map.getStyle().layers ?? []) as Layer[]) {
    if (st.seen.has(l.id)) continue;
    st.seen.add(l.id);
    if (photo && OFF_ON_PHOTO.test(l.id) && map.getLayoutProperty(l.id, 'visibility') !== 'none') {
      map.setLayoutProperty(l.id, 'visibility', 'none');
      st.undo.push(() => { if (map.getLayer(l.id)) map.setLayoutProperty(l.id, 'visibility', 'visible'); });
      continue;
    }
    if (l.type !== 'symbol') continue;
    // A photo already shows the lie of the land; only name the peaks once they stand apart.
    if (photo && l.id === 'detail-peak') {
      const { minzoom = 0, maxzoom = 24 } = map.getLayer(l.id) ?? {};
      map.setLayerZoomRange(l.id, Math.max(minzoom, 10), maxzoom);
      st.undo.push(() => { if (map.getLayer(l.id)) map.setLayerZoomRange(l.id, minzoom, maxzoom); });
    }
    // Topo draws its own names over ours; only the overlays need help there.
    if (isBase(l) && !photo) continue;
    if (map.getLayoutProperty(l.id, 'text-field') !== undefined) {
      const color = map.getPaintProperty(l.id, 'text-color');
      if (typeof color === 'string' && LIFT[color.toLowerCase()]) set(l.id, 'text-color', LIFT[color.toLowerCase()]);
      else if (isBase(l) && l.id.startsWith('place_')) set(l.id, 'text-color', MAP_INK.ink1);
      const halo = map.getPaintProperty(l.id, 'text-halo-width');
      if (halo === undefined || typeof halo === 'number') {
        set(l.id, 'text-halo-color', MAP_INK.surface0);
        set(l.id, 'text-halo-width', Math.max(typeof halo === 'number' ? halo : 0, 1.8));
        set(l.id, 'text-halo-blur', 0.3);
      }
    }
    // SDF icons (ship arrows, wind) take a halo; plain images carry their own rim.
    if (map.getPaintProperty(l.id, 'icon-color') !== undefined) {
      set(l.id, 'icon-halo-color', MAP_INK.surface0);
      set(l.id, 'icon-halo-width', 1);
    }
  }
}
