import type { ReactNode } from 'react';
import { cx } from '@/components/ui/class-names';
import type { Yearly } from '@/lib/platform/site/places/topics/indicators-data';
import { points } from '../lib/chart-geometry';
import type { ChartWords } from './indicator-chart';

/** One place (or the World) in the table: its value each year from whichever of its series has one. */
export interface TableColumn {
  label: string;
  /** The place's colour on the chart, beside its name. */
  ink?: string;
  main?: Yearly;
  /** Another source's older values, before `main` begins. */
  older?: Yearly;
  proj?: Yearly;
  lo?: Yearly;
  hi?: Yearly;
  /** Years the source marks as its estimate, or as highly uncertain (SIPRI). */
  est?: number[];
  unc?: number[];
}

type Kind = 'main' | 'older' | 'proj';
type Cell = { v: number; kind: Kind; lo?: number; hi?: number; est?: boolean; unc?: boolean };

const yearMap = (s?: Yearly) => new Map(s ? points(s) : []);

function columnCells(c: TableColumn): Map<number, Cell> {
  const [main, older, proj, lo, hi] = [c.main, c.older, c.proj, c.lo, c.hi].map(yearMap);
  const est = new Set(c.est);
  const unc = new Set(c.unc);
  const out = new Map<number, Cell>();
  for (const [y, v] of proj) out.set(y, { v, kind: 'proj', lo: lo.get(y), hi: hi.get(y) });
  for (const [y, v] of older) out.set(y, { v, kind: 'older' });
  for (const [y, v] of main) out.set(y, { v, kind: 'main', est: est.has(y), unc: unc.has(y) });
  return out;
}

const Mark = ({ ring, title }: { ring?: boolean; title: string }) => (
  <span title={title} aria-label={title} className={cx('ml-1.5 inline-block size-1.5 rounded-full align-middle', ring ? 'border border-current' : 'bg-current opacity-70')} />
);

function Table({ year, columns, cells, rows, number, words, wide }: {
  year: string; columns: TableColumn[]; cells: Map<number, Cell>[]; rows: number[]; number: (v: number) => string; words: ChartWords; wide?: boolean;
}) {
  const range = (c: Cell) => (c.lo !== undefined && c.hi !== undefined ? `${number(Math.min(c.lo, c.hi))}–${number(Math.max(c.lo, c.hi))}` : null);
  return (
    <table className="w-full text-[13px]">
      <thead className="sticky top-0 z-10 bg-surface-2 text-ink-3">
        <tr>
          <th scope="col" className="w-20 px-4 py-2 text-left font-medium">{year}</th>
          {columns.map(c => (
            <th key={c.label} scope="col" className="px-4 py-2 text-right font-medium">
              <span className="inline-flex items-center justify-end gap-1.5">
                {c.ink && <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: c.ink }} />}
                {c.label}
              </span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-line font-mono tabular-nums">
        {rows.map(y => (
          <tr key={y} className="hover:bg-surface-2/60">
            <th scope="row" className="px-4 py-1.5 text-left font-normal text-ink-3">{y}</th>
            {cells.map((m, i) => {
              const c = m.get(y);
              const r = c && wide ? range(c) : null;
              return (
                <td key={columns[i].label} className={cx('px-4 py-1.5 text-right whitespace-nowrap', !c ? 'text-ink-3' : c.kind === 'main' ? 'text-ink-1' : c.kind === 'older' ? 'text-ink-3' : 'text-ink-2 italic')}>
                  {c ? number(c.v) : '–'}
                  {c?.unc ? <Mark ring title={words.uncertain} /> : c?.est ? <Mark title={words.estimate} /> : null}
                  {r && <span className="block text-[11px] text-ink-3 not-italic">{r}</span>}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Every year the chart draws, a column a place: the measured years newest first, and the projected ones with their
 * range in their own table below. The chart's twin for screen readers, search engines and copying.
 */
export function IndicatorTable({ caption, year, columns, number, words, projection, older }: {
  /** The unit and source, said once instead of in every cell. */
  caption: string;
  year: string;
  columns: TableColumn[];
  number: (v: number) => string;
  words: ChartWords;
  /** The projection's name, for its table's heading. */
  projection?: string;
  /** What the dimmed values are. */
  older?: string;
}) {
  const cells = columns.map(columnCells);
  const all = [...new Set(cells.flatMap(m => [...m.keys()]))];
  const measured = all.filter(y => cells.some(m => { const k = m.get(y)?.kind; return k === 'main' || k === 'older'; })).sort((a, b) => b - a);
  const ahead = all.filter(y => !measured.includes(y)).sort((a, b) => a - b);
  const kinds = new Set(cells.flatMap(m => [...m.values()].flatMap(c => [c.kind, ...(c.est ? ['est'] : []), ...(c.unc ? ['unc'] : [])])));
  const key: { show: boolean; sample: ReactNode; label?: string }[] = [
    { show: kinds.has('older') && !!older, sample: <span className="font-mono text-ink-3">12.3</span>, label: older },
    { show: measured.some(y => cells.some(m => m.get(y)?.kind === 'proj')), sample: <span className="font-mono text-ink-2 italic">12.3</span>, label: words.projected },
    { show: kinds.has('est'), sample: <Mark title={words.estimate} />, label: words.estimate },
    { show: kinds.has('unc'), sample: <Mark ring title={words.uncertain} />, label: words.uncertain },
  ];
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12px] text-ink-3">{caption}</p>
      {measured.length > 0 && (
        <div className="max-h-[30rem] overflow-auto rounded-card border border-line bg-surface-1">
          <Table year={year} columns={columns} cells={cells} rows={measured} number={number} words={words} />
        </div>
      )}
      {key.some(k => k.show) && (
        <ul className="flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-ink-3">
          {key.filter(k => k.show).map(k => <li key={k.label} className="inline-flex items-center gap-1.5">{k.sample}{k.label}</li>)}
        </ul>
      )}
      {ahead.length > 0 && (
        <details className="rounded-card border border-line bg-surface-1">
          <summary className="cursor-pointer px-4 py-3 text-[14px] font-medium text-ink-1">
            {projection ?? words.projected} · {ahead[0]}–{ahead[ahead.length - 1]}
          </summary>
          <div className="max-h-[30rem] overflow-auto border-t border-line">
            <Table year={year} columns={columns} cells={cells} rows={ahead} number={number} words={words} wide />
          </div>
        </details>
      )}
    </div>
  );
}
