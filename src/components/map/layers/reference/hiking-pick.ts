import * as maplibregl from 'maplibre-gl';
import type { RefObject } from 'react';
import { drawnAt, routeGeometry, routesAt, type RouteSummary } from '@/lib/hiking/api';
import type { RouteDetails } from '@/lib/hiking/details';
import { boxContains, mercatorBox, type MercatorBox } from '@/lib/hiking/mercator';
import { hikingPopupHtml, type DetailsState } from '@/lib/hiking/popup';

const SOURCE = 'hiking-highlight';
const CASING = 'hiking-highlight-casing';
const LINE = 'hiking-highlight-line';
/** How near a trail, in pixels, a click has to land. */
const HIT_PX = 8;
const MOVE_DEBOUNCE_MS = 250;
const MAX_CACHED_DETAILS = 50;
const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

export interface HikingPick {
  setActive(on: boolean): void;
  destroy(): void;
}

interface HikingPickDeps {
  popupRef: RefObject<maplibregl.Popup | null>;
  /** True when the click belongs to something else: a draw tool, a marker, OI, a satellite. */
  claimed: (e: maplibregl.MapMouseEvent) => boolean;
}

/**
 * Click-to-inspect for the hiking overlay. The tiles are raster, so a click
 * asks Waymarked Trails which routes pass under it; the chosen route is drawn
 * over the tiles and described in a popup that lists the others.
 */
