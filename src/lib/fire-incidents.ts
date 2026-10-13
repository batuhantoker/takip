import { htmlEsc, urlSafe } from './map-popups';

/** As /api/fires sends them in `fire_incidents`. */
export interface FireIncidentRow {
  id: string;
  name: string;
  agency: string;
  lat: number;
  lng: number;
  sizeHa: number | null;
  stage: string;
  stageLabel: string;
  cause: string | null;
  updated?: string;
  ofNote?: boolean;
  url: string;
}

type Props = NonNullable<GeoJSON.GeoJsonProperties>;

export const fireStageColor = (stage: unknown) => (stage === 'OC' ? '#FF1744' : stage === 'BH' ? '#FF9100' : '#FFD600');

export function fireIncidentFeatures(rows: FireIncidentRow[]): GeoJSON.Feature<GeoJSON.Point>[] {
  return rows
    .filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng))
    .map(r => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: { ...r, color: fireStageColor(r.stage), size: r.sizeHa ?? 0 },
    }));
}

function hectares(v: unknown): string {
  const n = Number(v);
  if (!Number.isFinite(n) || v === null || v === '') return '—';
  return n >= 1000 ? `${Math.round(n).toLocaleString('en-US')} ha` : `${n < 10 ? n.toFixed(1) : Math.round(n)} ha`;
}

export function fireIncidentPopupHtml(p: Props): string {
  const color = fireStageColor(p.stage);
  const updated = Date.parse(String(p.updated ?? ''));
  const ofNote = p.ofNote === true || p.ofNote === 'true';
  return `<div style="background:rgba(12,14,26,0.95);backdrop-filter:blur(16px);border-radius:10px;padding:16px;font-family:var(--font-hud);border:1px solid ${color}40;max-width:280px;">
        <div style="color:${color};font-size:12px;font-weight:700;margin-bottom:4px;">🔥 ${htmlEsc(p.name)}${ofNote ? ' · FIRE OF NOTE' : ''}</div>
        <div style="font-size:9px;color:#aaa;margin-bottom:8px;">${htmlEsc(p.agency)} · agency-reported wildfire</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:9px;">
          <div><span style="color:#5C5A54;">STAGE</span><br/><span style="color:${color};">${htmlEsc(p.stageLabel)}</span></div>
          <div><span style="color:#5C5A54;">SIZE</span><br/><span style="color:#E8E6E0;">${hectares(p.sizeHa)}</span></div>
          <div><span style="color:#5C5A54;">CAUSE</span><br/><span style="color:#E8E6E0;">${htmlEsc(p.cause || '—')}</span></div>
          <div><span style="color:#5C5A54;">UPDATED</span><br/><span style="color:#E8E6E0;">${Number.isFinite(updated) ? new Date(updated).toISOString().slice(0, 10) : '—'}</span></div>
        </div>
        <a href="${urlSafe(p.url)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:8px;padding:5px 12px;font-size:10px;letter-spacing:0.12em;text-decoration:none;border-radius:5px;color:${color};border:1px solid ${color}66;background:${color}1A;">INCIDENT</a>
      </div>`;
}
