import type { Map as MapLibreMap } from 'maplibre-gl';
import { msg } from '@/lib/core/i18n/translator';

type Filter = NonNullable<Parameters<MapLibreMap['setFilter']>[1]>;

/** Vessel classes the maritime route assigns (see shipCategory there), in panel order. */
export const SHIP_CLASSES = [
  { key: 'ships_cargo', type: 'cargo', label: msg('Cargo'), color: '#5FB3C4' },
  { key: 'ships_tanker', type: 'tanker', label: msg('Tankers'), color: '#D49A4E' },
  { key: 'ships_passenger', type: 'passenger', label: msg('Passenger / Ferries'), color: '#A08FE3' },
  { key: 'ships_fishing', type: 'fishing', label: msg('Fishing'), color: '#9DBA78' },
  { key: 'ships_military', type: 'military', label: msg('Military / Law'), color: '#E5534B' },
  { key: 'ships_service', type: 'service', label: msg('Tugs / Service'), color: '#D8C26A' },
  { key: 'ships_leisure', type: 'leisure', label: msg('Sailing / Leisure'), color: '#D99AB4' },
  // Ships whose static report has not arrived yet carry no type at all.
  { key: 'ships_other', type: 'other', label: msg('Other / Unidentified'), color: '#7F8B96' },
] as const;

export const SHIPS_UNDERWAY = 'ships_underway';

/** Below this a vessel is anchored, moored or drifting. */
export const UNDERWAY_KNOTS = 0.5;

export const SHIP_FALLBACK_COLOR = '#7F8B96';

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
