'use client';

import { useState, type KeyboardEvent, type PointerEvent } from 'react';
import { cx, FOCUS_RING } from '@/components/ui/class-names';

/** A year and each line's value that year, already in the reader's language ('' where a line has none). */
export interface HoverRow { year: number; cells: string[] }

/**
 * The crosshair over an indicator chart: the nearest year with a value under the pointer, or stepped with the
 * arrow keys, and every line's value then. The table below the chart holds the same numbers for anyone without it.
 */
export function ChartHover({ from, to, rows, keys, label }: {
  from: number;
  to: number;
  rows: HoverRow[];
  keys: { label: string; ink: string }[];
  label: string;
}) {
  const [i, setI] = useState<number | null>(null);
  if (!rows.length) return null;
  const x = (year: number) => (to === from ? 50 : ((year - from) / (to - from)) * 100);

  const nearest = (year: number) => {
    let best = 0;
    for (let k = 1; k < rows.length; k++) if (Math.abs(rows[k].year - year) < Math.abs(rows[best].year - year)) best = k;
    return best;
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    setI(nearest(from + ((e.clientX - box.left) / box.width) * (to - from)));
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : e.key === 'End' ? rows.length : e.key === 'Home' ? -rows.length : 0;
    if (!step) return;
    e.preventDefault();
    setI(k => Math.min(rows.length - 1, Math.max(0, (k ?? rows.length - 1) + step)));
  };

  const row = i === null ? null : rows[i];
  const left = row ? x(row.year) : 0;
  return (
    <div role="group" aria-label={label} tabIndex={0} onPointerMove={onMove} onPointerLeave={() => setI(null)} onKeyDown={onKey}
      onFocus={() => setI(k => k ?? rows.length - 1)} onBlur={() => setI(null)} className={cx('absolute inset-0 rounded-[2px]', FOCUS_RING)}>
      {row && (
        <>
          <span aria-hidden className="pointer-events-none absolute inset-y-0 w-px bg-ink-3" style={{ left: `${left}%` }} />
          <div role="status" className={cx('pointer-events-none absolute top-1 z-10 min-w-36 rounded-control border border-line-strong bg-surface-2 px-2.5 py-2 text-[12px] shadow-lg',
            left > 60 ? '-translate-x-[calc(100%+8px)]' : 'translate-x-2')} style={{ left: `${left}%` }}>
            <p className="font-mono font-medium text-ink-1 tabular-nums">{row.year}</p>
            <ul className="mt-1 flex flex-col gap-0.5">
              {keys.map((k, n) => row.cells[n] && (
                <li key={k.label} className="flex items-center gap-1.5 whitespace-nowrap text-ink-2">
                  <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: k.ink }} />
                  <span className="text-ink-3">{k.label}</span>
                  <span className="ml-auto pl-3 text-ink-1">{row.cells[n]}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
