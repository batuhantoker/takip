import { activeIntl, t } from '@/lib/core/i18n/active';
import { pop } from '@/lib/map/popups/kit';

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
  return n >= 1000 ? `${Math.round(n).toLocaleString(activeIntl())} ha` : `${n < 10 ? n.toFixed(1) : Math.round(n)} ha`;
}

export function fireIncidentPopupHtml(p: Props): string {
  const updated = Date.parse(String(p.updated ?? ''));
  const ofNote = p.ofNote === true || p.ofNote === 'true';
  return pop({
    kicker: t('Wildfire'),
    dot: fireStageColor(p.stage),
    meta: ofNote ? t('Fire of note') : undefined,
    title: p.name,
    subtitle: t('{agency} · agency-reported', { agency: String(p.agency) }),
    rows: [
      { label: t('Stage'), value: p.stageLabel },
      { label: t('Size'), value: hectares(p.sizeHa), mono: true },
      { label: t('Cause'), value: p.cause || '—' },
      { label: t('Updated'), value: Number.isFinite(updated) ? new Date(updated).toISOString().slice(0, 10) : '—', mono: true },
    ],
    links: [{ href: p.url, label: t('Incident page') }],
  });
}
