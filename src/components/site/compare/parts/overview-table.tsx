import Link from 'next/link';
import { cx, FOCUS_RING } from '@/components/ui/class-names';
import { BOX, domainOf, linePath, points, scales } from '@/components/site/places/topics/lib/chart-geometry';
import type { Translate } from '@/lib/core/i18n/translator';
import { SERIES_INK } from '@/lib/map/style/tokens';
import { formatNumber } from '@/lib/platform/site/places/topics/indicators-facts';
import { INDICATOR_GROUPS, type IndicatorSeries, type IndicatorSpec } from '@/lib/platform/site/places/topics/indicators-data';

const STROKE = { vectorEffect: 'non-scaling-stroke' as const, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, strokeWidth: 1.5 };

/** Every country's line on one small scale, estimates solid and projections dashed, no axes. */
function Sparklines({ lines }: { lines: { series: IndicatorSeries; ink: string }[] }) {
  const domain = domainOf(lines.flatMap(l => [l.series.e, l.series.p]));
  if (!domain) return null;
  const s = scales(domain);
  return (
    <svg viewBox={`0 0 ${BOX} ${BOX}`} preserveAspectRatio="none" aria-hidden className="h-8 w-full overflow-visible">
      {lines.map(({ series, ink }, i) => (
        <g key={i}>
          <path d={linePath(points(series.e), s)} stroke={ink} {...STROKE} />
          {series.p && <path d={linePath(points(series.p), s)} stroke={ink} strokeDasharray="3 3" opacity={0.8} {...STROKE} />}
        </g>
      ))}
    </svg>
  );
}

export interface OverviewRow { spec: IndicatorSpec; series: (IndicatorSeries | undefined)[]; href: string }

/**
 * Every measure the countries share, a row each under its group: each country's latest figure with a bar to scale
 * against the others', and their lines. The row's year is the latest any of them has; an older figure says its year.
 */
export function OverviewTable({ countries, rows, t }: {
  countries: { label: string; slot: number }[];
  rows: OverviewRow[];
  t: Translate;
}) {
  const ink = (slot: number) => SERIES_INK[slot % SERIES_INK.length];
  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface-1">
      <table className="w-full text-[13px]">
        <thead className="bg-surface-2 text-ink-3">
          <tr>
            <th scope="col" className="px-3 py-2 text-left font-medium">{t('Measure')}</th>
            {countries.map(c => (
              <th key={c.slot} scope="col" className="px-3 py-2 text-right font-medium whitespace-nowrap">
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: ink(c.slot) }} />{c.label}
                </span>
              </th>
            ))}
            <th scope="col" className="hidden w-36 px-3 py-2 sm:table-cell"><span className="sr-only">{t('Over the years')}</span></th>
          </tr>
        </thead>
        {INDICATOR_GROUPS.map(g => {
          const inGroup = rows.filter(r => r.spec.group === g.id);
          if (!inGroup.length) return null;
          return (
            <tbody key={g.id} className="divide-y divide-line">
              <tr className="bg-surface-2/40">
                <th scope="colgroup" colSpan={countries.length + 2} className="px-3 pt-4 pb-2 text-left text-[12px] font-semibold text-ink-2">{t(g.label)}</th>
              </tr>
              {inGroup.map(({ spec, series, href }) => {
                const year = Math.max(...series.flatMap(s => (s ? [s.f.last[0]] : [])));
                const top = Math.max(...series.flatMap(s => (s ? [Math.abs(s.f.last[1])] : []))) || 1;
                return (
                  <tr key={spec.slug} className="text-ink-2 hover:bg-surface-2/60">
                    <th scope="row" className="min-w-[10rem] px-3 py-2 text-left font-normal">
                      <Link href={href} className={cx('text-ink-1 hover:text-accent', FOCUS_RING)}>{t(spec.label)}</Link>
                      <span className="block text-[11px] text-ink-3">{t(spec.unit)} · {year}</span>
                    </th>
                    {series.map((s, i) => (
                      <td key={i} className="px-3 py-2 text-right align-top">
                        {s ? (
                          <>
                            <span className="font-mono whitespace-nowrap text-ink-1 tabular-nums">{formatNumber(s.f.last[1], spec.style, spec.digits, t)}</span>
                            {s.f.last[0] !== year && <span className="ml-1 font-mono text-[11px] text-ink-3">{s.f.last[0]}</span>}
                            <span aria-hidden className="mt-1.5 ml-auto block h-1 w-full max-w-[6rem] rounded-full bg-surface-3">
                              <span className="ml-auto block h-full rounded-full" style={{ width: `${(Math.abs(s.f.last[1]) / top) * 100}%`, background: ink(countries[i].slot), opacity: s.f.last[1] < 0 ? 0.45 : 0.85 }} />
                            </span>
                          </>
                        ) : <span className="text-ink-3">—</span>}
                      </td>
                    ))}
                    <td className="hidden px-3 py-2 sm:table-cell">
                      <Sparklines lines={series.flatMap((s, i) => (s ? [{ series: s, ink: ink(countries[i].slot) }] : []))} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          );
        })}
      </table>
    </div>
  );
}
