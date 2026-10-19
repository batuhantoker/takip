import { t } from '@/lib/core/i18n/active';
import { pop } from '@/lib/map/popups/kit';

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
  const ms = Date.parse(String(iso ?? ''));
  if (!Number.isFinite(ms)) return t('unknown');
  const min = Math.round((Date.now() - ms) / 60_000);
  if (min < 1) return t('just now');
  if (min < 60) return t('{n} min ago', { n: min });
  if (min < 48 * 60) return t('{n} h ago', { n: Math.round(min / 60) });
  return new Date(ms).toISOString().slice(0, 10);
}

export function warAlertPopupHtml(p: Props): string {
  const active = p.active === true || p.active === 'true';
  const oblast = p.precision === 'oblast';
  const count = Number(p.count);
  return pop({
    kicker: p.label == null ? t('Alert') : String(p.label),
    dot: warAlertColor(p.threat),
    meta: active ? t('Active') : t('Ended'),
    title: p.place,
    subtitle: p.country === 'UA' ? t('Ukraine') : t('Israel'),
    rows: [
      { label: oblast ? t('Since') : t('Last siren'), value: ago(p.since) },
      Number.isFinite(count) && count > 1 && { label: t('Sirens, last 24 h'), value: count, mono: true },
      { label: t('Source'), value: p.provider },
    ],
    note: oblast
      ? t('An alert covers the whole oblast; the pin is its administrative centre. A warning, not a confirmed strike.')
      : t('Home Front Command siren for this locality.'),
    links: [{ href: p.source, label: t('Official map') }],
  });
}
