import { DEFAULT_LAYERS } from '@/lib/map/layers/defaults';
import { viewModeQuery, type PanelLink, type ViewModeLink } from '@/lib/map/view-mode-link';

export interface MapView { lat: number; lon: number; zoom: number }

/**
 * A link's `layers` replaces the whole set (use-startup.ts), so every link from a site page also
 * names the quiet display layers the map opens with; otherwise it lands on a bare, unlit globe. The SDK
 * lines are left out on purpose: sdk_sea draws the undersea cables over everything.
 */
export const BASE_LAYERS = ['day_night', 'sky_stars'] as const;

const KNOWN = new Set(Object.keys(DEFAULT_LAYERS));

/** A path that opens the map at `view` with `layers` on (plus the base set), following `track`, in another view (`mode`) or with a panel open. */
export function mapHref({ layers, view, track, mode, panel }: {
  layers: readonly string[]; view?: MapView; track?: string; mode?: ViewModeLink; panel?: PanelLink;
}): string {
  const on = [...new Set([...BASE_LAYERS, ...layers])].filter(k => KNOWN.has(k));
  const params: string[] = [];
  if (view) params.push(`lat=${view.lat.toFixed(4)}`, `lon=${view.lon.toFixed(4)}`, `zoom=${view.zoom.toFixed(2)}`);
  // No layers named keeps the visitor's own, rather than switching everything off.
  if (layers.length) params.push(`layers=${on.join(',')}`);
  if (track) params.push(`track=${encodeURIComponent(track).replace(/%3A/g, ':')}`);
  if (mode) params.push(viewModeQuery(mode));
  if (panel) params.push(`panel=${panel}`);
  return params.length ? `/?${params.join('&')}` : '/';
}
