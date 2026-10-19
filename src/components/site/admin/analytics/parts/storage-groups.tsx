'use client';

import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { StorageGroup } from '../analytics-types';
import { bytes, count, pct } from '../lib/format';
import { NEUTRAL } from '../lib/series';

/** Each store with its share of the data; a row opens to its biggest files and folders. */
export function StorageGroups({ groups, total }: { groups: StorageGroup[]; total: number }) {
  const [open, setOpen] = useState<string | null>(null);
  const sorted = [...groups].sort((a, b) => b.bytes - a.bytes);
  const max = Math.max(1, ...sorted.map(g => g.bytes));
  return (
    <ul className="flex flex-col">
      {sorted.map(g => {
        const expanded = open === g.id;
        return (
          <li key={g.id} className="border-b border-line last:border-b-0">
            <button
              type="button"
              aria-expanded={expanded}
              disabled={!g.items.length}
              onClick={() => setOpen(expanded ? null : g.id)}
              className="flex w-full flex-col gap-1.5 py-2.5 text-left hover:bg-surface-2/60 disabled:cursor-default disabled:hover:bg-transparent focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
            >
              <div className="flex items-baseline justify-between gap-3 text-[12px]">
                <span className="flex min-w-0 items-center gap-1.5">
                  <ChevronRight aria-hidden className={`size-3 shrink-0 text-ink-3 transition-transform ${expanded ? 'rotate-90' : ''} ${g.items.length ? '' : 'invisible'}`} />
                  <span className="text-ink-1">{g.label}</span>
                  <span className="truncate font-mono text-[11px] text-ink-3">{g.path}</span>
                </span>
                <span className="shrink-0 font-mono tabular-nums text-ink-1">
                  {bytes(g.bytes)}
                  <span className="ml-2 inline-block w-12 text-right text-ink-3">{count(g.files)} f</span>
                  <span className="ml-1 inline-block w-10 text-right text-ink-3">{pct(g.bytes, total)}</span>
                </span>
              </div>
              <div className="ml-[18px] h-1.5" aria-hidden>
                <div className="h-full rounded-r-[4px]" style={{ width: `${Math.max(g.bytes > 0 ? 0.5 : 0, (g.bytes / max) * 100)}%`, background: NEUTRAL }} />
              </div>
            </button>
            {expanded && (
              <ul className="mb-2 ml-[18px] flex flex-col border-l border-line pl-3">
                {g.items.map(item => (
                  <li key={item.name} className="flex items-baseline justify-between gap-3 py-1 text-[12px]">
                    <span className="min-w-0 truncate font-mono text-[11px] text-ink-2">{item.name}</span>
                    <span className="shrink-0 font-mono tabular-nums text-ink-2">
                      {bytes(item.bytes)}
                      <span className="ml-2 inline-block w-12 text-right text-ink-3">{count(item.files)} f</span>
                      <span className="ml-1 inline-block w-10 text-right text-ink-3">{pct(item.bytes, g.bytes)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
