'use client';

import { useState } from 'react';
import { minutes as fmtMinutes } from '@/components/site/admin/analytics/lib/format';

const DAYS = [1, 2, 3, 4, 5, 6, 0];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// One hue, dark to bright on the dark surface: the accent mixed into surface-1 in five steps.
const STEPS = [20, 36, 52, 70, 90];
export const heatStep = (share: number) => `color-mix(in srgb, var(--accent) ${STEPS[Math.min(STEPS.length - 1, Math.floor(share * STEPS.length))]}%, var(--surface-1))`;

const hourLabel = (h: number) => `${String(h).padStart(2, '0')}:00`;

/** Weekday × UTC hour, Monday first. The readout line above names the cell under the pointer. */
export function Heatmap({ cells, format = fmtMinutes }: { cells: { dow: number; hour: number; minutes: number }[]; format?: (n: number) => string }) {
  const [hover, setHover] = useState<{ dow: number; hour: number } | null>(null);
  const grid = new Map(cells.map(c => [`${c.dow}:${c.hour}`, c.minutes]));
  const max = Math.max(0, ...cells.map(c => c.minutes));
  const busiest = cells.reduce<(typeof cells)[number] | null>((best, c) => (!best || c.minutes > best.minutes ? c : best), null);
  const focus = hover ?? busiest;
  const value = focus ? grid.get(`${focus.dow}:${focus.hour}`) ?? 0 : 0;

  return (
    <div className="flex flex-col gap-2">
      <p className="h-4 text-[12px] text-ink-2" aria-live="polite">
        {focus && (
          <>
            <span className="text-ink-3">{hover ? '' : 'Busiest: '}{DAY_NAMES[focus.dow]} {hourLabel(focus.hour)}–{hourLabel((focus.hour + 1) % 24)} UTC · </span>
            <span className="font-mono tabular-nums text-ink-1">{format(value)}</span>
          </>
        )}
      </p>
      <div
        role="img"
        aria-label={busiest ? `Map minutes by weekday and hour; busiest ${DAY_NAMES[busiest.dow]} ${hourLabel(busiest.hour)} UTC.` : 'Map minutes by weekday and hour.'}
        className="overflow-x-auto"
        onPointerLeave={() => setHover(null)}
      >
        <div className="grid min-w-[520px] grid-cols-[2.25rem_repeat(24,minmax(0,1fr))] gap-[2px]">
          <span />
          {Array.from({ length: 24 }, (_, h) => (
            <span key={h} className="text-[11px] text-ink-3 font-mono tabular-nums" aria-hidden>{h % 6 === 0 ? String(h).padStart(2, '0') : ''}</span>
          ))}
          {DAYS.map(dow => (
            <div key={dow} className="contents">
              <span className="pr-1 text-[11px] leading-4 text-ink-3" aria-hidden>{DAY_NAMES[dow]}</span>
              {Array.from({ length: 24 }, (_, hour) => {
                const v = grid.get(`${dow}:${hour}`) ?? 0;
                const on = hover?.dow === dow && hover.hour === hour;
                return (
                  <span
                    key={hour}
                    onPointerEnter={() => setHover({ dow, hour })}
                    className={`h-4 rounded-[3px] ${on ? 'outline outline-1 outline-ink-1' : ''}`}
                    style={{ background: v > 0 && max > 0 ? heatStep(v / max) : 'var(--surface-2)' }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-1.5 self-end text-[11px] text-ink-3" aria-hidden>
        Less
        <span className="size-2.5 rounded-[2px] bg-surface-2" />
        {STEPS.map((_, i) => <span key={i} className="size-2.5 rounded-[2px]" style={{ background: heatStep(i / STEPS.length) }} />)}
        More
      </div>
    </div>
  );
}
