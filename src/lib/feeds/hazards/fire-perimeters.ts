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
  return `${a >= 100 ? Math.round(a).toLocaleString('en-US') : a.toFixed(1)} acres`;
}

const day = (v: unknown) => {
  const t = num(v);
  return t == null ? null : new Date(t).toISOString().slice(0, 10);
};

export const perimeterColor = (kind: unknown) => (kind === 'prescribed' ? MAP_INK.amber : MAP_INK.red);

export function firePerimeterTip(p: Props) {
  const contained = num(p.contained);
  return {
    key: `perimeter:${p.id}`,
    name: String(p.name || 'Wildfire'),
    meta: [p.kind === 'prescribed' ? 'Prescribed burn' : 'Wildfire perimeter', acresText(p.acres), contained == null ? null : `${contained}% contained`]
      .filter(Boolean).join(' · '),
  };
}

export function firePerimeterPopupHtml(p: Props): string {
  const contained = num(p.contained);
  const place = [p.county ? `${p.county} County` : null, p.state].filter(Boolean).join(', ');
  return pop({
    kicker: p.kind === 'prescribed' ? 'Prescribed burn' : 'Wildfire perimeter',
    dot: perimeterColor(p.kind),
    title: String(p.name || 'Wildfire'),
    subtitle: place ? `${place} · agency-mapped` : 'Agency-mapped',
    rows: [
      { label: 'Size', value: acresText(p.acres), mono: true },
      { label: 'Contained', value: contained == null ? null : `${contained}%`, mono: true },
      { label: 'Cause', value: p.cause ? String(p.cause) : null },
      { label: 'Discovered', value: day(p.discovered), mono: true },
      { label: 'Edge mapped', value: day(p.mapped), mono: true },
    ],
    links: [{ href: 'https://data-nifc.opendata.arcgis.com/datasets/nifc::wfigs-interagency-fire-perimeters', label: 'NIFC WFIGS' }],
  });
}
