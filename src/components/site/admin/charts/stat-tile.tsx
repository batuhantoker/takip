import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';

/** `what` names the measure when it isn't the tile's value (sign-ups under an accounts total). */
export type Delta = { recent: number; prior: number; upIsGood?: boolean; vs?: string; what?: string };

/** Label, value, an optional change against a named period and a sparkline whose last point is the accent. */
export function StatTile({ label, value, sub, delta, trend }: { label: string; value: ReactNode; sub?: ReactNode; delta?: Delta | null; trend?: number[] }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-card border border-line bg-surface-1 px-4 py-3">
      <div className="text-[11px] font-medium text-ink-3">{label}</div>
      <div className="flex items-end justify-between gap-3">
        <div className="truncate font-mono text-[22px] font-medium leading-7 text-ink-1">{value}</div>
        {trend && trend.length > 1 && <Sparkline values={trend} />}
      </div>
      {(sub || delta) && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-ink-3">
          {delta && <Change {...delta} />}
          {sub && <span className="min-w-0 truncate">{sub}</span>}
        </div>
      )}
    </div>
  );
}

function Change({ recent, prior, upIsGood = true, vs = 'prior 7 d', what }: Delta) {
  const diff = recent - prior;
  const text = prior === 0 ? (recent === 0 ? 'no change' : `+${recent.toLocaleString('en')}`) : `${diff >= 0 ? '+' : '−'}${Math.abs(Math.round((diff / prior) * 100))}%`;
  const Icon = diff > 0 ? ArrowUpRight : diff < 0 ? ArrowDownRight : Minus;
  const tone = diff === 0 ? 'text-ink-3' : (diff > 0) === upIsGood ? 'text-green' : 'text-red';
  return (
    <span className={`inline-flex items-center gap-0.5 ${tone}`}>
      {what && <span className="mr-0.5 text-ink-3">{what}</span>}
      <Icon aria-hidden className="size-3" />
      <span className="font-mono tabular-nums">{text}</span>
      <span className="text-ink-3">vs {vs}</span>
    </span>
  );
}

export function Sparkline({ values, width = 72, height = 24 }: { values: number[]; width?: number; height?: number }) {
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * width, height - 2 - (v / max) * (height - 4)] as const);
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0 overflow-visible" aria-hidden>
      <polyline points={pts.map(p => p.join(',')).join(' ')} fill="none" stroke="var(--ink-4)" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r={2.5} fill="var(--accent)" />
    </svg>
  );
}
