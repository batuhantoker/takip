import type { Yearly } from '@/lib/platform/site/places/topics/indicators-data';
import { points } from '../lib/chart-geometry';
import type { ChartWords } from './indicator-chart';

export interface TableColumn { label: string; series?: Yearly; lo?: Yearly; hi?: Yearly; est?: number[]; unc?: number[] }

/** Every year the chart draws, a column per series: the chart's twin for screen readers, search engines and copying. */
export function IndicatorTable({ summary, year, columns, value, words }: { summary: string; year: string; columns: TableColumn[]; value: (v: number) => string; words: ChartWords }) {
  const maps = columns.map(c => ({
    v: new Map(c.series ? points(c.series) : []), lo: new Map(c.lo ? points(c.lo) : []), hi: new Map(c.hi ? points(c.hi) : []), est: new Set(c.est), unc: new Set(c.unc),
  }));
  const cell = (m: (typeof maps)[number], y: number) => {
    const v = m.v.get(y);
    if (v === undefined) return '';
    const lo = m.lo.get(y);
    const hi = m.hi.get(y);
    const text = lo !== undefined && hi !== undefined ? `${value(v)} (${value(Math.min(lo, hi))}–${value(Math.max(lo, hi))})` : value(v);
    const mark = m.unc.has(y) ? words.uncertain : m.est.has(y) ? words.estimate : undefined;
    return mark ? `${text} · ${mark}` : text;
  };
  const years = [...new Set(maps.flatMap(m => [...m.v.keys()]))].sort((a, b) => b - a);
  return (
    <details className="rounded-card border border-line bg-surface-1">
      <summary className="cursor-pointer px-4 py-3 text-[14px] font-medium text-ink-1">{summary}</summary>
      <div className="max-h-[480px] overflow-auto border-t border-line">
        <table className="w-full text-left text-[13px]">
          <thead className="sticky top-0 bg-surface-2 text-ink-3">
            <tr>
              <th scope="col" className="px-4 py-2 font-medium">{year}</th>
              {columns.map(c => <th key={c.label} scope="col" className="px-4 py-2 font-medium">{c.label}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-line font-mono text-ink-2 tabular-nums">
            {years.map(y => (
              <tr key={y}>
                <th scope="row" className="px-4 py-1.5 font-normal text-ink-3">{y}</th>
                {maps.map((m, i) => <td key={columns[i].label} className="px-4 py-1.5">{cell(m, y)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
