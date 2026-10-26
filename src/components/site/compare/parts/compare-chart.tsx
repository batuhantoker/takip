import Link from 'next/link';
import { cx, FOCUS_RING } from '@/components/ui/class-names';
import { chartWords, measureLines, tickFormat, type Charted } from '@/components/site/places/topics/lib/indicator-lines';
import { IndicatorChart } from '@/components/site/places/topics/parts/indicator-chart';
import type { Translate } from '@/lib/core/i18n/translator';
import { chartView, type ChartView, type CompareView } from '@/lib/platform/site/compare/view';
import { formatNumber, formatValue } from '@/lib/platform/site/places/topics/indicators-facts';
import type { IndicatorSeries, IndicatorSpec, Yearly } from '@/lib/platform/site/places/topics/indicators-data';
import { ChartControls } from './chart-controls';

export interface Entry { label: string; series?: IndicatorSeries; slot: number }

const signed = (s: string, v: number) => (v > 0 ? `+${s}` : s);

/** The axis ticks, the values in full and the unit line, for the values or their change: in percent, percentage points for a share, or the unit. */
function formats(spec: IndicatorSpec, change: ChartView['change'], t: Translate) {
  if (!change) return { tick: tickFormat(spec, t), value: (v: number) => formatValue(spec, v, t), caption: t(spec.unit) };
  const year = String(change.base);
  if (change.relative) {
    const pct = (v: number) => new Intl.NumberFormat(t.intl, { style: 'percent', signDisplay: 'exceptZero', maximumFractionDigits: Math.abs(v) < 10 ? 1 : 0 }).format(v / 100);
    return { tick: pct, value: pct, caption: t('Change since {year}, %', { year }) };
  }
  const tick = (v: number) => signed(tickFormat(spec, t)(v), v);
  return spec.value.includes('%')
    ? { tick, value: (v: number) => t('{v} percentage points', { v: signed(formatNumber(v, spec.style, spec.digits, t), v) }), caption: t('Change since {year}, percentage points', { year }) }
    : { tick, value: (v: number) => signed(formatValue(spec, v, t), v), caption: t('Change since {year}, {unit}', { year, unit: t(spec.unit) }) };
}

/** A measure for every country compared, drawn as the reader's view asks, with its settings above it when given `href`. */
export function CompareChart({ id, spec, entries, world, view, title, desc, t, href, size = 'wide', heading }: {
  id: string;
  spec: IndicatorSpec;
  entries: Entry[];
  world?: { e: Yearly; p?: Yearly };
  view: CompareView;
  title: string;
  desc: string;
  t: Translate;
  href?: (v: CompareView) => string;
  size?: 'hero' | 'wide';
  /** The measure's name over the chart, leading to its page. */
  heading?: { label: string; href: string };
}) {
  const chart = chartView(spec, entries.map(e => e.series), world, view);
  const places: Charted[] = entries.flatMap((e, i) => {
    const series = chart.places[i];
    return series ? [{ label: e.label, series, slot: e.slot }] : [];
  });
  // Projection ranges crowd a chart of more than two.
  const { lines, legend } = measureLines(spec, places, chart.world, t, { bands: places.length <= 2 });
  const raw = entries.flatMap(e => (e.series ? [e.series] : []));
  const { tick, value, caption } = formats(spec, chart.change, t);
  // On a phone the settings follow the chart, so the chart is what the first screen reaches.
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-card border border-line bg-surface-1 p-4 sm:p-5">
      {heading && <Link href={heading.href} className={cx('-mb-2 w-full text-[14px] font-medium text-ink-1 hover:text-accent', FOCUS_RING)}>{heading.label} →</Link>}
      <p className="text-[12px] text-ink-3">
        {caption} · {spec.by}{chart.log ? ` · ${t('log scale')}` : ''}
      </p>
      {href && (
        <div className="order-last w-full sm:order-none sm:w-auto">
          <ChartControls view={view} chart={chart} href={href} t={t}
            first={Math.min(...raw.map(s => Math.min(s.f.first[0], s.l?.[0] ?? Infinity)))} world={!!world} projected={raw.some(s => s.p)} />
        </div>
      )}
      <div className="w-full">
        {places.length ? (
          <IndicatorChart id={id} lines={lines} legend={legend} title={title} desc={desc} size={size} log={chart.log}
            tick={tick} value={value} words={chartWords(t)} />
        ) : (
          <p className="py-16 text-center text-[14px] text-ink-3">{t('None of these countries has a figure in these years.')}</p>
        )}
      </div>
    </div>
  );
}