export function attachHikingPick(map: maplibregl.Map, { popupRef, claimed }: HikingPickDeps): HikingPick {
  let active = false;
  let lookup: AbortController | null = null;
  let geometry: AbortController | null = null;
  let popup: maplibregl.Popup | null = null;
  let routes: RouteSummary[] = [];
  let selected: number | null = null;
  let loadedBox: MercatorBox | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const details = new Map<number, DetailsState>();

  const highlight = (fc: GeoJSON.FeatureCollection) => {
    if (!map.getSource(SOURCE)) {
      map.addSource(SOURCE, { type: 'geojson', data: EMPTY });
      // Under the live markers like the reference layers, but over the place names.
      const before = map.getLayer('eq-circles') ? 'eq-circles' : undefined;
      const layout = { 'line-cap': 'round', 'line-join': 'round' } as const;
      map.addLayer({ id: CASING, type: 'line', source: SOURCE, layout, paint: {
        'line-color': '#0C0E1A', 'line-opacity': 0.85,
        'line-width': ['interpolate', ['linear'], ['zoom'], 4, 5, 10, 8, 16, 12],
      } }, before);
      map.addLayer({ id: LINE, type: 'line', source: SOURCE, layout, paint: {
        'line-color': '#FFE066',
        'line-width': ['interpolate', ['linear'], ['zoom'], 4, 2.5, 10, 4, 16, 6],
      } }, before);
    }
    (map.getSource(SOURCE) as maplibregl.GeoJSONSource).setData(fc);
  };
  const clearHighlight = () => (map.getSource(SOURCE) as maplibregl.GeoJSONSource | undefined)?.setData(EMPTY);

  const viewBox = (pad = 0) => {
    const b = map.getBounds();
    return mercatorBox(b.getWest(), b.getSouth(), b.getEast(), b.getNorth(), pad);
  };

  // Only the part in and around the view: a national trail's full line is megabytes.
  const loadGeometry = () => {
    const id = selected;
    if (id == null || (loadedBox && boxContains(loadedBox, viewBox()))) return;
    const box = viewBox(0.5);
    geometry?.abort();
    const ctrl = geometry = new AbortController();
    routeGeometry(id, box, ctrl.signal)
      .then(fc => {
        if (geometry !== ctrl || selected !== id) return;
        loadedBox = box;
        highlight(fc);
      })
      .catch(err => { if (!ctrl.signal.aborted) console.warn('[hiking] route geometry:', err); });
  };

  const render = () => {
    if (popup && selected != null) popup.setHTML(hikingPopupHtml(routes, selected, details.get(selected)));
  };

  const loadDetails = (id: number) => {
    const known = details.get(id);
    if (known && known !== 'failed') return;
    details.set(id, 'loading');
    if (details.size > MAX_CACHED_DETAILS) details.delete(details.keys().next().value!);
    fetch(`/api/hiking/routes/${id}`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: RouteDetails) => { details.set(id, d); })
      .catch(err => {
        details.set(id, 'failed');
        console.warn('[hiking] route details:', err);
      })
      .finally(() => { if (selected === id) render(); });
  };

  const select = (id: number) => {
    // A "part of" row names a route that was not under the click; it joins the list.
    if (!routes.some(r => r.id === id)) {
      const current = selected == null ? undefined : details.get(selected);
      const parent = typeof current === 'object' ? current.superroutes.find(r => r.id === id) : undefined;
      if (!parent) return;
      routes = [{ ...parent, group: parent.group ?? '' }, ...routes];
    }
    selected = id;
    loadedBox = null;
    clearHighlight();
    loadGeometry();
    loadDetails(id);
    render();
  };

  // Leaves `lookup` alone: the popup closes on the very click that starts the next one.
  const clear = () => {
    geometry?.abort();
    routes = [];
    selected = null;
    loadedBox = null;
    clearHighlight();
  };

  const fit = () => {
    const d = selected == null ? undefined : details.get(selected);
    if (typeof d !== 'object' || !d.bbox) return;
    const [w, s, e, n] = d.bbox;
    map.fitBounds([[w, s], [e, n]], { padding: 60, maxZoom: 15, duration: 1200 });
  };

  const onPopupClick = (ev: MouseEvent) => {
    const el = (ev.target as Element | null)?.closest<HTMLElement>('[data-hiking-route],[data-hiking-fit]');
    if (!el) return;
    if (el.dataset.hikingRoute) select(Number(el.dataset.hikingRoute));
    else fit();
  };

  const open = (at: maplibregl.LngLat, found: RouteSummary[]) => {
    // Closing the previous popup clears its selection, so that happens first.
    popupRef.current?.remove();
    routes = found;
    const p = new maplibregl.Popup({ closeButton: true, maxWidth: '360px', offset: 10 }).setLngLat(at).setHTML('').addTo(map);
    popup = p;
    popupRef.current = p;
    p.getElement().addEventListener('click', onPopupClick);
    p.on('close', () => {
      if (popup !== p) return;
      popup = null;
      if (popupRef.current === p) popupRef.current = null;
      clear();
    });
    select(found[0].id);
  };

  const onClick = (e: maplibregl.MapMouseEvent) => {
    lookup?.abort();
    if (!active || claimed(e)) return;
    const a = map.unproject([e.point.x - HIT_PX, e.point.y - HIT_PX]);
    const b = map.unproject([e.point.x + HIT_PX, e.point.y + HIT_PX]);
    const box = mercatorBox(a.lng, a.lat, b.lng, b.lat);
    if (!box.every(Number.isFinite)) return;
    const zoom = map.getZoom();
    const ctrl = lookup = new AbortController();
    routesAt(box, ctrl.signal)
      .then(found => {
        if (lookup !== ctrl) return;
        const shown = found.filter(r => drawnAt(r.group, zoom));
        if (shown.length) open(e.lngLat, shown);
      })
      .catch(err => { if (!ctrl.signal.aborted) console.warn('[hiking] route lookup:', err); });
  };

  const onMoveEnd = () => {
    if (selected == null) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(loadGeometry, MOVE_DEBOUNCE_MS);
  };

  map.on('click', onClick);
  map.on('moveend', onMoveEnd);

  const close = () => {
    lookup?.abort();
    if (popup) popup.remove();
    else clear();
  };

  return {
    setActive(on) {
      active = on;
      if (!on) close();
    },
    destroy() {
      if (timer) clearTimeout(timer);
      map.off('click', onClick);
      map.off('moveend', onMoveEnd);
      close();
      if (!map.style) return;
      for (const id of [LINE, CASING]) if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource(SOURCE)) map.removeSource(SOURCE);
    },
  };
}
