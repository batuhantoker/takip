import { deserializeShapes, serializeShapes, STORAGE_KEY as AREAS_KEY } from '@/lib/areas/aoi-export';
import { DEFAULT_LAYERS } from '@/lib/layers/defaults';
import { parseWatchlist, WATCHLIST_KEY } from '@/lib/markets/markets';
import { parseRecent } from '@/lib/places/recent-places';
import { parseLayers } from '@/lib/layers/saved';
import type { PartRegistry } from './parts';
import { STATE_VERSION, type PartName, type StoredArea, type StoredPlace, type WorkspaceStateV1 } from './state';

// The keys src/lib/layers/saved.ts and src/lib/places/recent-places.ts keep to themselves.
const LAYERS_KEY = 'takip.layers';
const RECENT_KEY = 'takip.recent-places';

/** What this device keeps in localStorage, as the parts the page would register: read straight from storage. */
export const deviceReaders = {
  layers: (storage: Storage) => {
    const layers = parseLayers(storage.getItem(LAYERS_KEY), DEFAULT_LAYERS);
    return Object.keys(layers).length ? layers : undefined;
  },
  // Through the area store's own parser, so a malformed entry is dropped rather than saved.
  areas: (storage: Storage) => {
    const shapes = deserializeShapes(storage.getItem(AREAS_KEY));
    return shapes.length ? (JSON.parse(serializeShapes(shapes)) as StoredArea[]) : undefined;
  },
  recentPlaces: (storage: Storage) => {
    const places = parseRecent(storage.getItem(RECENT_KEY));
    return places.length ? (places as StoredPlace[]) : undefined;
  },
  watchlist: (storage: Storage) => {
    const symbols = parseWatchlist(storage.getItem(WATCHLIST_KEY));
    return symbols.length ? symbols : undefined;
  },
} satisfies Partial<Record<PartName, (storage: Storage) => unknown>>;

const KEYS: Record<keyof typeof deviceReaders, string> = { layers: LAYERS_KEY, areas: AREAS_KEY, recentPlaces: RECENT_KEY, watchlist: WATCHLIST_KEY };
export const DEVICE_KEYS = Object.values(KEYS);

/** This device's saved layers, areas, recent places and watchlist as a workspace state. */
export function readDeviceState(storage: Storage): WorkspaceStateV1 {
  const state: Record<string, unknown> = { v: STATE_VERSION };
  for (const [name, read] of Object.entries(deviceReaders)) {
    const value = read(storage);
    if (value !== undefined) state[name] = value;
  }
  return state as WorkspaceStateV1;
}

export const hasDeviceState = (storage: Storage) => Object.keys(readDeviceState(storage)).length > 1;

/**
 * Fallback parts for what the page hasn't registered. Applying one writes localStorage: the panel that owns
 * the key picks it up the next time it loads it.
 */
export function registerStoredParts(registry: PartRegistry, storage: Storage) {
  const offs = (Object.keys(deviceReaders) as (keyof typeof deviceReaders)[]).map(name =>
    registry.register(name, {
      get: () => deviceReaders[name](storage),
      set: (value: unknown) => {
        try {
          storage.setItem(KEYS[name], JSON.stringify(value));
        } catch {
          // Storage full or blocked: the part just doesn't persist here.
        }
      },
    }, { fallback: true }),
  );
  return () => offs.forEach(off => off());
}
