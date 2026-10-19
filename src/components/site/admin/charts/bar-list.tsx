'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { compact, pct } from '@/components/site/admin/analytics/lib/format';
import { NEUTRAL } from '@/components/site/admin/analytics/lib/series';

export type BarRow = { key: string; label: ReactNode; value: number; detail?: ReactNode; href?: string; color?: string };

/** Ranked horizontal bars, labelled with the value and its share of `total` (the rows' sum by default). */
export function BarList({ rows, format = compact, total, limit = 8, empty = 'No data yet.', share = true }: {
  rows: BarRow[]; format?: (n: number) => string; total?: number; limit?: number; empty?: string; share?: boolean;
}) {
  const [all, setAll] = useState(false);
  if (!rows.length) return <p className="text-[12px] text-ink-3">{empty}</p>;
  const whole = total ?? rows.reduce((s, r) => s + r.value, 0);
  const max = Math.max(1, ...rows.map(r => r.value));
  const shown = all ? rows : rows.slice(0, limit);
  return (
    <div className="flex flex-col gap-2.5">
      <ul className="flex flex-col gap-2.5">
        {shown.map(row => {
          const label = row.href ? <Link href={row.href} className="hover:underline">{row.label}</Link> : row.label;
          return (
            <li key={row.key} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-3 text-[12px]">
                <span className="min-w-0 truncate text-ink-1">{label}</span>
                <span className="shrink-0 font-mono tabular-nums text-ink-1">
                  {format(row.value)}
                  {share && <span className="ml-2 inline-block w-10 text-right text-ink-3">{pct(row.value, whole)}</span>}
                </span>
              </div>
              <div className="h-1.5" aria-hidden>
                <div className="h-full rounded-r-[4px]" style={{ width: `${Math.max(row.value > 0 ? 0.5 : 0, (row.value / max) * 100)}%`, background: row.color ?? NEUTRAL }} />
              </div>
              {row.detail && <div className="text-[11px] text-ink-3">{row.detail}</div>}
            </li>
          );
        })}
      </ul>
      {rows.length > limit && (
        <button type="button" onClick={() => setAll(v => !v)} className="self-start text-[12px] text-accent hover:underline">
          {all ? 'Show fewer' : `Show all ${rows.length}`}
        </button>
      )}
    </div>
  );
}
