/**
 * TAKIP — upcoming launches (/api/launches) as one map pin per pad: several launches often share
 * a pad, and stacked pins would show only one of them.
 */

export interface LaunchRow {
  id: string;
  name: string;
  net: string;
  precision: string | null;
  status: string;
  status_name: string;
  provider: string | null;
  pad_id: string;
  pad: string;
  location: string | null;
  lat: number;
  lng: number;
  webcast_live: boolean;
  url: string;
}

export interface PadFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: {
    pad: string;
    location: string;
    count: number;
    name: string;
    net: string;
    when: string;
    status: string;
    status_name: string;
    provider: string;
    webcast_live: boolean;
    url: string;
    /** JSON list of the launches after the next one: map feature properties must be flat. */
    later: string;
  };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A launch date only as precise as LL2 says it is: "Q4 2026", "Nov 2026", "13 Oct 2026 00:11 UTC". */
export function formatNet(net: string, precision: string | null): string {
  const d = new Date(net);
  if (Number.isNaN(d.getTime())) return 'TBD';
  const day = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  const year = d.getUTCFullYear();
  const p = (precision ?? '').toLowerCase();
  const part = p.match(/(quarter|half) (\d)/);
  if (part) return `${part[1] === 'quarter' ? 'Q' : 'H'}${part[2]} ${year}`;
  if (p.includes('year')) return String(year);
  if (p === 'month') return `${MONTHS[d.getUTCMonth()]} ${year}`;
  if (p === 'week') return `week of ${day}`;
  if (p === 'day' || p.includes('morning') || p.includes('afternoon')) return day;
  return `${day} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC`;
}

export function padFeatures(launches: LaunchRow[]): PadFeature[] {
  const byPad = new Map<string, LaunchRow[]>();
  for (const l of [...launches].sort((a, b) => Date.parse(a.net) - Date.parse(b.net))) {
    byPad.set(l.pad_id, [...(byPad.get(l.pad_id) ?? []), l]);
  }
  return [...byPad.values()].map(([next, ...later]) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [next.lng, next.lat] },
    properties: {
      pad: next.pad,
      location: next.location ?? '',
      count: later.length + 1,
      name: next.name,
      net: next.net,
      when: formatNet(next.net, next.precision),
      status: next.status,
      status_name: next.status_name,
      provider: next.provider ?? '',
      webcast_live: next.webcast_live,
      url: next.url,
      later: JSON.stringify(later.slice(0, 4).map(l => ({ name: l.name, when: formatNet(l.net, l.precision) }))),
    },
  }));
}
