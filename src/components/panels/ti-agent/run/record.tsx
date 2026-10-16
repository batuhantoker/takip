'use client';
/**
 * TAKIP TI: is the baseline any good?
 *
 * The statistical baseline, scored on the instrument's own past: forecasts
 * made on days through the history, each from the year of prices before it,
 * against what then happened. A calibration chart (what it said, across; how
 * often it happened, up; on the diagonal is perfectly calibrated) and the
 * record in words, with the band the baseline's figure for this question
 * falls in picked out.
 */
import { recordSentence } from '@/lib/ai/quant/backtest';
import type { RunState } from '@/lib/ai/state';
import { ANCHOR } from '@/components/panels/ti-agent/theme';

export function TrackRecord({ s, size = 132 }: { s: RunState; size?: number }) {
  const q = s.quant;
  const b = q?.backtest;
  if (!q || !b) return null;
  const P = 22, W = size, H = size;
  const x = (v: number) => P + v * (W - P - 6);
  const y = (v: number) => H - P - v * (H - P - 6);
  const most = Math.max(...b.bins.map(x => x.n));
  const here = q.probability !== undefined ? b.bins.find(x => q.probability! >= x.lo && q.probability! <= x.hi) : undefined;
  return (
    <div className="flex items-start gap-3">
      <svg width={W} height={H} className="shrink-0 overflow-visible" role="img" aria-label={`Calibration of the baseline on ${q.symbol}'s past: what it said against how often it happened`}>
        {[0, 0.5, 1].map(v => (
          <g key={v}>
            <line x1={x(0)} x2={x(1)} y1={y(v)} y2={y(v)} className="stroke-line-strong" strokeDasharray={v === 0 ? undefined : '2 4'} />
            <text x={x(0) - 3} y={y(v) + 3} textAnchor="end" className="fill-ink-3 font-mono" style={{ fontSize: 11 }}>{Math.round(v * 100)}</text>
            <text x={x(v)} y={H - 8} textAnchor="middle" className="fill-ink-3 font-mono" style={{ fontSize: 11 }}>{Math.round(v * 100)}</text>
          </g>
        ))}
        <line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} strokeDasharray="3 3" className="stroke-ink-4" />
        <path d={b.bins.map((p, i) => `${i ? 'L' : 'M'}${x(p.said).toFixed(1)},${y(p.happened).toFixed(1)}`).join(' ')} fill="none" strokeWidth={1.4} style={{ stroke: ANCHOR.baseline }} />
        {b.bins.map(p => (
          <circle key={p.lo} cx={x(p.said)} cy={y(p.happened)} r={2 + 3 * Math.sqrt(p.n / most)}
            className="stroke-surface-1" style={{ fill: p === here ? ANCHOR.prediction : ANCHOR.baseline, strokeWidth: 1 }}>
            <title>{`Said ${Math.round(p.said * 1000) / 10}% → happened ${Math.round(p.happened * 1000) / 10}% (${p.n} forecasts)`}</title>
          </circle>
        ))}
        <text x={x(0.02)} y={y(0.92)} className="fill-ink-3" style={{ fontSize: 11 }}>happened</text>
        <text x={x(1)} y={y(0.06)} textAnchor="end" className="fill-ink-3" style={{ fontSize: 11 }}>said</text>
      </svg>
      <div className="min-w-0">
        <p className="text-meta text-ink-3">Calibration gap <span className="font-mono text-small text-ink-1 tabular-nums">{Math.round(b.gap * 1000) / 10}</span> pts</p>
        <p className="mt-1 text-small text-ink-2">{recordSentence(b, q.symbol, q.probability)}</p>
      </div>
    </div>
  );
}
