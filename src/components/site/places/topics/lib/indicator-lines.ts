import type { Translate } from '@/lib/core/i18n/translator';
import { SERIES_INK } from '@/lib/map/style/tokens';
import type { IndicatorSeries, IndicatorSpec, Yearly } from '@/lib/platform/site/places/topics/indicators-data';
import { formatNumber, seriesNames } from '@/lib/platform/site/places/topics/indicators-facts';
import type { ChartLine, ChartWords, LegendItem } from '../parts/indicator-chart';

/** The comparison line's ink: the World is context, not a place on the chart. */
export const WORLD_INK = 'var(--ink-3)';

export interface Charted { label: string; series: IndicatorSeries; slot: number }

/** The World as the subject of the chart (a measure's world page) rather than its backdrop. */
export const WORLD_STRONG_INK = 'var(--ink-1)';

/**
 * A measure's lines for one or more places, each in its SERIES_INK slot, and the World's as a hairline, with the
 * legend saying what each mark is. `bands: false` leaves out the projections' ranges, which crowd a chart of many.
 */
export function measureLines(spec: IndicatorSpec, places: Charted[], world: { e: Yearly; p?: Yearly } | undefined, t: Translate,
  { bands = true, worldStrong = false }: { bands?: boolean; worldStrong?: boolean } = {}): { lines: ChartLine[]; legend: LegendItem[] } {
  const names = seriesNames(spec, t);
  const lines: ChartLine[] = places.map(({ label, series: s, slot }, i) => ({
    key: `place-${i}`, label, ink: SERIES_INK[slot % SERIES_INK.length],
    e: s.e, ...(spec.earlier && s.l && { l: s.l }), ...(s.m && { m: s.m }), ...(s.p && { p: s.p }), ...(bands && s.lo && s.hi && { lo: s.lo, hi: s.hi }),
    ...(s.est && { est: s.est }), ...(s.unc && { unc: s.unc }),
  }));
  const worldInk = worldStrong ? WORLD_STRONG_INK : WORLD_INK;
  // A strong World leads, so the chart's end labels are its.
  if (world) lines[worldStrong ? 'unshift' : 'push']({ key: 'world', label: t('World'), ink: worldInk, faint: !worldStrong, e: world.e, ...(world.p && { p: world.p }) });

  const lead = places[0]?.series;
  // With several places the marks' keys are drawn in neutral ink: each line's colour is its place's.
  const ink = places.length > 1 ? 'var(--ink-2)' : lines.find(l => l.key === 'place-0')?.ink ?? WORLD_INK;
  const legend: LegendItem[] = [
    ...(places.length > 1 ? places.map((p, i) => ({ label: p.label, ink: lines.find(l => l.key === `place-${i}`)!.ink, mark: 'line' as const })) : [{ label: names.main, ink, mark: 'line' as const }]),
    ...(lead?.l && spec.earlier && names.earlier ? [{ label: names.earlier, ink, mark: 'faded' as const }] : []),
    ...(lead?.m && names.model ? [{ label: names.model, ink, mark: 'thin' as const }] : []),
    ...(places.some(p => p.series.p) && names.projection ? [{ label: names.projection, ink, mark: 'dashed' as const }] : []),
    ...(bands && places.some(p => p.series.lo) && names.range ? [{ label: names.range, ink, mark: 'band' as const }] : []),
    ...(places.some(p => p.series.est) ? [{ label: t('{by} estimate', { by: spec.by }), ink, mark: 'dot' as const }] : []),
    ...(places.some(p => p.series.unc) ? [{ label: t('Highly uncertain'), ink, mark: 'ring' as const }] : []),
    ...(world ? [{ label: t('World'), ink: worldInk, mark: worldStrong ? 'line' as const : 'faint' as const }] : []),
  ];
  return { lines, legend };
}

export const chartWords = (t: Translate): ChartWords => ({
  projected: t('Projected'), modelled: t('Modelled'), estimate: t('Estimate'), uncertain: t('Highly uncertain'), label: t('Values by year'),
});

/** An axis tick: short, "80", "85M", "$15K". */
export function tickFormat(spec: Pick<IndicatorSpec, 'style'>, t: Translate) {
  return (v: number) => {
    if (Math.abs(v) >= 10_000) {
      return new Intl.NumberFormat(t.intl, { notation: 'compact', maximumSignificantDigits: 3, ...(spec.style === 'usd' && { style: 'currency', currency: 'USD' }) }).format(v);
    }
    return spec.style === 'usd' ? formatNumber(v, 'usd', 0, t) : new Intl.NumberFormat(t.intl, { maximumFractionDigits: 2 }).format(v);
  };
}
