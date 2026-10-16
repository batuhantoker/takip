import type * as maplibregl from 'maplibre-gl';
import { LABEL_SIZE, MAP_INK, labelPaint } from '@/lib/map/style/tokens';

/*
 * Aircraft in distress: squawking 7500, 7600 or 7700, or sending an ADS-B emergency status. They are
 * drawn in red on their own layer, every one of them, since the regular layers thin traffic worldwide.
 */

const SQUAWKS: Record<string, string> = { '7500': 'Hijack code', '7600': 'Radio failure', '7700': 'Emergency' };
/** ADS-B emergency statuses; `lifeguard` is a medical priority flight, not distress, so it is left out. */
const STATUSES: Record<string, string> = {
  general: 'Emergency', minfuel: 'Minimum fuel', nordo: 'Radio failure', unlawful: 'Unlawful interference', downed: 'Aircraft down',
};

/** What the aircraft is declaring, or null; the squawk wins when both are set. */
export function emergencyOf(row: { squawk?: unknown; emergency?: unknown } | null | undefined): string | null {
  if (!row) return null;
  return SQUAWKS[String(row.squawk ?? '')] ?? STATUSES[String(row.emergency ?? '')] ?? null;
}

export const EMERGENCY_SOURCE = 'fl-emergency';
export const EMERGENCY_ICON_LAYER = 'fl-emergency';
export const EMERGENCY_LAYERS = ['fl-emergency-ring', EMERGENCY_ICON_LAYER, 'fl-emergency-label'];
export const EMERGENCY_ICON = 'plane-emergency';
/** The ring is the bigger target, and lies under the icon, so it takes the clicks and the hover. */
export const EMERGENCY_PICK = 'fl-emergency-ring';

/** Over the other aircraft; base-layers.ts makes the red plane icon beside the others. */
export function addEmergencyLayers(map: maplibregl.Map) {
  map.addLayer({ id: 'fl-emergency-ring', type: 'circle', source: EMERGENCY_SOURCE, paint: {
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 7, 6, 11, 10, 15],
    'circle-color': MAP_INK.red, 'circle-opacity': 0.18,
    'circle-stroke-width': 1.5, 'circle-stroke-color': MAP_INK.red, 'circle-stroke-opacity': 0.9,
  }});
  map.addLayer({ id: EMERGENCY_ICON_LAYER, type: 'symbol', source: EMERGENCY_SOURCE, layout: {
    'icon-image': EMERGENCY_ICON, 'icon-size': ['interpolate', ['linear'], ['zoom'], 1, 0.5, 5, 0.7, 10, 0.95, 14, 1.1],
    'icon-rotate': ['get', 'heading'], 'icon-rotation-alignment': 'map', 'icon-allow-overlap': true, 'icon-ignore-placement': true,
  }});
  map.addLayer({ id: 'fl-emergency-label', type: 'symbol', source: EMERGENCY_SOURCE, minzoom: 3, layout: {
    'text-field': ['concat', ['get', 'callsign'], ' · ', ['get', 'declared']], 'text-size': LABEL_SIZE, 'text-font': ['Noto Sans Bold'],
    'text-offset': [0, 1.3], 'text-anchor': 'top', 'text-allow-overlap': true,
  }, paint: labelPaint(MAP_INK.red) });
}
