'use client';
/**
 * TAKIP TI: every level, the model against the crowd.
 *
 * A prediction market prices a price question rung by rung (will it reach
 * $160, $180, $200, will it dip to $80, $60…); the model gives the same thing
 * as a curve, the chance of trading at every level by the date. Here they are
 * on one chart: the statistical baseline's curve, the simulation's curve once
 * it has run, and the crowd's rungs as dots, with today's price and the level
 * the question is about. Where a dot sits above the curve, the crowd sees
 * more chance of getting there than the market's own history does.
 */
import { useEffect, useRef, useState } from 'react';
import { ladderGaps, readLadder, type LadderReading } from '@/lib/ai/quant/ladder';
import { priceText } from '@/lib/ai/quant/series';
import type { RunState } from '@/lib/ai/state';
import { ANCHOR } from '@/components/panels/ti-agent/theme';
import { useT } from '@/components/ui/use-t';
import type { Translate } from '@/lib/core/i18n/translator';

/** Probabilities on a square-root scale: a 2% rung and a 5% one stay apart, and 100% still fits. */
const TICKS = [0.01, 0.05, 0.2, 0.5, 1];

const pc = (p: number) => `${p < 0.1 ? Math.round(p * 1000) / 10 : Math.round(p * 100)}%`;

/** The reading in a sentence, as the lib's ladderSentence says it for the report agent, in the reader's language. */
function ladderWords(t: Translate, r: LadderReading, say: (n: number) => string, crowd: string): string {
  if (!r.rungs) return '';
  const pts = (x: number) => t('{value} pts', { value: `${x >= 0 ? '+' : '−'}${Math.abs(Math.round(x * 1000) / 10).toLocaleString(t.intl)}` });
  const upside = (x: number) => (Math.abs(x) < 0.01 ? t('level with {crowd} on the upside', { crowd })
    : x > 0 ? t('above {crowd} ({pts} on average) on the upside', { crowd, pts: pts(x) }) : t('below {crowd} ({pts} on average) on the upside', { crowd, pts: pts(x) }));
  const downside = (x: number) => (Math.abs(x) < 0.01 ? t('level with {crowd} on the downside', { crowd })
    : x > 0 ? t('above {crowd} ({pts} on average) on the downside', { crowd, pts: pts(x) }) : t('below {crowd} ({pts} on average) on the downside', { crowd, pts: pts(x) }));
  const sides = [r.upside === undefined ? '' : upside(r.upside), r.downside === undefined ? '' : downside(r.downside)].filter(Boolean);
  const parts = sides.length === 2 ? t('{first} and {second}', { first: sides[0], second: sides[1] }) : sides[0] ?? '';
  const w = r.widest;
  if (!w) return t("Across {n, plural, one {# rung} other {# rungs}} of {crowd}'s ladder, the model is {parts}.", { n: r.rungs, crowd, parts });
  const where = w.direction === 'below' ? t('a dip to {price}', { price: say(w.level) }) : say(w.level);
  return t("Across {n, plural, one {# rung} other {# rungs}} of {crowd}'s ladder, the model is {parts}; they differ most at {where}: model {model}, {crowd} {market}.",
    { n: r.rungs, crowd, parts, where, model: pc(w.model), market: pc(w.crowd) });
}

