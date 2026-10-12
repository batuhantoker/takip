import { htmlEsc, urlSafe } from './map-popups';

/** As /api/war-alerts sends them. */
export interface WarAlertRow {
  id: string;
  country: 'IL' | 'UA';
  place: string;
  lat: number;
  lng: number;
  precision: 'locality' | 'oblast';
  threat: string;
  label: string;
  active: boolean;
  since?: string;
  count?: number;
  provider: string;
  source: string;
}

type Props = NonNullable<GeoJSON.GeoJsonProperties>;

const COLORS: Record<string, string> = {
  rockets: '#FF3D3D',
  'air-raid': '#FF3D3D',
  uav: '#FF8000',
  infiltration: '#FFD500',
  hazmat: '#9335EE',
  nonconventional: '#EE35A8',
  radiological: '#EE35A8',
  earthquake: '#00E676',
  tsunami: '#0080FF',
};

export const warAlertColor = (threat: unknown) => COLORS[String(threat)] ?? '#FF3D3D';

export function warAlertFeatures(rows: WarAlertRow[]): GeoJSON.Feature<GeoJSON.Point>[] {
  return rows
    .filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng))
    .map(r => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: { ...r, color: warAlertColor(r.threat) },
    }));
}

function ago(iso: unknown): string {
  const t = Date.parse(String(iso ?? ''));
  if (!Number.isFinite(t)) return 'unknown';
  const min = Math.round((Date.now() - t) / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  if (min < 48 * 60) return `${Math.round(min / 60)} h ago`;
  return new Date(t).toISOString().slice(0, 10);
}

export function warAlertPopupHtml(p: Props): string {
  const color = warAlertColor(p.threat);
  const active = p.active === true || p.active === 'true';
  const oblast = p.precision === 'oblast';
  const count = Number(p.count);
  const note = oblast
    ? 'An alert covers the whole oblast; the pin is its administrative centre. A warning, not a confirmed strike.'
    : 'Home Front Command siren for this locality.';
  return `<div style="background:rgba(12,14,26,0.95);backdrop-filter:blur(16px);border-radius:10px;padding:16px;font-family:'JetBrains Mono',monospace;border:1px solid ${color}40;max-width:280px;">
        <div style="color:${color};font-size:12px;font-weight:700;margin-bottom:4px;">${htmlEsc(p.label)}</div>
        <div style="font-size:9px;color:#aaa;margin-bottom:8px;">${htmlEsc(p.place)} · ${p.country === 'UA' ? 'Ukraine' : 'Israel'}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:9px;">
          <div><span style="color:#5C5A54;">STATE</span><br/><span style="color:${active ? color : '#8A877F'};">${active ? 'ACTIVE' : 'ENDED'}</span></div>
          <div><span style="color:#5C5A54;">${oblast ? 'SINCE' : 'LAST SIREN'}</span><br/><span style="color:#E8E6E0;">${htmlEsc(ago(p.since))}</span></div>
          ${Number.isFinite(count) && count > 1 ? `<div><span style="color:#5C5A54;">SIRENS (24 H)</span><br/><span style="color:#E8E6E0;">${count}</span></div>` : ''}
          <div><span style="color:#5C5A54;">SOURCE</span><br/><span style="color:#E8E6E0;">${htmlEsc(p.provider)}</span></div>
        </div>
        <div style="font-size:8px;color:#5C5A54;margin-top:6px;">${note}</div>
        <a href="${urlSafe(p.source)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:8px;padding:5px 12px;font-size:10px;letter-spacing:0.12em;text-decoration:none;border-radius:5px;color:${color};border:1px solid ${color}66;background:${color}1A;">OFFICIAL MAP</a>
      </div>`;
}
