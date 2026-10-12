import type { Map as MapLibreMap } from 'maplibre-gl';

type Filter = NonNullable<Parameters<MapLibreMap['setFilter']>[1]>;

/** Vessel classes the maritime route assigns (see shipCategory there), in panel order. */
export const SHIP_CLASSES = [
  { key: 'ships_cargo', type: 'cargo', label: 'Cargo', color: '#26C6DA' },
  { key: 'ships_tanker', type: 'tanker', label: 'Tankers', color: '#FF8F00' },
  { key: 'ships_passenger', type: 'passenger', label: 'Passenger / Ferries', color: '#B388FF' },
  { key: 'ships_fishing', type: 'fishing', label: 'Fishing', color: '#9CCC65' },
  { key: 'ships_military', type: 'military', label: 'Military / Law', color: '#FF1744' },
  { key: 'ships_service', type: 'service', label: 'Tugs / Service', color: '#FFD54F' },
  { key: 'ships_leisure', type: 'leisure', label: 'Sailing / Leisure', color: '#F48FB1' },
  // Ships whose static report has not arrived yet carry no type at all.
  { key: 'ships_other', type: 'other', label: 'Other / Unidentified', color: '#90A4AE' },
] as const;

export const SHIPS_UNDERWAY = 'ships_underway';

/** Below this a vessel is anchored, moored or drifting. */
export const UNDERWAY_KNOTS = 0.5;

export const SHIP_FALLBACK_COLOR = '#90A4AE';

/** `match` arms for a colour expression on the `type` property. */
export const shipColorArms = (): string[] => SHIP_CLASSES.flatMap(c => [c.type, c.color]);

export const shipColor = (type?: string): string =>
  SHIP_CLASSES.find(c => c.type === type)?.color ?? SHIP_FALLBACK_COLOR;

/** The layer filter for the ship toggles; a missing toggle counts as on. */
export function shipFilter(layers: Record<string, boolean | undefined>): Filter {
  const types = SHIP_CLASSES.filter(c => layers[c.key] !== false).map(c => c.type);
  const byType: Filter = ['in', ['get', 'type'], ['literal', types]];
  if (!layers[SHIPS_UNDERWAY]) return byType;
  return ['all', byType, ['>=', ['coalesce', ['get', 'speed'], 0], UNDERWAY_KNOTS]];
}
