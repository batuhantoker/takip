'use client';
/**
 * TAKIP TI: what a prediction rests on, side by side.
 *
 * The prediction is not one model's opinion: it is weighed against what can
 * be checked. Here they stand on one scale, each a click away from its
 * source: the price's own history (the statistical baseline), the crowd's
 * money (the prediction market on the same question), the simulation priced
 * across the market's own paths, how the worlds ended, and the prediction
 * itself. A yes/no question reads in percent; a quantity in its own units,
 * each as a range.
 */
import { formatAmount } from '@/lib/oi/forecast';
import { priceText } from '@/lib/oi/quant';
import type { RunState } from '@/lib/oi/state';
import type { ContextItem } from '@/lib/oi/types';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { PanelSection } from '@/components/ui/panel';
import { ANCHOR, fmtDate, pct } from '@/components/panels/ti-agent/theme';
import { TypeIcon } from '@/components/panels/ti-agent/atoms';
import { PriceFan } from './fan';
import { LadderChart } from './ladder';
import { TrackRecord } from './record';

interface Row {
  key: string;
  label: string;
  /** What it is, in a line. */
  detail: string;
  color: string;
  /** Opens its source. */
  select?: string;
  /** A probability (0..1), or a range on the quantity's scale. */
  value?: number;
  range?: [number, number, number];
  strong?: boolean;
  muted?: boolean;
}

/**
 * Each anchor's mark, the shape it has on the prediction's own bar: a tick for
 * the baseline, a diamond for a market, a dot for the simulation, a bar for
 * the prediction.
 */
function Mark({ row }: { row: Row }) {
  const kind = row.key === 'base' ? 'tick' : row.key === 'sim' ? 'dot' : row.key.startsWith('pred') ? 'bar' : 'diamond';
  return (
    <span className="flex size-2.5 shrink-0 items-center justify-center self-center" aria-hidden>
      {kind === 'tick' && <span className="h-2.5 w-px" style={{ background: row.color }} />}
      {kind === 'dot' && <span className="size-[7px] rounded-full" style={{ background: row.color }} />}
      {kind === 'bar' && <span className="h-2.5 w-0.5 rounded-full" style={{ background: row.color }} />}
      {kind === 'diamond' && <span className="size-1.5 rotate-45" style={{ background: row.color }} />}
    </span>
  );
}

const traded = (v: number, platform: string) => (platform === 'Polymarket' ? `$${formatAmount(v)} traded` : `${formatAmount(v)} mana traded`);

/** The markets found: the one on this same question first, the related after. */
function marketsOf(s: RunState): { same: ContextItem | null; related: ContextItem[] } {
  const odds = s.context.filter(c => c.kind === 'odds' && c.odds);
  const same = odds.find(c => c.id === s.frame?.market) ?? null;
  return { same, related: odds.filter(c => c !== same) };
}

/** Whether a run has anything to weigh its prediction against. */
export function hasAnchors(s: RunState): boolean {
  return Boolean(s.quant || s.context.some(c => c.kind === 'odds'));
}

function ChartBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <h4 className="mb-2 text-meta font-medium text-ink-3">{title}</h4>
      {children}
    </div>
  );
}

