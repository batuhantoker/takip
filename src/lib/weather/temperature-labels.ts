import { temperatureAt, type TemperatureField } from './weather-field';
import { toUnit, type TemperatureUnit } from './temperature-unit';

/** Map bounds in degrees; west/east may run past ±180, as the globe reports them. */
export interface LabelBounds { west: number; south: number; east: number; north: number }

/** A place name the base map is showing. */
export interface LabelPlace { name: string; lng: number; lat: number; cls: string; rank: number }

type Source = 'gfs' | 'grid';

/** The base map labels cities from z4; below that the readings fall back to a sparse grid. */
export const PLACE_LABEL_MIN_ZOOM = 4;
const MAX_PLACE_LABELS = 25;
const PLACE_CLASSES = ['city', 'town', 'village', 'suburb', 'neighbourhood', 'hamlet'];

const NICE_STEPS = [5, 10, 15, 20, 30];
const SPACING_PX = 120;
const MAX_LAT = 85;

function reading(field: TemperatureField, lng: number, lat: number, unit: TemperatureUnit, source: Source, place?: string): GeoJSON.Feature<GeoJSON.Point> | null {
  const t = temperatureAt(field, lat, lng);
  if (t == null) return null;
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lng, lat] },
    properties: { temp: Math.round(t * 10) / 10, shownTemp: Math.round(toUnit(t, unit)), source, hour: `${field.time.slice(11, 16)} UTC`, place },
  };
}

/** One reading per place name in view, biggest places first, so a city gets its number and the map stays quiet. */
export function placeTemperatureLabels(field: TemperatureField, places: LabelPlace[], unit: TemperatureUnit, source: Source): GeoJSON.Feature<GeoJSON.Point>[] {
  const seen = new Set<string>();
  return places
    .filter(p => PLACE_CLASSES.includes(p.cls))
    .sort((a, b) => PLACE_CLASSES.indexOf(a.cls) - PLACE_CLASSES.indexOf(b.cls) || a.rank - b.rank)
    // A name repeats across the tiles it straddles.
    .filter(p => {
      const key = `${p.name}|${p.lng.toFixed(1)}|${p.lat.toFixed(1)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_PLACE_LABELS)
    .map(p => reading(field, p.lng, p.lat, unit, source, p.name || undefined))
    .filter(f => f !== null);
}

/** Degrees between grid readings, about SPACING_PX apart on screen. */
export function labelStep(zoom: number): number {
  const raw = SPACING_PX * 360 / (512 * 2 ** zoom);
  return NICE_STEPS.find(s => s >= raw) ?? NICE_STEPS[NICE_STEPS.length - 1];
}

/** Grid readings for a zoomed-out view, on multiples of the step from 0° so they stay put while the globe turns. */
export function temperatureLabels(field: TemperatureField, bounds: LabelBounds, zoom: number, unit: TemperatureUnit, source: Source): GeoJSON.Feature<GeoJSON.Point>[] {
  const south = Math.max(bounds.south, -MAX_LAT), north = Math.min(bounds.north, MAX_LAT);
  let west = bounds.west, east = bounds.east;
  // Just short of 180, or the antimeridian column would be labelled twice.
  if (east - west >= 360) { west = -180; east = 180 - 1e-9; }
  if (![south, north, west, east, zoom].every(Number.isFinite) || north < south || east < west) return [];

  const step = labelStep(zoom);
  const out: GeoJSON.Feature<GeoJSON.Point>[] = [];
  for (let i = Math.ceil(south / step); i <= Math.floor(north / step); i++) {
    for (let j = Math.ceil(west / step); j <= Math.floor(east / step); j++) {
      const lng = ((((j * step + 180) % 360) + 360) % 360) - 180;
      const f = reading(field, lng, i * step, unit, source);
      if (f) out.push(f);
    }
  }
  return out;
}
