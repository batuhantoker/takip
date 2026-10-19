import { activeIntl, t } from '@/lib/core/i18n/active';
import { pop } from '@/lib/map/popups/kit';
import { MAP_INK } from '@/lib/map/style/tokens';

/*
 * US wildfire perimeters from NIFC WFIGS (/api/fires/perimeters): the agencies' mapped edge of each
 * fire, drawn under the satellite hotspots.
 */

export const FIRE_PERIMETER_FILL = 'fire-perimeter-fill';
export const FIRE_PERIMETER_LINE = 'fire-perimeter-line';
export const FIRE_PERIMETER_SOURCE = 'fire-perimeters';

type Props = Record<string, unknown>;

const num = (v: unknown) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

export function acresText(v: unknown): string | null {
  const a = num(v);
  if (a == null) return null;
  return t('{area} acres', { area: a >= 100 ? Math.round(a).toLocaleString(activeIntl()) : a.toFixed(1) });
}

const day = (v: unknown) => {
  const ms = num(v);
  return ms == null ? null : new Date(ms).toISOString().slice(0, 10);
};

export const perimeterColor = (kind: unknown) => (kind === 'prescribed' ? MAP_INK.amber : MAP_INK.red);

export function firePerimeterTip(p: Props) {
  const contained = num(p.contained);
  return {
    key: `perimeter:${p.id}`,
    name: p.name ? String(p.name) : t('Wildfire'),
    meta: [p.kind === 'prescribed' ? t('Prescribed burn') : t('Wildfire perimeter'), acresText(p.acres), contained == null ? null : t('{pct}% contained', { pct: contained })]
      .filter(Boolean).join(' · '),
  };
}

export function firePerimeterPopupHtml(p: Props): string {
  const contained = num(p.contained);
  const place = [p.county ? t('{county} County', { county: String(p.county) }) : null, p.state].filter(Boolean).join(', ');
  return pop({
    kicker: p.kind === 'prescribed' ? t('Prescribed burn') : t('Wildfire perimeter'),
    dot: perimeterColor(p.kind),
    title: p.name ? String(p.name) : t('Wildfire'),
    subtitle: place ? t('{place} · agency-mapped', { place }) : t('Agency-mapped'),
    rows: [
      { label: t('Size'), value: acresText(p.acres), mono: true },
      { label: t('Contained'), value: contained == null ? null : `${contained}%`, mono: true },
      { label: t('Cause'), value: p.cause ? String(p.cause) : null },
      { label: t('Discovered'), value: day(p.discovered), mono: true },
      { label: t('Edge mapped'), value: day(p.mapped), mono: true },
    ],
    links: [{ href: 'https://data-nifc.opendata.arcgis.com/datasets/nifc::wfigs-interagency-fire-perimeters', label: 'NIFC WFIGS' }],
  });
}
