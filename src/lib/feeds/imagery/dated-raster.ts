import type * as maplibregl from 'maplibre-gl';

/*
 * A raster whose tiles depend on a date, changed without a blank frame: the new date loads in a hidden
 * twin, and the two trade places once its tiles are in. setTiles on one source would empty the map
 * for every step of History playback.
 */

export interface DatedRasterOptions {
  id: string;
  maxzoom: number;
  attribution: string;
  /** Called when the twins are first added, so they take the imagery slot of the current base map. */
  before: () => string | undefined;
  opacity?: number;
  /** Only tiles inside [w, s, e, n] are fetched. */
  bounds?: [number, number, number, number];
  /** 256 unless the upstream serves bigger tiles, which take fewer requests a screen. */
  tileSize?: number;
}

export interface DatedRaster {
  /** Draws the tiles at this URL template, or nothing for null. */
  show(url: string | null): void;
  destroy(): void;
}

/** How long a swap waits for the new tiles; a missing frame shows as missing rather than holding the old one. */
const SWAP_TIMEOUT_MS = 5000;

export function datedRaster(map: maplibregl.Map, o: DatedRasterOptions): DatedRaster {
  const ids = [`${o.id}-a`, `${o.id}-b`];
  const opacity = o.opacity ?? 1;
  let front = 0;
  /** Drawn by the front twin. */
  let shown: string | null = null;
  /** Loading in the back twin. */
  let loading: string | null = null;
  /** Asked for while the back twin was busy; only the newest is kept, so fast playback steps as tiles allow. */
  let queued: string | null | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const hide = (i: number) => {
    if (!map.getLayer(ids[i])) return;
    map.setPaintProperty(ids[i], 'raster-opacity', 0);
    map.setLayoutProperty(ids[i], 'visibility', 'none');
  };

  // Both twins go in at once, so their order against other dated rasters never changes.
  const install = (url: string) => {
    const before = o.before();
    for (const id of ids) {
      if (!map.getSource(id)) {
        map.addSource(id, { type: 'raster', tiles: [url], tileSize: o.tileSize ?? 256, maxzoom: o.maxzoom, attribution: o.attribution, ...(o.bounds && { bounds: o.bounds }) });
      }
      if (!map.getLayer(id)) {
        map.addLayer({ id, type: 'raster', source: id, layout: { visibility: 'none' }, paint: { 'raster-opacity': 0, 'raster-fade-duration': 0 } }, before);
      }
    }
  };

  const swap = () => {
    clearTimeout(timer);
    const back = 1 - front;
    if (loading === null) return;
    if (!map.getLayer(ids[back])) {
      loading = null;
      queued = undefined;
      return;
    }
    map.setPaintProperty(ids[back], 'raster-opacity', opacity);
    hide(front);
    front = back;
    shown = loading;
    loading = null;
    if (queued !== undefined) {
      const next = queued;
      queued = undefined;
      show(next);
    }
  };

  // A tile event, so a just-emptied source that counts as loaded doesn't swap in a blank picture.
  const onData = (e: maplibregl.MapSourceDataEvent) => {
    if (loading !== null && e.sourceId === ids[1 - front] && e.tile && map.isSourceLoaded(e.sourceId)) swap();
  };
  map.on('sourcedata', onData);

  function show(url: string | null) {
    if (url === null) {
      clearTimeout(timer);
      loading = null;
      queued = undefined;
      hide(0);
      hide(1);
      shown = null;
      return;
    }
    if (loading !== null) {
      queued = url === loading ? undefined : url;
      return;
    }
    if (url === shown) return;
    if (!map.getLayer(ids[0])) install(url);
    const back = 1 - front;
    const source = map.getSource(ids[back]) as maplibregl.RasterTileSource;
    const fresh = source.tiles?.[0] !== url;
    if (fresh) source.setTiles([url]);
    map.setLayoutProperty(ids[back], 'visibility', 'visible');
    loading = url;
    timer = setTimeout(swap, SWAP_TIMEOUT_MS);
    // The twin already holds this date's tiles, so no tile event may come.
    if (!fresh) map.once('idle', () => { if (loading === url) swap(); });
  }

  return {
    show,
    destroy() {
      clearTimeout(timer);
      loading = null;
      map.off('sourcedata', onData);
      for (const id of ids) {
        if (map.getLayer(id)) map.removeLayer(id);
        if (map.getSource(id)) map.removeSource(id);
      }
    },
  };
}
