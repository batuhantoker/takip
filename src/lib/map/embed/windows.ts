import type { HistoryFamilyLink } from '@/lib/map/view-mode-link';

/**
 * Layers an embed can show over a past window, how far back their source reaches, and the History family
 * "Open the full map" turns on for them. A layer added here needs a range route and a loader in
 * components/site/embed/hooks/use-window-data.ts.
 */
export const WINDOWED_LAYERS: ReadonlyMap<string, { since: number; family: HistoryFamilyLink }> = new Map([
  // USGS ComCat: large quakes back to 1900, small ones only as far back as the networks that caught them.
  // History's hazard family is NOAA's damaging quakes, tsunamis and volcanoes, not the whole catalogue.
  ['earthquakes', { since: Date.UTC(1900, 0, 1), family: 'hazard' }],
]);
