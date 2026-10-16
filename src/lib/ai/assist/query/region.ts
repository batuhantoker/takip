/**
 * A named region as an outline to search inside: a country, or a state or province, from the same
 * Natural Earth outlines the Areas tool picks from. A city is not a region; it takes `near`.
 */
import { pickBoundary, type Boundary } from '@/lib/places/areas/boundaries';
import type { Place } from './geo';

export interface Region { name: string; geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon; centre?: { lat: number; lng: number } }

export interface RegionLoaders {
  countries(): Promise<Boundary[]>;
  admin1(countryId: string): Promise<Boundary[]>;
  geocode(query: string): Promise<Place | null>;
}

const fold = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/^the\s+/, '').trim();

const asRegion = (b: Boundary): Region => ({
  name: b.country ? `${b.name}, ${b.country}` : b.name,
  geometry: b.geometry as Region['geometry'],
  ...(b.label ? { centre: { lng: b.label[0], lat: b.label[1] } } : {}),
});

export async function resolveRegion(name: string, load: RegionLoaders): Promise<Region | null> {
  const want = fold(name);
  if (!want) return null;
  const countries = await load.countries();
  const country = countries.find(c => fold(c.name) === want || (c.iso3 && c.iso3.toLowerCase() === want));
  if (country) return asRegion(country);

  const place = await load.geocode(name);
  if (!place) return null;
  const at = pickBoundary(place.lng, place.lat, countries);
  if (!at) return null;
  const kind = (place.kind ?? '').toLowerCase();
  if (/country/.test(kind)) return asRegion(at);
  const states = await load.admin1(at.countryId).catch(() => []);
  const state = pickBoundary(place.lng, place.lat, states);
  const first = fold(name.split(',')[0]);
  if (state && (/state|province|region|county|territory/.test(kind) || fold(state.name).includes(first) || first.includes(fold(state.name)))) return asRegion(state);
  return null;
}
