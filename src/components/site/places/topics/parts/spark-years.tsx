import type { Domain } from '@/components/site/places/topics/lib/chart-geometry';

/** A label this close to an end would run into that end's. */
const CLEAR = 0.24;

/** Under a sparkline: its first and last year, and the last measured one where a projection carries on from it. */
export function SparkYears({ domain, measuredTo }: { domain: Domain; measuredTo?: number }) {
  const [from, to] = domain.x;
  const share = measuredTo !== undefined && to > from ? (measuredTo - from) / (to - from) : null;
  const middle = share !== null && share > CLEAR && share < 1 - CLEAR;
  return (
    <span aria-hidden className="relative flex justify-between font-mono text-[10px] leading-none text-ink-3 tabular-nums">
      <span>{from}</span>
      {middle && <span className="absolute -translate-x-1/2" style={{ left: `${share * 100}%` }}>{measuredTo}</span>}
      {to !== from && <span>{to}</span>}
    </span>
  );
}
