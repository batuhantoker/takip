'use client';
/**
 * TAKIP TI: the prediction so far, with how it got there and where each
 * simulated world stands. Gold marks TI's own figure; the base rate, the
 * crowd and today's value stand beside it in ink and blue.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { cx } from '@/components/ui/class-names';
import { Dot } from '@/components/ui/tag';
import { latestPoints, type RunState } from '@/lib/ai/state';
import { formatAmount, leader, positionIn } from '@/lib/ai/forecast';
import { T, fit, pct, smooth } from '@/components/panels/ti-agent/theme';
import { PointTag } from '@/components/panels/ti-agent/atoms';
import { Figures } from '@/components/panels/ti-agent/parts/figures';

const MOVE = 'transition-[left,width] duration-500 ease-out motion-reduce:transition-none';

/** A number that eases to its new value instead of jumping, so a live change reads as a change. */
function useTween(target: number | null, ms = 600): number | null {
  const [shown, setShown] = useState<number | null>(null);
  const from = useRef<number | null>(null);
  useEffect(() => {
    if (target === null || !Number.isFinite(target)) return;
    const still = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const start = still ? target : from.current ?? 0;
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      const v = start + (target - start) * (1 - Math.pow(1 - k, 3));
      from.current = v;
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return target === null ? null : shown ?? 0;
}

/** A thin scale with marks on it: the track every verdict bar shares. */
function Track({ children }: { children: ReactNode }) {
  return (
    <div className="relative h-4">
      <span className="absolute inset-x-0 top-[7px] h-0.5 rounded-full bg-surface-3" />
      {children}
    </div>
  );
}

export function Verdict({ s }: { s: RunState; large?: boolean }) {
  const frame = s.frame;
  const last = s.rounds[s.rounds.length - 1] ?? null;
  const final = Boolean(s.report);

  let value: number | null = null;
  let format = (v: number) => `${Math.round(v * 100)}`;
  let suffix = '%';
  let caption = 'Chance of yes';
  let sub = '';
  let detail: ReactNode = null;

  if (frame?.kind === 'choice') {
    caption = 'Most likely';
    const shares = s.report?.shares ?? last?.shares ?? null;
    const lead = shares ? leader(shares) : -1;
    if (shares) { value = shares[lead]; sub = frame.outcomes[lead] ?? ''; }
    detail = (
      <div className="flex flex-col gap-2.5">
        {frame.outcomes.map((o, i) => {
          const v = shares?.[i] ?? null;
          const top = i === lead;
          return (
            <div key={o}>
              <div className="mb-1 flex items-baseline gap-2">
                <span className={cx('flex-1 truncate text-small', top ? 'font-medium text-ink-1' : 'text-ink-2')}>{o}</span>
                <span className={cx('font-mono text-small tabular-nums', top ? 'text-ink-1' : 'text-ink-2')}>{pct(v)}</span>
              </div>
              <div className="relative h-1 overflow-hidden rounded-full bg-surface-3">
                <div className={cx('absolute inset-y-0 left-0 rounded-full', top ? 'bg-gold' : 'bg-ink-3', MOVE)} style={{ width: `${(v ?? 0) * 100}%` }} />
                {frame.prior[i] !== undefined && <span className="absolute inset-y-0 w-px bg-ink-1/60" style={{ left: `${frame.prior[i] * 100}%` }} title={`Prior ${pct(frame.prior[i])}`} />}
              </div>
            </div>
          );
        })}
      </div>
    );
  } else if (frame?.kind === 'number') {
    caption = 'Estimate';
    const e = s.report?.estimate ?? (last?.value ? { value: last.value.median, low: last.value.low, high: last.value.high } : null);
    if (e) {
      value = e.value; format = formatAmount; suffix = ''; sub = frame.unit;
      const lo = Math.min(e.low, frame.anchor ?? e.low, last?.value?.min ?? e.low);
      const hi = Math.max(e.high, frame.anchor ?? e.high, last?.value?.max ?? e.high);
      const at = (v: number) => positionIn(v, lo, hi) * 100;
      detail = (
        <div>
          <Track>
            <span className={cx('absolute top-[5px] h-1.5 rounded-sm bg-gold/25', MOVE)} style={{ left: `${at(e.low)}%`, width: `${at(e.high) - at(e.low)}%` }} />
            {frame.anchor !== null && <span className="absolute top-0.5 h-3 w-px bg-ink-2" style={{ left: `${at(frame.anchor)}%` }} title={`Today: ${formatAmount(frame.anchor)}`} />}
            <span className={cx('absolute top-0 -ml-px h-4 w-0.5 rounded-full bg-gold', MOVE)} style={{ left: `${at(e.value)}%` }} />
          </Track>
          <div className="mt-1 flex justify-between text-meta text-ink-3">
            <span className="font-mono tabular-nums">{formatAmount(e.low)}</span>
            <span>80% range{frame.anchor !== null && <> · today <span className="font-mono text-ink-1 tabular-nums">{formatAmount(frame.anchor)}</span></>}</span>
            <span className="font-mono tabular-nums">{formatAmount(e.high)}</span>
          </div>
        </div>
      );
    }
  } else if (frame) {
    const p = s.report?.probability ?? last?.consensus ?? null;
    if (p !== null) value = p;
    // The prediction market on this same question, where there is one: the crowd's money beside the base rate.
    const market = s.context.find(c => c.id === frame.market && c.odds)?.odds;
    detail = (
      <div>
        <Track>
          {last && <span className={cx('absolute top-[5px] h-1.5 rounded-sm bg-gold/20', MOVE)} title="The range across the worlds"
            style={{ left: `${last.min * 100}%`, width: `${Math.max(1, (last.max - last.min) * 100)}%` }} />}
          <span className="absolute top-0.5 h-3 w-px bg-ink-2" style={{ left: `${frame.baseRate * 100}%` }} title={`Base rate ${pct(frame.baseRate)}`} />
          {market && <span className="absolute top-[5px] -ml-[3px] size-1.5 rotate-45 bg-blue" style={{ left: `${market.probability * 100}%` }} title={`${market.platform} ${pct(market.probability)}`} />}
          {p !== null && <span className={cx('absolute top-0 -ml-px h-4 w-0.5 rounded-full bg-gold', MOVE)} style={{ left: `${p * 100}%` }} />}
        </Track>
        <div className="mt-1 flex justify-between gap-2 text-meta text-ink-3">
          <span>No</span>
          <span className="truncate">
            {s.quant ? 'Baseline' : 'Base rate'} <span className="font-mono text-ink-1 tabular-nums">{pct(frame.baseRate)}</span>
            {market && <> · {market.platform} <span className="font-mono text-ink-1 tabular-nums">{pct(market.probability)}</span></>}
          </span>
          <span>Yes</span>
        </div>
      </div>
    );
  }

  const shown = useTween(value);
  const crowd = frame ? s.context.find(c => c.id === frame.market && c.odds)?.odds : undefined;
  const gap = crowd && s.report && frame?.kind === 'binary' ? s.report.probability - crowd.probability : null;
  const standing = latestPoints(s);
  const progress = !final && last ? `So far, after period ${last.round} of ${s.periodsPlanned}` : '';

  return (
    <section className="flex flex-col gap-4" aria-label="Prediction">
      <div className="flex items-end gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-meta font-medium text-ink-3">{caption}</p>
          {shown === null && s.status === 'running' ? (
            <div className="mt-1.5">
              <p className="flex items-center gap-2 text-body font-medium text-ink-1"><Dot tone="gold" pulse />Forming</p>
              <p className="mt-1 text-small text-ink-2">The figure appears after the first period of simulated time, then firms up as the worlds play on.</p>
            </div>
          ) : (
            <p className={cx('mt-1 font-mono text-display font-medium tabular-nums', final ? 'text-gold' : 'text-ink-1')}>
              {shown === null ? <span className="text-ink-3">—</span> : <>{format(shown)}{suffix}</>}
            </p>
          )}
          {sub && <p className="truncate text-small text-ink-2">{sub}</p>}
          {progress && <p className="mt-0.5 truncate text-meta text-ink-3"><Figures text={progress} /></p>}
          {crowd && gap !== null && (
            <p className="mt-0.5 text-meta text-ink-3" title={`${crowd.platform} prices the same question at ${pct(crowd.probability)}`}>
              {crowd.platform} <span className="font-mono text-ink-2 tabular-nums">{pct(crowd.probability)}</span>
              {' · '}{Math.abs(gap) < 0.02 ? 'in line' : <><span className="font-mono tabular-nums">{Math.round(Math.abs(gap) * 100)}</span> pts {gap > 0 ? 'above' : 'below'} the crowd</>}
            </p>
          )}
        </div>
        <Trajectory s={s} />
      </div>
      {detail}
      {standing.size > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5" aria-label="Where each world stands">
          <span className="text-meta font-medium text-ink-3">Worlds</span>
          {s.worlds.map(w => {
            const point = standing.get(w);
            return (
              <span key={w} className="inline-flex items-center gap-1.5">
                <span className="font-mono text-meta text-ink-3">{w}</span>
                {point ? <PointTag point={point} frame={frame} /> : <span className="text-meta text-ink-4">—</span>}
              </span>
            );
          })}
        </div>
      )}
    </section>
  );
}

/** The figure period by period, ending at the report's. */
function Trajectory({ s, width = 120 }: { s: RunState; width?: number }) {
  const W = width, H = 44;
  const frame = s.frame;
  const gid = `ti-tr-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  if (!frame || !s.rounds.length) return null;
  const n = s.rounds.length + (s.report ? 1 : 0);
  const x = (i: number) => (n === 1 ? W / 2 : 4 + (i / (n - 1)) * (W - 8));

  if (frame.kind === 'choice') {
    const series = frame.outcomes.map((_, k) => [...s.rounds.map(r => r.shares?.[k] ?? 0), ...(s.report?.shares ? [s.report.shares[k]] : [])]);
    const top = Math.max(0.1, ...series.flat()) * 1.1;
    const y = (v: number) => H - 4 - (v / top) * (H - 8);
    const lead = leader(series.map(v => v[v.length - 1]));
    return (
      <svg width={W} height={H} className="shrink-0 overflow-visible" aria-hidden>
        {series.map((vals, k) => k === lead ? null : (
          <path key={k} d={smooth(vals.map((v, i) => [x(i), y(v)]))} fill="none" strokeWidth={1} strokeLinecap="round" className="stroke-ink-4" />
        ))}
        {series[lead] && <path d={smooth(series[lead].map((v, i) => [x(i), y(v)]))} fill="none" strokeWidth={1.5} strokeLinecap="round" className="stroke-gold" />}
      </svg>
    );
  }

  let vals: number[];
  let y: (v: number) => number;
  let ref: number | null;
  if (frame.kind === 'number') {
    vals = [...s.rounds.map(r => r.value?.median ?? NaN), ...(s.report?.estimate ? [s.report.estimate.value] : [])].filter(Number.isFinite);
    const all = [...vals, ...s.rounds.flatMap(r => (r.value ? [r.value.p25, r.value.p75] : [])), ...(frame.anchor !== null ? [frame.anchor] : [])];
    const lo = Math.min(...all), hi = Math.max(...all);
    y = v => (hi > lo ? H - 4 - ((v - lo) / (hi - lo)) * (H - 8) : H / 2);
    ref = frame.anchor;
  } else {
    vals = [...s.rounds.map(r => r.consensus), ...(s.report ? [s.report.probability] : [])];
    const [lo, hi] = fit([...vals, ...s.rounds.flatMap(r => [r.p25, r.p75]), frame.baseRate], 0.2);
    y = v => H - 4 - ((v - lo) / (hi - lo)) * (H - 8);
    ref = frame.baseRate;
  }
  const pts = vals.map((v, i) => [x(i), y(v)] as [number, number]);
  const line = smooth(pts);
  const area = pts.length > 1 ? `${line} L${pts[pts.length - 1][0]},${H} L${pts[0][0]},${H} Z` : '';
  const end = pts[pts.length - 1];
  return (
    <svg width={W} height={H} className="shrink-0 overflow-visible" aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" style={{ stopColor: T.gold, stopOpacity: 0.18 }} />
          <stop offset="100%" style={{ stopColor: T.gold, stopOpacity: 0 }} />
        </linearGradient>
      </defs>
      {ref !== null && <line x1={0} x2={W} y1={y(ref)} y2={y(ref)} strokeDasharray="2 4" className="stroke-ink-4" />}
      {area && <path d={area} fill={`url(#${gid})`} />}
      <path d={line} fill="none" strokeWidth={1.5} strokeLinecap="round" className="stroke-gold" />
      {end && <circle cx={end[0]} cy={end[1]} r={2.75} strokeWidth={1.5} className="fill-gold stroke-surface-1" />}
    </svg>
  );
}

