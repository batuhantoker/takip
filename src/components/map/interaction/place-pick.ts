import * as maplibregl from 'maplibre-gl';
import type { RefObject } from 'react';
import { BASEMAP_SOURCE } from '@/lib/basemap/provider';
import { KIND_LABEL, kindOf, namesOf } from '@/lib/places/wiki';
import { placePopupHtml, type PlaceInfo } from '@/lib/places/place-popup';
import type { WikiSummary } from '@/lib/space/wiki-topic';

/** How near a label, in pixels, a click has to land. */
const HIT_PX = 4;
const LABEL_SOURCE_LAYERS = new Set(['place', 'water_name', 'waterway', 'mountain_peak', 'aerodrome_label', 'park', 'poi']);

export interface PlacePick {
  destroy(): void;
}

interface PlacePickDeps {
  popupRef: RefObject<maplibregl.Popup | null>;
  /** True when the click belongs to something else: a draw tool, a marker, OI, a satellite. */
  claimed: (e: maplibregl.MapMouseEvent) => boolean;
}

const humanize = (v: unknown) => (typeof v === 'string' ? v.replace(/_/g, ' ') : '');

function detailOf(sourceLayer: string | undefined, p: Record<string, unknown>): string | undefined {
  if (sourceLayer === 'mountain_peak') return typeof p.ele === 'number' ? `${p.ele.toLocaleString('en-US')} m` : undefined;
  if (sourceLayer === 'aerodrome_label') return [p.iata, p.icao, humanize(p.class)].filter(Boolean).join(' · ');
  if (sourceLayer === 'poi') return humanize(p.subclass && p.subclass !== p.class ? p.subclass : p.class);
  return humanize(p.class) || undefined;
}

/**
 * Click a place name on the base map for its Wikipedia lead. The tiles carry
 * no Wikidata ids, so /api/map/wiki finds the article by name near the label.
 */
export function attachPlacePick(map: maplibregl.Map, { popupRef, claimed }: PlacePickDeps): PlacePick {
  let lookup: AbortController | null = null;

  const labelLayers = () => (map.getStyle().layers ?? [])
    .filter(l => l.type === 'symbol' && l.source === BASEMAP_SOURCE && LABEL_SOURCE_LAYERS.has(l['source-layer'] ?? '')
      && map.getLayoutProperty(l.id, 'visibility') !== 'none')
    .map(l => l.id);

  const onClick = (e: maplibregl.MapMouseEvent) => {
    lookup?.abort();
    lookup = null;
    if (claimed(e)) return;
    const layers = labelLayers();
    if (!layers.length) return;
    const box: [maplibregl.PointLike, maplibregl.PointLike] = [[e.point.x - HIT_PX, e.point.y - HIT_PX], [e.point.x + HIT_PX, e.point.y + HIT_PX]];
    const hit = map.queryRenderedFeatures(box, { layers })
      .find(f => kindOf(f.sourceLayer, f.properties?.class) && namesOf(f.properties ?? {}).length);
    if (!hit) return;

    const props = hit.properties ?? {};
    const kind = kindOf(hit.sourceLayer, props.class)!;
    const names = namesOf(props);
    const at = hit.geometry.type === 'Point' ? maplibregl.LngLat.convert(hit.geometry.coordinates as [number, number]) : e.lngLat;
    const place: PlaceInfo = { name: names[0], kind: KIND_LABEL[kind], detail: detailOf(hit.sourceLayer, props) };

    popupRef.current?.remove();
    const popup = new maplibregl.Popup({ closeButton: true, maxWidth: '340px', offset: 10 })
      .setLngLat(at).setHTML(placePopupHtml(place, { state: 'loading' })).addTo(map);
    popupRef.current = popup;
    const ctrl = lookup = new AbortController();
    popup.on('close', () => {
      ctrl.abort();
      if (popupRef.current === popup) popupRef.current = null;
    });

    const qs = new URLSearchParams({ lat: at.lat.toFixed(5), lon: at.lng.toFixed(5), kind });
    for (const n of names) qs.append('n', n);
    fetch(`/api/map/wiki?${qs}`, { signal: ctrl.signal })
      .then(r => (r.ok ? r.json() as Promise<WikiSummary> : null))
      .then(summary => {
        if (!ctrl.signal.aborted) popup.setHTML(placePopupHtml(place, summary ? { state: 'found', summary } : { state: 'none' }));
      })
      .catch(() => {
        if (!ctrl.signal.aborted) popup.setHTML(placePopupHtml(place, { state: 'none' }));
      });
  };

  map.on('click', onClick);
  return {
    destroy() {
      map.off('click', onClick);
      lookup?.abort();
    },
  };
}