export function LadderChart({ s, height = 172 }: { s: RunState; height?: number }) {
  const t = useT();
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const q = s.quant;
  const market = (s.context.find(c => c.id === s.frame?.market && c.odds?.ladder) ?? s.context.find(c => c.odds?.ladder))?.odds;
  if (!q?.curve?.length || !market?.ladder?.length) return null;
  const gaps = ladderGaps(q.curve, market.ladder, q.price);
  if (gaps.length < 3) return null;
  const level = s.frame?.measure?.threshold;
  const marks = [...gaps.map(g => g.level), q.price, ...(level !== undefined ? [level] : [])];
  const lo = Math.min(...marks) * 0.85, hi = Math.max(...marks) * 1.15;
  const L = 34, R = 10, Tp = 8, B = 22;
  const x = (v: number) => L + (Math.log(v / lo) / Math.log(hi / lo)) * Math.max(1, w - L - R);
  const y = (p: number) => Tp + (1 - Math.sqrt(Math.max(0, Math.min(1, p)))) * (height - Tp - B);
  const inside = (c: { level: number }) => c.level >= lo && c.level <= hi;
  const path = (curve: { level: number; probability: number }[]) => curve.filter(inside).map((c, i) => `${i ? 'L' : 'M'}${x(c.level).toFixed(1)},${y(c.probability).toFixed(1)}`).join(' ');
  const money = (v: number) => priceText(v, q.currency);
  const sim = q.simulated?.curve;
  /** A rung's level as it is asked: "$90", "$150K", not "$90.00". */
  const tick = (v: number) => (v >= 1000 || v < 10 ? money(v) : `${q.currency === 'USD' ? '$' : ''}${Math.round(v)}`);
  const reading = readLadder(gaps);
  const sentence = ladderWords(t, reading, tick, market.platform);
  // The rungs' own levels as ticks, as many as fit without touching.
  const xTicks: number[] = [];
  for (const g of gaps) if (!xTicks.length || x(g.level) - x(xTicks[xTicks.length - 1]) >= 46) xTicks.push(g.level);

  return (
    <div>
      <div ref={box} className="relative w-full" style={{ height }}>
        {w > 0 && (
          <svg width={w} height={height} className="absolute inset-0 overflow-visible" role="img" aria-label={t("The chance of {symbol} trading at each level by the horizon: the model's curve and {platform}'s ladder", { symbol: q.symbol, platform: market.platform })}>
            {TICKS.map(p => (
              <g key={p}>
                <line x1={L} x2={w - R} y1={y(p)} y2={y(p)} className="stroke-line-strong" strokeDasharray={p === 1 ? undefined : '2 4'} />
                <text x={L - 4} y={y(p) + 3} textAnchor="end" className="fill-ink-3 font-mono" style={{ fontSize: 11 }}>{Math.round(p * 100)}%</text>
              </g>
            ))}
            <line x1={x(q.price)} x2={x(q.price)} y1={Tp} y2={height - B} strokeWidth={1} className="stroke-ink-1/50" />
            {level !== undefined && <line x1={x(level)} x2={x(level)} y1={Tp} y2={height - B} strokeDasharray="4 3" strokeWidth={1.2} className="stroke-gold" />}
            <path d={path(q.curve)} fill="none" strokeWidth={1.6} style={{ stroke: ANCHOR.baseline }} />
            {sim && <path d={path(sim)} fill="none" strokeWidth={1.6} strokeDasharray="5 3" style={{ stroke: ANCHOR.simulation }} />}
            {gaps.map(g => (
              <g key={`${g.direction}${g.level}`}>
                <line x1={x(g.level)} x2={x(g.level)} y1={y(g.crowd)} y2={y(g.model)} strokeWidth={1} style={{ stroke: ANCHOR.market, opacity: 0.45 }} />
                <circle cx={x(g.level)} cy={y(g.crowd)} r={3.2} className="stroke-surface-1" style={{ fill: ANCHOR.market, strokeWidth: 1 }}>
                  <title>{(g.direction === 'below' ? t('Dip to {price}: {platform} {crowd}, model {model}', {
                    price: money(g.level), platform: market.platform, crowd: `${Math.round(g.crowd * 1000) / 10}%`, model: `${Math.round(g.model * 1000) / 10}%`,
                  }) : t('Reach {price}: {platform} {crowd}, model {model}', {
                    price: money(g.level), platform: market.platform, crowd: `${Math.round(g.crowd * 1000) / 10}%`, model: `${Math.round(g.model * 1000) / 10}%`,
                  }))}</title>
                </circle>
              </g>
            ))}
            {xTicks.map(v => <text key={v} x={x(v)} y={height - 8} textAnchor="middle" className="fill-ink-3 font-mono" style={{ fontSize: 11 }}>{tick(v)}</text>)}
            <text x={x(q.price) + 3} y={Tp + 8} className="fill-ink-2" style={{ fontSize: 11 }}>{t('today')}</text>
          </svg>
        )}
      </div>
      <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-meta text-ink-3">
        <span><span className="mr-1 inline-block h-0.5 w-2.5 align-middle" style={{ background: ANCHOR.baseline }} />{t('Statistical baseline')}</span>
        {sim && <span><span className="mr-1 inline-block h-0.5 w-2.5 align-middle" style={{ background: ANCHOR.simulation }} />{t('The simulation, priced')}</span>}
        <span><span className="mr-1 inline-block size-1.5 rounded-full align-middle" style={{ background: ANCHOR.market }} />{t("{platform}'s ladder", { platform: market.platform })}</span>
      </p>
      {sentence && <p className="mt-1.5 text-small text-ink-2">{sentence}</p>}
    </div>
  );
}
