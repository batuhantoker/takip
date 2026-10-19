import { mapHref } from '../map-link';
import type { Place } from './place';
import type { MapLink } from './topic';

/** /city/cincinnati, /city/cincinnati/transit, /country/turkey/earthquakes-last-100-years. */
export const placePath = (place: Place, page?: string) => `/${place.kind}/${place.slug}${page ? `/${page}` : ''}`;

/** Close enough to see the whole country: Luxembourg at 7, Türkiye at about 5, the US at 3. */
export function countryZoom(place: Place): number {
  const side = Math.sqrt(place.area ?? 250_000);
  return Math.min(7, Math.max(2, 9 - Math.log2(side / 50)));
}

export const placeZoom = (place: Place, zoom?: number) => zoom ?? (place.kind === 'country' ? countryZoom(place) : 11);

export function placeOpenPath(place: Place, link: MapLink): string {
  const view = link.view ?? { lat: place.at[1], lon: place.at[0], zoom: placeZoom(place, link.zoom) };
  return mapHref({ layers: link.layers ?? [], view, mode: link.mode, panel: link.panel });
}

/** The square around the place's centre, [w, s, e, n], `radiusKm` each way. */
export function placeBox(place: Place, radiusKm: number): [number, number, number, number] {
  const [lng, lat] = place.at;
  const dLat = radiusKm / 111.32;
  const dLng = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  const r = (v: number) => Math.round(v * 1000) / 1000;
  return [r(lng - dLng), r(lat - dLat), r(lng + dLng), r(lat + dLat)];
}
