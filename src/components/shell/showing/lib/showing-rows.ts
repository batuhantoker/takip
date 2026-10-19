import { FAMILY_TEXT } from '@/components/panels/history/lib/history-content';
import { HISTORY_FALLBACK_COLOR, HISTORY_FAMILIES } from '@/lib/history/popup';
import { ALIGNMENTS, WAR_LAYERS } from '@/lib/history/war-layers';
import { clockYear, clockYearLabel, FIRST_YEAR, LAST_YEAR, WORLD_BORDERS } from '@/lib/history/world-borders';
import { MAP_INK } from '@/lib/map/style/tokens';
import { periodAt } from '@/lib/history/paleo/deep-time';
import type { Translate } from '@/lib/core/i18n/translator';
import { ENGLISH, layerLabel, layersDrawn, type ShowingState } from './showing-state';

/** What switching a row off does, in the same state the Layers and History panels use. */
export type OffAction =
  | { kind: 'layer'; key: string }
  | { kind: 'family'; family: string }
  | { kind: 'borders'; code: string }
  | { kind: 'countries'; code: string }
  | { kind: 'deep' }
  | { kind: 'arcgis'; id: string };

/** A live layer keys itself as the Layers panel does; the rest are plain colour marks. */
export type RowSwatch =
  | { kind: 'layer'; key: string }
  | { kind: 'mark'; shape: 'dot' | 'square' | 'bar'; colors: string[] };

export type ShowingRow = {
  id: string;
  label: string;
  /** Quiet context after the name, such as the year of the borders. */
  meta?: string;
  swatch: RowSwatch;
  /** Absent where nothing can hide it short of deleting it (drawn areas). */
  off?: OffAction;
  /** A number in place of the switch. */
  value?: number;
};

export type ShowingGroup = { id: string; title: string; rows: ShowingRow[] };

const mark = (shape: 'dot' | 'square' | 'bar', ...colors: string[]): RowSwatch => ({ kind: 'mark', shape, colors });

/** The year whose borders show: Cliopatria's last year stays on after it, and nothing comes before its first. */
function bordersYear(time: number | null, t: Translate) {
  if (time === null) return undefined;
  const y = clockYear(time);
  return y < FIRST_YEAR ? undefined : clockYearLabel(Math.min(y, LAST_YEAR), t);
}

function pastGroups(s: ShowingState, t: Translate): ShowingGroup[] {
  if (s.mode === 'deep') {
    const period = s.ma === null ? null : periodAt(s.ma);
    return [{
      id: 'deep',
      title: t('Deep time'),
      rows: [{ id: 'deep', label: t('Moving continents'), meta: period ? t(period.name) : undefined, swatch: mark('dot', period?.color ?? MAP_INK.ink2), off: { kind: 'deep' } }],
    }];
  }
  if (s.mode !== 'history') return [];
  const events = Object.keys(HISTORY_FAMILIES).filter(f => s.families.includes(f)).map((family): ShowingRow => ({
    id: `family:${family}`,
    label: t(FAMILY_TEXT[family]?.name ?? HISTORY_FAMILIES[family].label),
    swatch: mark('dot', HISTORY_FAMILIES[family].color ?? HISTORY_FALLBACK_COLOR),
    off: { kind: 'family', family },
  }));
  const borders: ShowingRow[] = [];
  if (s.borders === WORLD_BORDERS.code) {
    borders.push({ id: `borders:${s.borders}`, label: t(WORLD_BORDERS.label), meta: bordersYear(s.time, t), swatch: mark('square', MAP_INK.blue, MAP_INK.violet, MAP_INK.teal), off: { kind: 'borders', code: s.borders } });
  } else if (s.borders) {
    const war = WAR_LAYERS.find(w => w.code === s.borders);
    const color = (key: string) => ALIGNMENTS.find(a => a.key === key)?.color ?? MAP_INK.ink2;
    borders.push({ id: `borders:${s.borders}`, label: war ? t(war.label) : s.borders, meta: war?.years, swatch: mark('square', color('axis'), color('allied')), off: { kind: 'borders', code: s.borders } });
  }
  const countries: ShowingRow[] = s.colouring
    ? [{ id: `countries:${s.colouring.code}`, label: t(s.colouring.name), swatch: mark('bar', ...s.colouring.ramp), off: { kind: 'countries', code: s.colouring.code } }]
    : [];
  return [
    { id: 'events', title: t('Events'), rows: events },
    { id: 'borders', title: t('Borders'), rows: borders },
    { id: 'countries', title: t('Colour countries by'), rows: countries },
  ];
}

/** What the map draws right now, grouped by kind: the past first, then layers, ArcGIS layers and drawn areas. */
export function rowsFor(s: ShowingState, t: Translate = ENGLISH): ShowingGroup[] {
  const layers = layersDrawn(s.layers, s.mode).map((l): ShowingRow => ({
    id: `layer:${l.key}`, label: layerLabel(l, t), swatch: { kind: 'layer', key: l.key }, off: { kind: 'layer', key: l.key },
  }));
  const arcgis = s.arcgis.map((l): ShowingRow => ({
    id: `arcgis:${l.id}`, label: l.title, swatch: mark('square', l.color), off: { kind: 'arcgis', id: l.id },
  }));
  const areas: ShowingRow[] = s.areas.count
    ? [{ id: 'areas', label: t('{n, plural, one {Drawn area} other {Drawn areas}}', { n: s.areas.count }), swatch: mark('square', s.areas.color ?? MAP_INK.ink2), value: s.areas.count }]
    : [];
  return [
    ...pastGroups(s, t),
    { id: 'layers', title: t('Layers'), rows: layers },
    { id: 'arcgis', title: t('ArcGIS layers'), rows: arcgis },
    { id: 'areas', title: t('Areas'), rows: areas },
  ].filter(g => g.rows.length > 0);
}

/** The number on the chip: one per row. */
export const countRows = (groups: ShowingGroup[]) => groups.reduce((n, g) => n + g.rows.length, 0);