export function Anchors({ s, selected, onSelect }: { s: RunState; selected: string | null; onSelect: (k: string | null) => void }) {
  const f = s.frame;
  const q = s.quant;
  if (!f || !hasAnchors(s)) return null;
  const { same, related } = marketsOf(s);
  const series = q ? s.context.find(c => c.kind === 'series' && c.symbol === q.symbol) : undefined;
  const r = s.report;
  const last = s.rounds[s.rounds.length - 1];
  const rows: Row[] = [];

  if (f.kind === 'number') {
    if (q) rows.push({ key: 'base', label: 'Statistical baseline', detail: `${q.symbol}'s own daily moves, resampled to ${q.days} days ahead`, color: ANCHOR.baseline, range: [q.p10, q.p50, q.p90], select: series && `c:${series.id}` });
    if (q?.simulated) rows.push({ key: 'sim', label: 'The simulation, priced', detail: 'Each world’s events, across the market’s own paths', color: ANCHOR.simulation, range: [q.simulated.p10, q.simulated.p50, q.simulated.p90] });
    if (r?.estimate) rows.push({ key: 'pred', label: 'Prediction', detail: `${r.confidence} confidence`, color: ANCHOR.prediction, range: [r.estimate.low, r.estimate.value, r.estimate.high], strong: true, select: 'r:report' });
  } else {
    if (q?.probability !== undefined) rows.push({ key: 'base', label: 'Statistical baseline', detail: `${q.symbol}'s own daily moves, resampled to the horizon`, color: ANCHOR.baseline, value: q.probability, select: series && `c:${series.id}` });
    if (same?.odds) rows.push({ key: 'mkt', label: `${same.odds.platform} traders`, detail: `“${same.title}” · ${traded(same.odds.volume, same.odds.platform)}`, color: ANCHOR.market, value: same.odds.probability, select: `c:${same.id}` });
    if (q?.simulated?.probability !== undefined) rows.push({ key: 'sim', label: 'The simulation, priced', detail: `${s.worlds.length} worlds’ events, across the market’s own paths`, color: ANCHOR.simulation, value: q.simulated.probability });
    else if (last && f.kind === 'binary') rows.push({ key: 'sim', label: 'The worlds pooled', detail: `${s.worlds.length} simulated worlds`, color: ANCHOR.simulation, value: last.consensus });
    if (r && f.kind === 'binary') rows.push({ key: 'pred', label: 'Prediction', detail: `${r.confidence} confidence`, color: ANCHOR.prediction, value: r.probability, strong: true, select: 'r:report' });
    if (r?.shares && f.kind === 'choice') {
      f.outcomes.forEach((o, i) => {
        if (i < 4) rows.push({ key: `pred:${i}`, label: `Prediction · ${o}`, detail: i === 0 ? `${r.confidence} confidence` : '', color: ANCHOR.prediction, value: r.shares![i] ?? 0, strong: i === 0, select: 'r:report' });
      });
    }
    // A "which" question is priced one outcome at a time: each market stands beside the prediction, not behind it.
    // Rungs of the same ladder are on the ladder chart; the rows keep the markets it does not show.
    const onLadder = (m: ContextItem) => Boolean(same?.odds?.ladder && m.url === same.url);
    for (const m of related.filter(m => !onLadder(m)).slice(0, f.kind === 'choice' ? 4 : 3)) {
      if (m.odds) rows.push({ key: m.id, label: f.kind === 'choice' ? `${m.odds.platform} traders` : 'Related market', detail: `“${m.title}”`, color: ANCHOR.market, value: m.odds.probability, select: `c:${m.id}`, muted: f.kind !== 'choice' });
    }
  }
  if (!rows.length) return null;

  // A quantity's scale: every range on it, and today's price.
  const lo = Math.min(...rows.flatMap(x => x.range ?? []), q?.price ?? Infinity);
  const hi = Math.max(...rows.flatMap(x => x.range ?? []), q?.price ?? -Infinity);
  const at = (v: number) => (hi > lo ? ((v - lo) / (hi - lo)) * 100 : 50);
  const say = (v: number) => (q ? priceText(v, q.currency) : formatAmount(v));

  return (
    <PanelSection title="What it rests on">
      {q && (
        <button type="button" onClick={() => series && onSelect(selected === `c:${series.id}` ? null : `c:${series.id}`)} disabled={!series}
          className={cx('mb-3 flex w-full items-baseline gap-2 rounded-card border border-line px-2.5 py-1.5 text-left enabled:hover:bg-surface-2', FOCUS_RING, TRANSITION)}>
          <TypeIcon k="c:q" subtype="series" className="size-3.5 shrink-0 self-center text-ink-3" />
          <span className="text-small font-medium whitespace-nowrap text-ink-1">{q.symbol}</span>
          <span className="font-mono text-small whitespace-nowrap text-ink-1 tabular-nums">{priceText(q.price, q.currency)}</span>
          <span className="truncate text-meta text-ink-3">
            on {fmtDate(q.asOf)} · swings <span className="font-mono tabular-nums">{Math.round(q.vol * 100)}%</span> a year
            {f.measure?.threshold !== undefined && <> · level <span className="font-mono tabular-nums">{priceText(f.measure.threshold, q.currency)}</span> ({f.measure.threshold >= q.price ? '+' : '−'}{Math.round(Math.abs(f.measure.threshold / q.price - 1) * 100)}%)</>}
          </span>
        </button>
      )}
      <div className="flex flex-col gap-1">
        {rows.map(row => {
          const on = row.select && selected === row.select;
          return (
            <button key={row.key} type="button" onClick={() => row.select && onSelect(on ? null : row.select)} disabled={!row.select}
              className={cx('-mx-2 rounded-control px-2 py-1.5 text-left', row.select ? 'hover:bg-surface-2' : 'cursor-default', on && 'bg-surface-3', row.muted && 'opacity-75', FOCUS_RING, TRANSITION)}>
              <span className="flex items-baseline gap-2">
                <Mark row={row} />
                <span className={cx('whitespace-nowrap text-small', row.strong ? 'font-medium text-ink-1' : 'text-ink-1')}>{row.label}</span>
                <span className="min-w-0 flex-1 truncate text-meta text-ink-3">{row.detail}</span>
                <span className={cx('font-mono whitespace-nowrap tabular-nums', row.strong ? 'text-body font-medium text-gold' : 'text-small text-ink-1')}>
                  {row.value !== undefined ? pct(row.value) : row.range ? say(row.range[1]) : ''}
                </span>
              </span>
              <span className="relative mt-1.5 block h-1 overflow-hidden rounded-full bg-surface-3">
                {row.value !== undefined && (
                  <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.max(1, row.value * 100)}%`, background: row.color, opacity: row.strong ? 1 : 0.7 }} />
                )}
                {row.range && (
                  <>
                    <span className="absolute inset-y-0 rounded-full" style={{ left: `${at(row.range[0])}%`, width: `${Math.max(1, at(row.range[2]) - at(row.range[0]))}%`, background: row.color, opacity: row.strong ? 0.55 : 0.35 }} />
                    <span className="absolute inset-y-0 -ml-px w-0.5" style={{ left: `${at(row.range[1])}%`, background: row.color }} />
                  </>
                )}
                {row.range && q && <span className="absolute inset-y-0 w-px bg-ink-1/70" style={{ left: `${at(q.price)}%` }} title={`Today ${say(q.price)}`} />}
              </span>
              {row.range && (
                <span className="mt-0.5 flex justify-between font-mono text-meta text-ink-3 tabular-nums">
                  <span>{say(row.range[0])}</span><span>{say(row.range[2])}</span>
                </span>
              )}
            </button>
          );
        })}
      </div>
      {/* The figures above, then what they come from: the price world by world, the whole ladder, the baseline's record. */}
      {q?.fan?.length ? <ChartBlock title="The price, world by world"><PriceFan s={s} /></ChartBlock> : null}
      {q?.curve?.length && s.context.some(c => c.odds?.ladder) ? <ChartBlock title="Every level, the model and the crowd"><LadderChart s={s} /></ChartBlock> : null}
      {q?.backtest ? <ChartBlock title={`Is the baseline any good? Its record on ${q.symbol}'s past`}><TrackRecord s={s} /></ChartBlock> : null}
    </PanelSection>
  );
}
