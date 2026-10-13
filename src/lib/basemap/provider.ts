/**
 * Which server draws the base map's vector tiles. Both serve the OpenMapTiles
 * schema that public/dark-matter-style.json is written for, so switching only
 * swaps the tile source; fonts and symbols always come from OpenFreeMap.
 */
import { useSyncExternalStore } from 'react';

export type BasemapProvider = 'openfreemap' | 'carto';

/** The style's vector source id. */
export const BASEMAP_SOURCE = 'basemap';

export const BASEMAP_PROVIDERS: { id: BasemapProvider; label: string; tilejson: string }[] = [
  // Keyless, no request limits, commercial use allowed (openfreemap.org); donation-funded, no SLA.
  { id: 'openfreemap', label: 'OpenFreeMap', tilejson: 'https://tiles.openfreemap.org/planet' },
  // Wants NEXT_PUBLIC_CARTO_API_KEY (map-create.ts adds it); commercial use is free up to 1M tiles a month (basemap terms §12).
  { id: 'carto', label: 'CARTO', tilejson: 'https://tiles.basemaps.cartocdn.com/vector/carto.streets/v1/tiles.json' },
];

export const hasCartoKey = !!process.env.NEXT_PUBLIC_CARTO_API_KEY;

const STORAGE_KEY = 'takip.basemap';
const listeners = new Set<() => void>();
let current: BasemapProvider | null = null;

export function getBasemapProvider(): BasemapProvider {
  if (current) return current;
  try {
    current = localStorage.getItem(STORAGE_KEY) === 'carto' ? 'carto' : 'openfreemap';
  } catch {
    current = 'openfreemap';
  }
  return current;
}

export function setBasemapProvider(next: BasemapProvider) {
  current = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch { /* private mode: the choice lasts for this visit */ }
  for (const l of listeners) l();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => { listeners.delete(l); };
};

export const useBasemapProvider = () => useSyncExternalStore(subscribe, getBasemapProvider, () => 'openfreemap' as const);

export const tilejsonFor = (provider: BasemapProvider) =>
  (BASEMAP_PROVIDERS.find(p => p.id === provider) ?? BASEMAP_PROVIDERS[0]).tilejson;
