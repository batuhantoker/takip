/**
 * TAKIP — upcoming orbital launches from The Space Devs' Launch Library 2, no key.
 * LL2 terms not yet verified. The anonymous limit is a few requests an hour, so the route caches
 * for an hour and falls back to the lldev mirror (same schema, older data) when throttled.
 * Dates slip constantly and some are only windows; the pin is the pad, not the trajectory.
 */

const QUERY = 'launch/upcoming/?limit=50&mode=normal';
export const LL2_URLS = [
  `https://ll.thespacedevs.com/2.2.0/${QUERY}`,
  `https://lldev.thespacedevs.com/2.2.0/${QUERY}`,
];

export interface Ll2Launch {
  id?: string;
  name?: string;
  net?: string | null;
  window_start?: string | null;
  window_end?: string | null;
  status?: { abbrev?: string; name?: string } | null;
  net_precision?: { name?: string } | null;
  launch_service_provider?: { name?: string } | null;
  rocket?: { configuration?: { full_name?: string; name?: string } | null } | null;
  mission?: { name?: string; type?: string; orbit?: { abbrev?: string } | null } | null;
  pad?: {
    id?: number;
    name?: string;
    latitude?: string | number | null;
    longitude?: string | number | null;
    wiki_url?: string | null;
    location?: { name?: string; country_code?: string } | null;
  } | null;
  webcast_live?: boolean;
}

export interface Launch {
  id: string;
  name: string;
  net: string;
  window_start: string | null;
  window_end: string | null;
  /** How sure the date is: "Second", "Hour", "Day", "Month"… */
  precision: string | null;
  status: string;
  status_name: string;
  provider: string | null;
  rocket: string | null;
  mission: string | null;
  mission_type: string | null;
  orbit: string | null;
  pad_id: string;
  pad: string;
  location: string | null;
  country: string | null;
  lat: number;
  lng: number;
  webcast_live: boolean;
  url: string;
}

const coord = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

export function mapLl2Launch(r: Ll2Launch | null | undefined): Launch | null {
  const pad = r?.pad;
  const lat = coord(pad?.latitude);
  const lng = coord(pad?.longitude);
  if (!r?.id || !r.net || !pad || lat == null || lng == null || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  if (lat === 0 && lng === 0) return null;
  return {
    id: `ll2-${r.id}`,
    name: r.name || 'Unnamed launch',
    net: r.net,
    window_start: r.window_start ?? null,
    window_end: r.window_end ?? null,
    precision: r.net_precision?.name ?? null,
    status: r.status?.abbrev ?? 'TBD',
    status_name: r.status?.name ?? 'To Be Determined',
    provider: r.launch_service_provider?.name ?? null,
    rocket: r.rocket?.configuration?.full_name ?? r.rocket?.configuration?.name ?? null,
    mission: r.mission?.name ?? null,
    mission_type: r.mission?.type ?? null,
    orbit: r.mission?.orbit?.abbrev ?? null,
    pad_id: `ll2-pad-${pad.id ?? `${lat},${lng}`}`,
    pad: pad.name || 'Unknown pad',
    location: pad.location?.name ?? null,
    country: pad.location?.country_code ?? null,
    lat,
    lng,
    webcast_live: r.webcast_live === true,
    url: `https://ll.thespacedevs.com/2.2.0/launch/${encodeURIComponent(r.id)}/`,
  };
}

export function parseLl2(json: unknown): Launch[] {
  const results = (json as { results?: unknown } | null)?.results;
  if (!Array.isArray(results)) throw new Error('LL2: unexpected response');
  return results
    .map(r => mapLl2Launch(r as Ll2Launch))
    .filter((l): l is Launch => l !== null)
    .sort((a, b) => Date.parse(a.net) - Date.parse(b.net));
}
