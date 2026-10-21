'use client';

import { useState, type ReactNode } from 'react';
import { TABLE, TD, TH } from '@/components/site/admin/parts/admin-parts';
import type { SearchStats } from '../analytics-types';
import { count, pct } from '../lib/format';

const NUM = `${TD} text-right font-mono tabular-nums whitespace-nowrap`;

export const position = (p: number | null) => (p == null ? '—' : p.toFixed(1));

/** Rows of Search Console numbers: a label, then clicks, impressions, click rate and average position. */
export function SearchTable<T extends SearchStats>({ rows, label, head, limit = 12, selected, onPick, empty = 'Nothing in this range.' }: {
  rows: T[]; label: (row: T) => ReactNode; head: string; limit?: number; selected?: (row: T) => boolean; onPick?: (row: T) => void; empty?: string;
}) {
  const [all, setAll] = useState(false);
  if (!rows.length) return <p className="text-[12px] text-ink-3">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className={TABLE}>
        <thead>
          <tr>
            <th className={TH}>{head}</th>
            <th className={`${TH} text-right`}>Clicks</th>
            <th className={`${TH} text-right`}>Shown</th>
            <th className={`${TH} text-right`}>Click rate</th>
            <th className={`${TH} text-right`} title="Average position in Google's results; 1 is the top">Position</th>
          </tr>
        </thead>
        <tbody>
          {(all ? rows : rows.slice(0, limit)).map((row, i) => (
            <tr key={i} className={selected?.(row) ? 'bg-surface-2' : undefined}>
              <td className={`${TD} max-w-0 w-full`}>
                {onPick
                  ? <button type="button" onClick={() => onPick(row)} className="block max-w-full truncate text-left hover:underline">{label(row)}</button>
                  : <span className="block truncate">{label(row)}</span>}
              </td>
              <td className={NUM}>{count(row.clicks)}</td>
              <td className={NUM}>{count(row.impressions)}</td>
              <td className={NUM}>{pct(row.clicks, row.impressions, 1)}</td>
              <td className={NUM}>{position(row.position)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > limit && (
        <button type="button" onClick={() => setAll(v => !v)} className="mt-2 text-[12px] text-accent hover:underline">
          {all ? 'Show fewer' : `Show all ${rows.length}`}
        </button>
      )}
    </div>
  );
}
