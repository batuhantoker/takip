'use client';

import { useState, type ReactNode } from 'react';
import { TABLE, TD, TH } from '@/components/site/admin/parts/admin-parts';

/** The chart's twin as plain rows, so no value is only reachable by hovering. */
export type TableView = { columns: string[]; rows: (string | number)[][] };

export function ChartCard({ title, note, actions, table, children, className = '' }: {
  title: string; note?: ReactNode; actions?: ReactNode; table?: TableView | null; children: ReactNode; className?: string;
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <section className={`rounded-card border border-line bg-surface-1 min-w-0 ${className}`}>
      <header className="flex items-start justify-between gap-3 px-4 pt-3 pb-2">
        <div className="min-w-0">
          <h2 className="text-[12px] font-medium text-ink-2">{title}</h2>
          {note && <div className="mt-0.5 text-[11px] text-ink-3">{note}</div>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {actions}
          {table && table.rows.length > 0 && (
            <button
              type="button"
              onClick={() => setAsTable(v => !v)}
              aria-pressed={asTable}
              className="h-6 rounded-[6px] px-2 text-[11px] text-ink-3 hover:bg-surface-2 hover:text-ink-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {asTable ? 'Chart' : 'Table'}
            </button>
          )}
        </div>
      </header>
      <div className="px-4 pb-4 pt-1 flex flex-col gap-3">
        {asTable && table ? <DataTable table={table} /> : children}
      </div>
    </section>
  );
}

function DataTable({ table }: { table: TableView }) {
  return (
    <div className="max-h-80 overflow-auto">
      <table className={TABLE}>
        <thead className="sticky top-0 bg-surface-1">
          <tr>{table.columns.map((c, i) => <th key={c} className={`${TH} ${i ? 'text-right' : ''}`}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {table.rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, i) => (
                <td key={i} className={`${TD} ${i ? 'text-right font-mono tabular-nums' : 'whitespace-nowrap'}`}>
                  {typeof cell === 'number' ? cell.toLocaleString('en') : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export type LegendItem = { label: string; color: string };

/** Mirrors the mark: a short line for lines, a square for bars and areas. */
export function Legend({ items, shape = 'rect' }: { items: LegendItem[]; shape?: 'rect' | 'line' }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-2">
      {items.map(item => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span aria-hidden className={shape === 'line' ? 'h-[2px] w-3 rounded-full' : 'size-2 rounded-[2px]'} style={{ background: item.color }} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

export type TipRow = { label: string; value: string; color?: string };

/** Values lead, series names follow; keyed with a short stroke of the series colour. */
export function Tip({ title, rows, left, flip }: { title: string; rows: TipRow[]; left: number; flip: boolean }) {
  return (
    <div
      role="status"
      className="pointer-events-none absolute top-1 z-10 min-w-36 rounded-[8px] border border-line-strong bg-surface-2 px-2.5 py-2 shadow-float"
      style={{ left: `${left}%`, transform: flip ? 'translateX(calc(-100% - 10px))' : 'translateX(10px)' }}
    >
      <div className="mb-1 text-[11px] text-ink-3 whitespace-nowrap">{title}</div>
      {rows.map(row => (
        <div key={row.label} className="flex items-center gap-2 text-[12px] leading-5 whitespace-nowrap">
          {row.color && <span aria-hidden className="h-[2px] w-2.5 rounded-full" style={{ background: row.color }} />}
          <span className="font-mono tabular-nums text-ink-1">{row.value}</span>
          <span className="text-ink-3">{row.label}</span>
        </div>
      ))}
    </div>
  );
}

/** Three hairlines (top, middle, baseline) and their tick labels, behind a plot of `height` px. */
export function PlotFrame({ max, format, height, children }: { max: number; format: (n: number) => string; height: number; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[2.75rem_minmax(0,1fr)] gap-2">
      <div className="relative text-right text-[11px] text-ink-3 font-mono tabular-nums" style={{ height }} aria-hidden>
        <span className="absolute right-0 top-0 -translate-y-1/2">{format(max)}</span>
        <span className="absolute right-0 top-1/2 -translate-y-1/2">{format(max / 2)}</span>
        <span className="absolute right-0 bottom-0 translate-y-1/2">0</span>
      </div>
      <div className="relative" style={{ height }}>
        <div aria-hidden className="absolute inset-x-0 top-0 border-t border-line" />
        <div aria-hidden className="absolute inset-x-0 top-1/2 border-t border-line" />
        <div aria-hidden className="absolute inset-x-0 bottom-0 border-t border-line-strong" />
        {children}
      </div>
    </div>
  );
}

/** First, middle and last labels under a plot; all of them when there are few. */
export function XLabels({ labels }: { labels: string[] }) {
  if (!labels.length) return null;
  const shown = labels.length <= 8 ? labels : [labels[0], labels[Math.floor((labels.length - 1) / 2)], labels[labels.length - 1]];
  return (
    <div className="ml-[3.25rem] flex justify-between gap-1 text-[11px] text-ink-3 font-mono tabular-nums" aria-hidden>
      {shown.map((label, i) => <span key={`${label}-${i}`} className="whitespace-nowrap">{label}</span>)}
    </div>
  );
}
