import type { Translate } from '@/lib/core/i18n/translator';
import type { IndicatorSpec, Yearly } from '@/lib/platform/site/places/topics/indicators-data';
import { SERIES_INK } from '@/lib/map/style/tokens';
import { formatNumber, formatValue, seriesNames } from '@/lib/platform/site/places/topics/indicators-facts';
import { chartWords, measureLines, tickFormat, type Charted } from '../lib/indicator-lines';
import { IndicatorChart } from './indicator-chart';
import type { TableColumn } from './indicator-table';

type World = { e: Yearly; p?: Yearly } | undefined;

/** A measure's chart in its card: one country's page, a comparison, or a measure around the world. */
export function MeasureChartCard({ id, spec, places, world, title, desc, t, bands, worldStrong }: {
  id: string;
  spec: IndicatorSpec;
  places: Charted[];
  world: World;
  title: string;
  desc: string;
  t: Translate;
  bands?: boolean;
  worldStrong?: boolean;
}) {
  const { lines, legend } = measureLines(spec, places, world, t, { bands, worldStrong });
  return (
    <div className="rounded-card border border-line bg-surface-1 p-4 sm:p-5">
      <p className="mb-3 text-[12px] text-ink-3">{t(spec.unit)} · {spec.by}</p>
      <IndicatorChart id={id} lines={lines} legend={legend} title={title} desc={desc}
        tick={tickFormat(spec, t)} value={v => formatValue(spec, v, t)} words={chartWords(t)} />
    </div>
  );
}

/**
 * The year table for the chart: a column a place, its older run and projection folded in, and the World's; a model
 * run beside measurements (temperature) gets its own column, which its projection continues.
 */
export function measureTable(spec: IndicatorSpec, places: Charted[], world: World, t: Translate) {
  const names = seriesNames(spec, t);
  const one = places.length === 1;
  const ink = (slot: number) => (one ? undefined : SERIES_INK[slot % SERIES_INK.length]);
  const columns: TableColumn[] = [
    ...places.flatMap(({ label: place, series: s, slot }) => {
      const proj = { proj: s.p, lo: s.lo, hi: s.hi };
      return [
        { label: s.m && one ? names.main : place, ink: ink(slot), main: s.e, older: spec.earlier ? s.l : undefined, est: s.est, unc: s.unc, ...(s.m ? {} : proj) },
        ...(s.m && names.model ? [{ label: one ? names.model : t('{place}: {series}', { place, series: names.model }), ink: ink(slot), main: s.m, ...proj }] : []),
      ];
    }),
    ...(world ? [{ label: t('World'), main: world.e, proj: world.p }] : []),
  ];
  return {
    columns,
    caption: `${t(spec.unit)} · ${spec.by}`,
    number: (v: number) => formatNumber(v, spec.style, spec.digits, t),
    projection: names.projection,
    older: names.earlier,
  };
}
