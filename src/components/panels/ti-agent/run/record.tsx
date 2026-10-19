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
import type { Backtest } from '@/lib/ai/quant/backtest';
import type { RunState } from '@/lib/ai/state';
import { ANCHOR } from '@/components/panels/ti-agent/theme';
import { useT } from '@/components/ui/use-t';
import type { Translate } from '@/lib/core/i18n/translator';

const pctOf = (p: number) => `${p < 0.1 ? Math.round(p * 1000) / 10 : Math.round(p * 100)}%`;

/** The record in words, as the lib's recordSentence says it for the report agent, in the reader's language. */
function recordWords(t: Translate, b: Backtest, symbol: string, p?: number): string {
  const band = p === undefined ? undefined : b.bins.find(x => p >= x.lo && p <= x.hi);
  const three = (n: number) => n.toLocaleString(t.intl, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  return [
    t('Tested on {n} past forecasts of {symbol} (made on {starts, plural, one {# day} other {# days}}, {years}, each from the year of prices before it, {days, plural, one {# day} other {# days}} ahead): what it said was {gap} points from what happened, on average.', {
      n: b.n, symbol, starts: b.starts, years: `${b.from.slice(0, 4)}–${b.to.slice(0, 4)}`, days: b.days, gap: Math.round(b.gap * 1000) / 10,
    }),
    band ? t('When it said {range}, as it does now, it happened {share} of the time ({n, plural, one {# forecast} other {# forecasts}}).', {
      range: `${Math.round(band.lo * 100)}–${Math.round(band.hi * 100)}%`, share: pctOf(band.happened), n: band.n,
    }) : '',
    t('Brier {score}, against {reference} for hindsight (how often each move really happened over the whole period, which no one knew in advance).', { score: three(b.brier), reference: three(b.reference) }),
  ].filter(Boolean).join(' ');
}

export function TrackRecord({ s, size = 132 }: { s: RunState; size?: number }) {
  const t = useT();
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
      <svg width={W} height={H} className="shrink-0 overflow-visible" role="img" aria-label={t("Calibration of the baseline on {symbol}'s past: what it said against how often it happened", { symbol: q.symbol })}>
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
            <title>{t('Said {said} → happened {happened} ({n, plural, one {# forecast} other {# forecasts}})', { said: `${Math.round(p.said * 1000) / 10}%`, happened: `${Math.round(p.happened * 1000) / 10}%`, n: p.n })}</title>
          </circle>
        ))}
        <text x={x(0.02)} y={y(0.92)} className="fill-ink-3" style={{ fontSize: 11 }}>{t('happened')}</text>
        <text x={x(1)} y={y(0.06)} textAnchor="end" className="fill-ink-3" style={{ fontSize: 11 }}>{t('said')}</text>
      </svg>
      <div className="min-w-0">
        <p className="text-meta text-ink-3">{t.rich('Calibration gap {gap} pts', { gap: <span className="font-mono text-small text-ink-1 tabular-nums">{(Math.round(b.gap * 1000) / 10).toLocaleString(t.intl)}</span> })}</p>
        <p className="mt-1 text-small text-ink-2">{recordWords(t, b, q.symbol, q.probability)}</p>
      </div>
    </div>
  );
}
