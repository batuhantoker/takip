import { htmlEsc, pop } from '@/lib/map/popups/kit';

/** As /api/airport-status sends them. One airport can have several rows (a ground stop and a ground delay). */
export interface AirportDelayRow {
  id: string;
  code: string;
  name?: string;
  lat: number;
  lng: number;
  type: string;
  severity: string;
  reason: string;
  avgDelayMin?: number;
  minDelayMin?: number;
  maxDelayMin?: number;
  trend?: string;
  endTime?: string;
  partial?: boolean;
  source: string;
}

type Props = NonNullable<GeoJSON.GeoJsonProperties>;

const COLORS: Record<string, string> = { severe: '#FF1744', major: '#FF6D00', moderate: '#FFB300', minor: '#9CCC65' };
const TYPES: Record<string, string> = {
  ground_stop: 'Ground stop',
  ground_delay: 'Ground delay programme',
  arrival_delay: 'Arrival delays',
  departure_delay: 'Departure delays',
  closure: 'Closure',
};
const RANK = ['minor', 'moderate', 'major', 'severe'];

export const delayColor = (severity: unknown) => COLORS[String(severity)] ?? COLORS.minor;

/** One pin per airport, at its worst row; the popup lists every row. */
export function airportDelayFeatures(rows: AirportDelayRow[]): GeoJSON.Feature<GeoJSON.Point>[] {
  const byAirport = new Map<string, AirportDelayRow[]>();
  for (const r of rows) {
    if (!Number.isFinite(r.lat) || !Number.isFinite(r.lng)) continue;
    byAirport.set(r.code, [...(byAirport.get(r.code) ?? []), r]);
  }
  return [...byAirport.values()].map(group => {
    const worst = group.reduce((a, b) => (RANK.indexOf(b.severity) > RANK.indexOf(a.severity) ? b : a));
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [worst.lng, worst.lat] },
      properties: {
        code: worst.code,
        name: worst.name ?? '',
        severity: worst.severity,
        color: delayColor(worst.severity),
        rows: JSON.stringify(group),
      },
    };
  });
}

function delayText(r: AirportDelayRow): string {
  if (r.type === 'closure' || r.type === 'ground_stop') return r.endTime ? `until ${r.endTime}` : '';
  if (r.avgDelayMin != null) return `avg ${r.avgDelayMin} min`;
  if (r.minDelayMin != null && r.maxDelayMin != null) return `${r.minDelayMin}–${r.maxDelayMin} min`;
  return '';
}

export function airportDelayPopupHtml(p: Props): string {
  let rows: AirportDelayRow[] = [];
  try { rows = JSON.parse(String(p.rows ?? '[]')); } catch { /* the header still renders */ }
  const items = rows.map(r => `<div class="tk-pop-item">
      <div class="tk-pop-item-title"><span class="tk-pop-dot" style="background:${delayColor(r.severity)}"></span>${htmlEsc(TYPES[r.type] ?? r.type)}${r.partial ? ' (some aircraft only)' : ''}</div>
      <div>${htmlEsc([delayText(r), r.trend].filter(Boolean).join(' · ') || '—')}</div>
      <div class="tk-pop-list-meta">${htmlEsc(r.reason)}</div>
    </div>`).join('');
  return pop({
    kicker: 'Airport delays',
    dot: delayColor(p.severity),
    title: [p.code, p.name].filter(Boolean).join(' · '),
    subtitle: 'FAA airspace status',
    body: items || undefined,
    links: [{ href: rows[0]?.source ?? 'https://nasstatus.faa.gov/', label: 'FAA NAS status' }],
  });
}
