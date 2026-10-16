import type { ExpressionSpecification } from 'maplibre-gl';
import { clockYear, yearStart } from './world-borders';

/**
 * OpenHistoricalMap (CC0) under the world borders up close: dated borders down to duchies and free cities, read
 * straight from OHM's vector tiles and filtered to the clock. Cliopatria keeps the world view; OHM's own top-level
 * borders have holes before about 1650, and its tiles run to megabytes below z7 over Europe.
 */
export const OHM_MIN_ZOOM = 7;
export const OHM_TILES = 'https://vtiles.openhistoricalmap.org/maps/ohm/{z}/{x}/{y}.pbf';
export const OHM_ATTRIBUTION = '<a href="https://www.openhistoricalmap.org/copyright" target="_blank" rel="noopener">OpenHistoricalMap</a>';

/** The clock as OHM's `*_decdate` count it: a decimal year where year 0 is 1 BCE, as the clock's own years are. */
export function decimalYear(t: number): number {
  const y = clockYear(t);
  const from = yearStart(y);
  return y + (t - from) / (yearStart(y + 1) - from);
}

/** Alive at decimal year `d`. Undated features would show in every year, so a border needs a start. */
export const aliveAt = (d: number): ExpressionSpecification => ['all',
  ['has', 'start_decdate'],
  ['<=', ['get', 'start_decdate'], d],
  ['any', ['!', ['has', 'end_decdate']], ['>=', ['get', 'end_decdate'], d]],
];

/** Level 1 is empire envelopes over the states, so it is left out; 2 is states, 3–4 their provinces and cities. */
export const ohmLevels = (lo: number, hi: number): ExpressionSpecification =>
  ['all', ['==', ['get', 'type'], 'administrative'], ['>=', ['get', 'admin_level'], lo], ['<=', ['get', 'admin_level'], hi]];
