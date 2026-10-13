import * as maplibregl from 'maplibre-gl';
import { REFERENCE_DATASETS, type ReferenceDataset } from './catalog';
import { popupHtml, snapBox } from './view';

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
const PREFIX = 'ref-';
const MOVE_DEBOUNCE_MS = 250;

/** True for layers drawn by this module, so other click handlers can defer to them. */
export function isReferenceLayerId(id: string): boolean {
  return id.startsWith(PREFIX);
}

function layerSpecs(d: ReferenceDataset, source: string): maplibregl.LayerSpecification[] {
  const base = { source, minzoom: d.minZoom };
  if (d.geometry === 'point') {
    return [
      { ...base, id: `${source}-circle`, type: 'circle', paint: {
        'circle-color': d.color,
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 2, 8, 3.5, 12, 5, 16, 7],
        'circle-stroke-width': 0.8, 'circle-stroke-color': '#0C0E1A', 'circle-opacity': 0.9,
      } },
      { ...base, id: `${source}-label`, type: 'symbol', minzoom: Math.max(d.minZoom + 4, 9), layout: {
        'text-field': ['get', d.titleProp], 'text-size': 9, 'text-font': ['Noto Sans Regular'],
        'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-optional': true,
      }, paint: { 'text-color': d.color, 'text-halo-color': '#0C0E1A', 'text-halo-width': 1.2 } },
    ];
  }
  if (d.geometry === 'line') {
    return [{ ...base, id: `${source}-line`, type: 'line', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: {
      'line-color': d.color, 'line-opacity': 0.8,
      'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.6, 8, 1.2, 12, 2, 16, 3],
    } }];
  }
  return [
    { ...base, id: `${source}-fill`, type: 'fill', paint: { 'fill-color': d.color, 'fill-opacity': 0.12 } },
    { ...base, id: `${source}-outline`, type: 'line', paint: { 'line-color': d.color, 'line-width': 1, 'line-opacity': 0.7 } },
  ];
}

export interface ReferenceLayers {
  /** Draws the datasets switched on in `active` (keyed like the page's activeLayers) and hides the rest. */
  update(active: Record<string, boolean>): void;
  destroy(): void;
}

interface DatasetState {
  on: boolean;
  added: boolean;
  /** The request whose data is loaded or on its way; repeating it is skipped. */
  url: string | null;
  ctrl: AbortController | null;
}

/**
 * Draws the reference datasets (lib/reference/catalog) from /api/reference,
 * fetching only what the view needs whenever the map settles.
 * `beforeId` keeps them under the live layers (aircraft, ships, cameras).
 */
export function attachReferenceLayers(map: maplibregl.Map, options: { beforeId?: string } = {}): ReferenceLayers {
  const states = new Map<string, DatasetState>(REFERENCE_DATASETS.map(d => [d.id, { on: false, added: false, url: null, ctrl: null }]));
  const handlers: [string, string, (e: maplibregl.MapLayerMouseEvent) => void][] = [];
  let popup: maplibregl.Popup | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const sourceOf = (d: ReferenceDataset) => map.getSource(PREFIX + d.id) as maplibregl.GeoJSONSource | undefined;

  const add = (d: ReferenceDataset) => {
    const source = PREFIX + d.id;
    map.addSource(source, { type: 'geojson', data: EMPTY });
    const before = options.beforeId && map.getLayer(options.beforeId) ? options.beforeId : undefined;
    for (const spec of layerSpecs(d, source)) {
      map.addLayer(spec, before);
      if (spec.type === 'symbol') continue;
      const click = (e: maplibregl.MapLayerMouseEvent) => {
        const f = e.features?.[0];
        if (!f) return;
        popup?.remove();
        popup = new maplibregl.Popup({ closeButton: true, maxWidth: '360px', offset: 10 })
          .setLngLat(e.lngLat).setHTML(popupHtml(d, f.properties ?? {})).addTo(map);
      };
      const enter = () => { map.getCanvas().style.cursor = 'pointer'; };
      const leave = () => { map.getCanvas().style.cursor = ''; };
      map.on('click', spec.id, click);
      map.on('mouseenter', spec.id, enter);
      map.on('mouseleave', spec.id, leave);
      handlers.push([spec.id, 'click', click], [spec.id, 'mouseenter', enter], [spec.id, 'mouseleave', leave]);
    }
  };

  const setVisible = (d: ReferenceDataset, visible: boolean) => {
    for (const spec of layerSpecs(d, PREFIX + d.id)) {
      if (map.getLayer(spec.id)) map.setLayoutProperty(spec.id, 'visibility', visible ? 'visible' : 'none');
    }
  };

  const clear = (d: ReferenceDataset, s: DatasetState) => {
    s.ctrl?.abort();
    s.ctrl = null;
    s.url = null;
    sourceOf(d)?.setData(EMPTY);
  };

  const refresh = (d: ReferenceDataset, s: DatasetState) => {
    const zoom = Math.floor(map.getZoom());
    if (zoom < d.minZoom) return clear(d, s);
    const b = map.getBounds();
    const box = snapBox({ west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() }, zoom);
    const url = `/api/reference/${d.id}?bbox=${box.map(n => +n.toFixed(6)).join(',')}&zoom=${zoom}`;
    if (s.url === url) return;
    s.ctrl?.abort();
    const ctrl = new AbortController();
    s.ctrl = ctrl;
    s.url = url;
    fetch(url, { signal: ctrl.signal })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((fc: GeoJSON.FeatureCollection) => {
        if (s.ctrl === ctrl && s.on) sourceOf(d)?.setData(fc);
      })
      .catch(err => {
        if (ctrl.signal.aborted) return;
        if (s.url === url) s.url = null;
        console.warn(`[reference] ${d.id}:`, err);
      });
  };

  const refreshActive = () => {
    for (const d of REFERENCE_DATASETS) {
      const s = states.get(d.id)!;
      if (s.on) refresh(d, s);
    }
  };
  const onMoveEnd = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(refreshActive, MOVE_DEBOUNCE_MS);
  };
  map.on('moveend', onMoveEnd);

  return {
    update(active) {
      for (const d of REFERENCE_DATASETS) {
        const s = states.get(d.id)!;
        const on = !!active[d.key];
        if (on && !s.added) {
          add(d);
          s.added = true;
        }
        if (on === s.on) continue;
        s.on = on;
        if (s.added) setVisible(d, on);
        if (on) refresh(d, s);
        else clear(d, s);
      }
    },
    destroy() {
      if (timer) clearTimeout(timer);
      map.off('moveend', onMoveEnd);
      popup?.remove();
      for (const [id, type, fn] of handlers) map.off(type as 'click', id, fn);
      for (const d of REFERENCE_DATASETS) {
        const s = states.get(d.id)!;
        s.ctrl?.abort();
        if (!s.added || !map.style) continue;
        for (const spec of layerSpecs(d, PREFIX + d.id)) if (map.getLayer(spec.id)) map.removeLayer(spec.id);
        if (map.getSource(PREFIX + d.id)) map.removeSource(PREFIX + d.id);
      }
    },
  };
}
