'use client';

import { useState, type ReactNode } from 'react';
import { Legend } from '@/components/site/admin/charts/chart-card';
import { count, pct } from '../lib/format';
import { NEXT_LABEL, NEXT_ORDER, STEP_INK, type OutcomeRow } from '../lib/journeys';

/** One row per origin or landing page: its visits, and a full-width bar split by what those visits did next. */
export function OutcomeList({ rows, label, onPick, limit = 8 }: {
  rows: OutcomeRow[]; label: (key: string) => ReactNode; onPick?: (key: string) => void; limit?: number;
}) {
  const [all, setAll] = useState(false);
  if (!rows.length) return <p className="text-[12px] text-ink-3">No visits in this range.</p>;
  const shown = all ? rows : rows.slice(0, limit);
  return (
    <div className="flex flex-col gap-3">
      <Legend items={NEXT_ORDER.map(n => ({ label: NEXT_LABEL[n], color: STEP_INK[n] }))} />
      <ul className="flex flex-col gap-2.5">
        {shown.map(row => (
          <li key={row.key} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-3 text-[12px]">
              {onPick
                ? <button type="button" onClick={() => onPick(row.key)} className="min-w-0 truncate text-left text-ink-1 hover:underline">{label(row.key)}</button>
                : <span className="min-w-0 truncate text-ink-1">{label(row.key)}</span>}
              <span className="shrink-0 font-mono tabular-nums text-ink-1">{count(row.visits)}</span>
            </div>
            <div className="flex h-1.5 gap-[2px]" aria-hidden>
              {NEXT_ORDER.filter(n => row.outcomes[n]).map(n => (
                <div key={n} className="h-full first:rounded-l-[3px] last:rounded-r-[3px]" style={{ width: `${(row.outcomes[n] / row.visits) * 100}%`, background: STEP_INK[n] }} />
              ))}
            </div>
            <div className="text-[11px] text-ink-3">
              {NEXT_ORDER.map(n => `${pct(row.outcomes[n], row.visits)} ${n === 'map' ? 'to the map' : n === 'page' ? 'read on' : 'left'}`).join(' · ')}
            </div>
          </li>
        ))}
      </ul>
      {rows.length > limit && (
        <button type="button" onClick={() => setAll(v => !v)} className="self-start text-[12px] text-accent hover:underline">
          {all ? 'Show fewer' : `Show all ${rows.length}`}
        </button>
      )}
    </div>
  );
}
