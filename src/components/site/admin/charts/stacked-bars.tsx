'use client';

import { useState, type KeyboardEvent } from 'react';
import { compact, niceMax } from '@/components/site/admin/analytics/lib/format';
import { Legend, PlotFrame, Tip, XLabels } from './chart-card';

export type BarColumn = { key: string; label: string; title?: string };
export type BarSeries = { key: string; label: string; color: string; values: number[] };

/**
 * Columns stacked by series from one baseline: ≤24 px wide, 2 px surface gaps, a 4 px rounded top.
 * Each column is its own hit target; arrow keys walk them.
 */
export function StackedBars({ columns, series, format = compact, height = 140, label }: {
  columns: BarColumn[]; series: BarSeries[]; format?: (n: number) => string; height?: number; label: string;
}) {
  const [at, setAt] = useState<number | null>(null);
  const totals = columns.map((_, i) => series.reduce((s, x) => s + (x.values[i] ?? 0), 0));
  const max = niceMax(Math.max(0, ...totals));
  const n = columns.length;
  const few = n <= 12;
  const centre = (i: number) => ((i + 0.5) / n) * 100;

  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    setAt(i => Math.max(0, Math.min(n - 1, (i ?? n - 1) + (e.key === 'ArrowLeft' ? -1 : 1))));
  };

  if (!n) return null;
  return (
    <div className="flex flex-col gap-2">
      {series.length > 1 && <Legend items={series} />}
      <PlotFrame max={max} format={format} height={height}>
        <div
          role="img"
          tabIndex={0}
          aria-label={`${label}. Use the arrow keys to read each column.`}
          className="absolute inset-0 flex items-end gap-[2px] outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-[2px]"
          onFocus={() => setAt(n - 1)}
          onBlur={() => setAt(null)}
          onPointerLeave={() => setAt(null)}
          onKeyDown={key}
        >
          {columns.map((col, i) => (
            <div key={col.key} className="relative flex h-full min-w-0 flex-1 items-end justify-center" onPointerEnter={() => setAt(i)}>
              {totals[i] > 0 && (
                <div
                  className={`flex w-full max-w-6 flex-col-reverse gap-[2px] overflow-hidden rounded-t-[4px] transition-[filter] duration-150 ${at === i ? 'brightness-125' : ''}`}
                  style={{ height: `${(totals[i] / max) * 100}%` }}
                >
                  {series.map(s => (s.values[i] ?? 0) > 0 && (
                    <div key={s.key} className="min-h-px" style={{ flexGrow: s.values[i], flexBasis: 0, background: s.color }} />
                  ))}
                </div>
              )}
            </div>
          ))}
          {at !== null && (
            <Tip
              title={columns[at].title ?? columns[at].label}
              left={centre(at)}
              flip={centre(at) > 60}
              rows={[
                ...series.map(s => ({ label: s.label, value: format(s.values[at] ?? 0), color: series.length > 1 ? s.color : undefined })),
                ...(series.length > 1 ? [{ label: 'total', value: format(totals[at]) }] : []),
              ]}
            />
          )}
        </div>
      </PlotFrame>
      {few ? (
        <div className="ml-[3.25rem] flex gap-[2px] text-[11px] text-ink-3" aria-hidden>
          {columns.map(col => <span key={col.key} className="min-w-0 flex-1 truncate text-center">{col.label}</span>)}
        </div>
      ) : (
        <XLabels labels={columns.map(c => c.label)} />
      )}
    </div>
  );
}
