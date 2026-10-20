import { msg } from '@/lib/core/i18n/translator';
import { mapHref } from '../map-link';
import type { Place, PlaceKind } from './place';
import type { MapLink } from './topic';

/** The index of each kind of place, and what it is called in the trail, as msg(). */
export const KIND_INDEX: Record<PlaceKind, string> = { city: '/city', town: '/town', county: '/county', state: '/state', country: '/country' };
export const KIND_LABEL: Record<PlaceKind, string> = { city: msg('Places'), town: msg('Towns'), county: msg('Counties'), state: msg('States'), country: msg('Countries') };

/** /city/cincinnati, /city/cincinnati/transit, /country/turkey/earthquakes-last-100-years. */
export const placePath = (place: Place, page?: string) => `/${place.kind}/${place.slug}${page ? `/${page}` : ''}`;

/** Close enough to see the whole country: Luxembourg at 7, Türkiye at about 5, the US at 3; a county at up to 10. */
export function countryZoom(place: Place): number {
  const side = Math.sqrt(place.area ?? 250_000);
  return Math.min(place.kind === 'country' ? 7 : 10, Math.max(2, 9 - Math.log2(side / 50)));
}

export const placeZoom = (place: Place, zoom?: number) => zoom ?? (place.kind === 'city' ? 11 : place.kind === 'town' ? 13 : countryZoom(place));

export function placeOpenPath(place: Place, link: MapLink): string {
  const view = link.view ?? { lat: place.at[1], lon: place.at[0], zoom: placeZoom(place, link.zoom) };
  return mapHref({ layers: link.layers ?? [], view, track: link.track, mode: link.mode, panel: link.panel });
}

/** The square around the place's centre, [w, s, e, n], `radiusKm` each way. */
export function placeBox(place: Place, radiusKm: number): [number, number, number, number] {
  const [lng, lat] = place.at;
  const dLat = radiusKm / 111.32;
  const dLng = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  const r = (v: number) => Math.round(v * 1000) / 1000;
  return [r(lng - dLng), r(lat - dLat), r(lng + dLng), r(lat + dLat)];
}
