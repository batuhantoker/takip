import type { Translate } from '@/lib/core/i18n/translator';
import type { IndicatorSpec, Yearly } from '@/lib/platform/site/places/topics/indicators-data';
import { formatValue, seriesNames } from '@/lib/platform/site/places/topics/indicators-facts';
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

/** The table's columns: each place's series as the chart draws them, then the World's. */
export function measureColumns(spec: IndicatorSpec, places: Charted[], world: World, t: Translate): TableColumn[] {
  const names = seriesNames(spec, t);
  const one = places.length === 1;
  const label = (place: string, series: string) => (one ? series : t('{place}: {series}', { place, series }));
  return [
    ...places.flatMap(({ label: place, series: s }) => [
      { label: one ? names.main : place, series: s.e, est: s.est, unc: s.unc },
      ...(spec.earlier && s.l && names.earlier ? [{ label: label(place, names.earlier), series: s.l }] : []),
      ...(s.m && names.model ? [{ label: label(place, names.model), series: s.m }] : []),
      ...(s.p && names.projection ? [{ label: label(place, names.range ? `${names.projection} (${names.range})` : names.projection), series: s.p, lo: s.lo, hi: s.hi }] : []),
    ]),
    ...(world ? [{ label: t('World'), series: world.e }] : []),
    ...(world?.p ? [{ label: t('World, projected'), series: world.p }] : []),
  ];
}
