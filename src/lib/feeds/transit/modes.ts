/** What a rider can take: GTFS route types (basic and extended) folded into a few kinds. */
export type TransitMode = 'metro' | 'tram' | 'rail' | 'bus' | 'trolleybus' | 'ferry' | 'cable';

/** Display order: the heaviest first. */
export const TRANSIT_MODES: readonly TransitMode[] = ['metro', 'rail', 'tram', 'bus', 'trolleybus', 'ferry', 'cable'];

export const MODE_LABEL: Record<TransitMode, string> = {
  metro: 'Metro', rail: 'Train', tram: 'Tram', bus: 'Bus', trolleybus: 'Trolleybus', ferry: 'Ferry', cable: 'Cable car',
};

/** gtfs.org/schedule/reference/#routestxt and the extended types (developers.google.com/transit/gtfs/reference/extended-route-types). */
export function modeOfRouteType(type: number): TransitMode | null {
  if (!Number.isInteger(type) || type < 0) return null;
  if (type === 0 || type === 5) return 'tram';
  if (type === 1 || type === 12) return 'metro';
  if (type === 2) return 'rail';
  if (type === 3) return 'bus';
  if (type === 4) return 'ferry';
  if (type === 6 || type === 7) return 'cable';
  if (type === 11 || type === 800) return 'trolleybus';
  if (type >= 100 && type < 200) return 'rail';
  if (type >= 200 && type < 300) return 'bus';
  if (type >= 400 && type < 500) return type === 403 ? 'rail' : 'metro';
  if (type >= 700 && type < 800) return 'bus';
  if (type >= 900 && type < 1000) return 'tram';
  if (type >= 1000 && type < 1100) return 'ferry';
  if (type >= 1300 && type < 1500) return 'cable';
  return null;
}

export const sortModes = (modes: Iterable<TransitMode>) => TRANSIT_MODES.filter(m => new Set(modes).has(m));

/** "Metro · Tram · Bus" */
export const modesText = (modes: readonly TransitMode[]) => sortModes(modes).map(m => MODE_LABEL[m]).join(' · ');

/** One city on the zoomed-out map, from public/data/transit/cities.json. */
export interface TransitCity {
  name: string;
  cc: string;
  at: [number, number];
  modes: TransitMode[];
  /** Vehicles seen there when the catalogue was probed; 0 where the probe fell at night. */
  vehicles: number;
  operators: string[];
}

export interface TransitCities {
  generated: string;
  cities: TransitCity[];
}
