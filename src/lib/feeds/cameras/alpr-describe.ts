import { t } from '@/lib/core/i18n/active';
import { pop, sentence } from '@/lib/map/popups/kit';
import { ALPR_COLOR } from './alpr-layers';

type Props = Record<string, unknown>;

const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
const text = (v: unknown) => (typeof v === 'string' && v.trim() && v.trim() !== '?' ? v.trim() : undefined);
const degrees = (v: unknown) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : ((Number(v) % 360) + 360) % 360);

export const compassPoint = (deg: number) => COMPASS[Math.round(deg / 22.5) % 16];

/** Only the density tiles below z9 lack an id; they name nothing. */
export const isAlprCamera = (p: Props) => p.osmId != null;

/** "178° S", "200° SSW, 339° NNW", or the mapped cardinal when no bearing was given. */
export function alprFacing(p: Props): string | undefined {
  let list: number[] = [];
  try {
    const parsed: unknown = JSON.parse(String(p.directions ?? ''));
    if (Array.isArray(parsed)) list = parsed.map(degrees).filter((d): d is number => d != null);
  } catch { /* absent or not a list */ }
  const one = degrees(p.direction);
  if (!list.length && one != null) list = [one];
  list = [...new Set(list.map(d => Math.round(d)))];
  if (list.length) return list.map(d => `${d}° ${compassPoint(d)}`).join(', ');
  return text(p.directionCardinal)?.toUpperCase();
}

export function alprTip(p: Props): { key: string; name: string; meta: string } | null {
  if (!isAlprCamera(p)) return null;
  const facing = alprFacing(p);
  return {
    key: `alpr:${p.osmId}`,
    name: text(p.operator) ?? t('Licence-plate reader'),
    meta: [text(p.brand) ?? t('Plate reader'), facing && t('facing {facing}', { facing })].filter(Boolean).join(' · '),
  };
}

export function alprPopupHtml(p: Props): string {
  const operator = text(p.operator);
  const edited = text(p.osmTimestamp)?.slice(0, 10);
  const osmType = p.osmType === 'way' ? 'way' : 'node';
  const facing = alprFacing(p);
  return pop({
    kicker: t('Licence-plate reader'),
    dot: ALPR_COLOR,
    // The last OSM edit, not a survey date.
    meta: edited ? t('edited {date}', { date: edited }) : undefined,
    title: operator ?? text(p.brand) ?? t('ALPR camera'),
    subtitle: operator ? undefined : t('Operator not mapped'),
    rows: [
      { label: t('Maker'), value: operator ? text(p.brand) : undefined },
      { label: t('Facing'), value: facing },
      { label: t('Mounted on'), value: text(p.mountType) && sentence(p.mountType) },
      { label: t('Watching'), value: text(p.surveillanceZone) && sentence(p.surveillanceZone) },
      { label: t('Since'), value: text(p.startDate), mono: true },
      { label: t('Ref'), value: text(p.ref), mono: true },
    ],
    note: [
      t('Mapped by volunteers on OpenStreetMap; it may be out of date.'),
      facing && t('The cone shows the mapped direction; its width and reach are typical for these cameras, not measured.'),
    ].filter(Boolean).join(' '),
    links: [{ href: `https://www.openstreetmap.org/${osmType}/${encodeURIComponent(String(p.osmId))}`, label: 'OpenStreetMap' }],
  });
}
