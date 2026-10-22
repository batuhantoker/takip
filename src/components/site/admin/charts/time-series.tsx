'use client';

import { useState, type KeyboardEvent, type PointerEvent } from 'react';
import { compact, firstWithData, longDay, niceMax, shortDay } from '@/components/site/admin/analytics/lib/format';
import { Legend, PlotFrame, Tip, XLabels } from './chart-card';

export type Series = { key: string; label: string; color: string; values: number[] };

const W = 1000;
const H = 100;

/**
 * Lines over days on one axis; a single series also gets a 10% wash. Crosshair readout on hover and arrow keys.
 * `days` can be any points in time when `tick` and `title` name them (hours); `trim` drops the empty stretch before the data.
 */
export function TimeSeries({ days: allDays, series: allSeries, format = compact, axis = format, height = 160, label, tick = shortDay, title = longDay, trim = true }: {
  days: string[]; series: Series[]; format?: (n: number) => string; axis?: (n: number) => string; height?: number; label: string;
  tick?: (point: string) => string; title?: (point: string) => string; trim?: boolean;
}) {
  const start = trim ? firstWithData(allSeries.map(s => s.values)) : 0;
  const days = allDays.slice(start);
  const series = start ? allSeries.map(s => ({ ...s, values: s.values.slice(start) })) : allSeries;
  const [at, setAt] = useState<number | null>(null);
  const n = days.length;
  const max = niceMax(Math.max(0, ...series.flatMap(s => s.values)));
  const x = (i: number) => (n <= 1 ? 50 : (i / (n - 1)) * 100);
  const y = (v: number) => 100 - (v / max) * 100;
  const path = (values: number[]) => values.map((v, i) => `${i ? 'L' : 'M'}${(x(i) / 100) * W},${(y(v) / 100) * H}`).join('');

  const pick = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setAt(Math.max(0, Math.min(n - 1, Math.round(((e.clientX - rect.left) / rect.width) * (n - 1)))));
  };
  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    setAt(i => Math.max(0, Math.min(n - 1, (i ?? n - 1) + (e.key === 'ArrowLeft' ? -1 : 1))));
  };
  const last = n - 1;

  if (!n) return null;
  return (
    <div className="flex flex-col gap-2">
      {series.length > 1 && <Legend items={series} shape="line" />}
      <PlotFrame max={max} format={axis} height={height}>
        <div
          role="img"
          tabIndex={0}
          aria-label={`${label}. Use the arrow keys to read each point.`}
          className="absolute inset-0 outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-[2px] touch-none"
          onPointerMove={pick}
          onPointerDown={pick}
          onPointerLeave={() => setAt(null)}
          onFocus={() => setAt(last)}
          onBlur={() => setAt(null)}
          onKeyDown={key}
        >
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
            {series.length === 1 && (
              <path d={`${path(series[0].values)}L${(x(last) / 100) * W},${H}L${(x(0) / 100) * W},${H}Z`} fill={series[0].color} fillOpacity={0.1} />
            )}
            {series.map(s => (
              <path key={s.key} d={path(s.values)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            ))}
          </svg>
          {at !== null && <div aria-hidden className="absolute inset-y-0 w-px bg-ink-4" style={{ left: `${x(at)}%` }} />}
          {series.map(s => {
            const i = at ?? last;
            return (
              <span
                key={s.key}
                aria-hidden
                className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{ left: `${x(i)}%`, top: `${y(s.values[i] ?? 0)}%`, background: s.color, boxShadow: '0 0 0 2px var(--surface-1)' }}
              />
            );
          })}
          {at !== null && (
            <Tip
              title={title(days[at])}
              left={x(at)}
              flip={x(at) > 60}
              rows={series.map(s => ({ label: s.label, value: format(s.values[at] ?? 0), color: series.length > 1 ? s.color : undefined }))}
            />
          )}
        </div>
      </PlotFrame>
      <XLabels labels={days.map(tick)} />
    </div>
  );
}
