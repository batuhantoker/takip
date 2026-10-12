import { htmlEsc, urlSafe } from './map-popups';

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
  const color = delayColor(p.severity);
  const lines = rows.map(r => `<div style="margin-top:6px;">
          <div style="color:${delayColor(r.severity)};font-size:10px;font-weight:700;">${htmlEsc(TYPES[r.type] ?? r.type)}${r.partial ? ' (some aircraft only)' : ''}</div>
          <div style="color:#E8E6E0;font-size:9px;">${htmlEsc([delayText(r), r.trend].filter(Boolean).join(' · ') || '—')}</div>
          <div style="color:#aaa;font-size:9px;">${htmlEsc(r.reason)}</div>
        </div>`).join('');
  return `<div style="background:rgba(12,14,26,0.95);backdrop-filter:blur(16px);border-radius:10px;padding:16px;font-family:'JetBrains Mono',monospace;border:1px solid ${color}40;max-width:300px;">
        <div style="color:${color};font-size:12px;font-weight:700;">✈ ${htmlEsc(p.code)}${p.name ? ` · ${htmlEsc(p.name)}` : ''}</div>
        <div style="font-size:9px;color:#5C5A54;">FAA NAS status</div>
        ${lines}
        <a href="${urlSafe(rows[0]?.source ?? 'https://nasstatus.faa.gov/')}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:8px;padding:5px 12px;font-size:10px;letter-spacing:0.12em;text-decoration:none;border-radius:5px;color:${color};border:1px solid ${color}66;background:${color}1A;">FAA NAS STATUS</a>
      </div>`;
}
