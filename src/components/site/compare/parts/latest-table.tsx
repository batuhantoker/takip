import { cx } from '@/components/ui/class-names';
import type { Translate } from '@/lib/core/i18n/translator';
import { SERIES_INK } from '@/lib/map/style/tokens';
import { formatNumber } from '@/lib/platform/site/places/topics/indicators-facts';
import type { IndicatorMetricMeta, IndicatorSeries, IndicatorSpec, Yearly } from '@/lib/platform/site/places/topics/indicators-data';

const BACK = 10;

const valueIn = ([from, values]: Yearly, year: number) => values[year - from] ?? null;

function lastOf(y?: Yearly): [number, number] | undefined {
  if (!y) return undefined;
  for (let i = y[1].length - 1; i >= 0; i--) if (y[1][i] !== null) return [y[0] + i, y[1][i]!];
  return undefined;
}

type Row = { label: string; ink?: string; last?: [number, number]; before: number | null; rank?: string; proj?: [number, number] };

/** Each country's latest figure beside where it stood ten years before, its rank among all countries and its projection. */
export function LatestTable({ spec, rows, meta, t }: {
  spec: IndicatorSpec;
  rows: { label: string; slot: number; series?: IndicatorSeries }[];
  meta?: IndicatorMetricMeta;
  t: Translate;
}) {
  const n = (v: number) => formatNumber(v, spec.style, spec.digits, t);
  const world = meta?.world;
  const worldLast = lastOf(world?.e);
  const table: Row[] = [
    ...rows.flatMap(({ label, slot, series: s }) => (s ? [{
      label, ink: SERIES_INK[slot % SERIES_INK.length], last: s.f.last, before: valueIn(s.e, s.f.last[0] - BACK),
      rank: s.f.rank && t('{rank} of {n}', { rank: s.f.rank[0], n: s.f.rank[1] }), proj: s.f.proj && [s.f.proj[0], s.f.proj[1]] as [number, number],
    }] : [])),
    ...(world && worldLast ? [{ label: t('World'), last: worldLast, before: valueIn(world.e, worldLast[0] - BACK), proj: lastOf(world.p) }] : []),
  ];
  const ranked = meta?.rankYear !== undefined && table.some(r => r.rank);
  const projected = table.some(r => r.proj);
  const cell = 'px-3 py-2 text-right font-mono whitespace-nowrap tabular-nums';
  const at = (p?: [number, number]) => (p ? <>{n(p[1])} <span className="text-ink-3">{p[0]}</span></> : '—');
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12px] text-ink-3">{t(spec.unit)} · {spec.by}</p>
      <div className="overflow-x-auto rounded-card border border-line bg-surface-1">
        <table className="w-full text-[13px]">
          <thead className="bg-surface-2 text-ink-3">
            <tr>
              <th scope="col" className="px-3 py-2 text-left font-medium">{t('Country')}</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">{t('Latest')}</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">{t('{n} years before', { n: BACK })}</th>
              {ranked && <th scope="col" className="px-3 py-2 text-right font-medium">{t('Rank in {year}', { year: String(meta!.rankYear) })}</th>}
              {projected && <th scope="col" className="px-3 py-2 text-right font-medium">{t('Projected')}</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-line text-ink-2">
            {table.map(r => (
              <tr key={r.label} className={r.ink ? undefined : 'text-ink-3'}>
                <th scope="row" className={cx('px-3 py-2 text-left font-normal', r.ink && 'text-ink-1')}>
                  <span className="inline-flex items-center gap-2">
                    {r.ink && <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: r.ink }} />}
                    {r.label}
                  </span>
                </th>
                <td className={cx(cell, r.ink && 'text-ink-1')}>{at(r.last)}</td>
                <td className={cell}>{r.before === null ? '—' : n(r.before)}</td>
                {ranked && <td className={cell}>{r.rank ?? (r.ink ? '—' : '')}</td>}
                {projected && <td className={cell}>{at(r.proj)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
