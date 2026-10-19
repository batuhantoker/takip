'use client';

import { ChevronRight } from 'lucide-react';
import { useState, type ReactNode } from 'react';

const KEY = 'takip.admin.analytics.open';

function readOpen(): string[] {
  try {
    const v: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * The detail a section keeps one click away: closed by default, with what it holds named in the summary, and left
 * open on the next visit if it was open on this one.
 */
export function More({ id, title, holds, children }: { id: string; title: string; holds: string; children: ReactNode }) {
  const [open, setOpen] = useState(() => typeof window !== 'undefined' && readOpen().includes(id));
  const toggle = (next: boolean) => {
    setOpen(next);
    try {
      const rest = readOpen().filter(x => x !== id);
      window.localStorage.setItem(KEY, JSON.stringify(next ? [...rest, id] : rest));
    } catch { /* storage blocked */ }
  };
  return (
    <details open={open} onToggle={e => { if (e.currentTarget.open !== open) toggle(e.currentTarget.open); }} className="group/more">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-control py-1 text-[13px] font-semibold text-ink-1 focus-visible:outline-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden">
        <ChevronRight aria-hidden className="size-4 text-ink-3 transition-transform group-open/more:rotate-90" />
        {title}
        <span className="font-normal text-[12px] text-ink-3">{holds}</span>
      </summary>
      {open && <div className="mt-3 flex flex-col gap-4">{children}</div>}
    </details>
  );
}
