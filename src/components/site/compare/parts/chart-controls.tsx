import Link from 'next/link';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import type { Translate } from '@/lib/core/i18n/translator';
import { FROM_YEARS, type ChartView, type CompareView } from '@/lib/platform/site/compare/view';

type Option = { key: string; label: string; to: CompareView; on: boolean; off?: string };

/** The kit's Segmented, as links: each choice is the page with that view. */
function Group({ label, options, href }: { label: string; options: Option[]; href: (v: CompareView) => string }) {
  return (
    <div role="group" aria-label={label} className="inline-flex h-7 items-center gap-0.5 rounded-card border border-line bg-surface-0 p-0.5">
      {options.map(o => {
        const cls = cx('inline-flex h-full items-center rounded-control px-2.5 text-[12px] font-medium whitespace-nowrap', FOCUS_RING, TRANSITION);
        if (o.off) return <span key={o.key} title={o.off} aria-disabled className={cx(cls, 'cursor-not-allowed text-ink-3 opacity-40')}>{o.label}</span>;
        return (
          <Link key={o.key} href={href(o.to)} scroll={false} prefetch={false} rel="nofollow" aria-current={o.on || undefined}
            className={cx(cls, o.on ? 'bg-surface-3 text-ink-1 ring-1 ring-line ring-inset' : 'text-ink-3 hover:text-ink-1')}>
            {o.label}
          </Link>
        );
      })}
    </div>
  );
}

/** The chart's settings: the years from, values or their change, the axis, and the World's line and projections shown or not. */
export function ChartControls({ view, chart, first, projected, world, href, t }: {
  view: CompareView;
  chart: ChartView;
  /** The first year the chart reaches back to with every year shown. */
  first: number;
  projected: boolean;
  world: boolean;
  href: (v: CompareView) => string;
  t: Translate;
}) {
  const years = FROM_YEARS.filter(y => y > first);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {years.length > 0 && (
        <Group label={t('Years')} href={href} options={[
          { key: 'all', label: t('All years'), to: { ...view, from: undefined }, on: view.from === undefined },
          ...years.map(y => ({ key: String(y), label: t('Since {year}', { year: String(y) }), to: { ...view, from: y }, on: view.from === y })),
        ]} />
      )}
      <Group label={t('Values')} href={href} options={[
        { key: 'values', label: t('Values'), to: { ...view, change: false }, on: !chart.change },
        { key: 'change', label: t('chart|Change'), to: { ...view, change: true }, on: !!chart.change, off: chart.can.change ? undefined : t('These countries share no year to count the change from') },
      ]} />
      <Group label={t('Scale')} href={href} options={[
        { key: 'linear', label: t('Linear'), to: { ...view, log: false }, on: !chart.log },
        { key: 'log', label: t('Log'), to: { ...view, log: true, change: false }, on: chart.log, off: chart.can.log || chart.change ? undefined : t('A log scale needs every value above zero') },
      ]} />
      {(world || projected) && (
        <Group label={t('Show')} href={href} options={[
          ...(world ? [{ key: 'world', label: t('World'), to: { ...view, world: !chart.worldShown }, on: chart.worldShown }] : []),
          ...(projected ? [{ key: 'proj', label: t('Projection'), to: { ...view, proj: !view.proj }, on: view.proj }] : []),
        ]} />
      )}
    </div>
  );
}
