'use client';
/**
 * TAKIP TI: the simulation as it happened: newest period first, and within
 * it each world's events, where the question stood after them, and the moves
 * the actors made. Earlier periods fold their moves away.
 */
import { useState } from 'react';
import { ChevronDown, LoaderCircle, Orbit, Users, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { EmptyState } from '@/components/ui/empty-state';
import { Segmented } from '@/components/ui/segmented';
import { castOf, worldName, type RunState } from '@/lib/oi/state';
import { formatAmount, leader } from '@/lib/oi/forecast';
import { priceText } from '@/lib/oi/quant';
import type { Actor, Move, Period, RoundStat, SimEvent } from '@/lib/oi/types';
import { fmtDate, pct, plural } from '@/components/panels/ti-agent/theme';
import { Avatar, Mentions, PointTag, StanceTag, TypeIcon } from '@/components/panels/ti-agent/atoms';
import { PushTag, Quotes } from '@/components/panels/ti-agent/parts/quotes';
import { PriceFan } from './fan';
import { Figures } from '@/components/panels/ti-agent/parts/figures';

/** The latest period the simulation has reached: the highest anyone has moved, decided or stood in. */
export function periodReached(s: RunState): number {
  return Math.max(0, ...s.moves.map(m => m.period), ...s.events.map(e => e.period), ...s.points.map(p => p.period), ...Object.values(s.thinking));
}

/** The pooled figure after a period, as the period's header says it. */
export function pooledLabel(s: RunState, stat: RoundStat): string {
  if (s.frame?.kind === 'number' && stat.value) return `median ${formatAmount(stat.value.median)}`;
  if (s.frame?.kind === 'choice' && stat.shares) return `${s.frame.outcomes[leader(stat.shares)]} ${pct(Math.max(...stat.shares))}`;
  // Every world has settled it: how they settled, not a probability.
  const pts = s.points.filter(p => p.period === stat.round);
  if (s.frame?.kind === 'binary' && pts.length && pts.every(p => p.resolved)) return `${pts.filter(p => p.resolved === 'yes').length} of ${pts.length} worlds yes`;
  return pct(stat.consensus);
}

export function SimFeed({ s, selected, onSelect }: { s: RunState; selected: string | null; onSelect: (k: string | null) => void }) {
  const [world, setWorld] = useState('all');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const cast = castOf(s);
  if (!cast.length) {
    return <EmptyState icon={Users} title={s.status === 'running' ? 'Casting the actors' : 'No simulation in this run'}
      body={s.status === 'running' ? 'The people and institutions who decide this are being cast. The world model draws in on the map.' : undefined} />;
  }
  const reached = periodReached(s);
  if (!reached) return <EmptyState icon={Orbit} title="About to begin" body="The actors are cast. The first period of simulated time starts in a moment." />;
  const worlds = world !== 'all' && s.worlds.includes(world) ? [world] : s.worlds;
  const periods = s.periods.filter(p => p.index <= reached).reverse();
  const toggle = (k: string) => setOpen(o => { const n = new Set(o); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  return (
    <div className="flex flex-col gap-6">
      {s.quant?.fan?.length ? (
        <section>
          <h4 className="mb-2 text-meta font-medium text-ink-3">The price, world by world</h4>
          <PriceFan s={s} />
        </section>
      ) : null}
      {s.worlds.length > 1 && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-meta font-medium text-ink-3">{plural(periods.length, 'period')}, newest first</span>
          <Segmented size="sm" label="Which world" value={worlds.length === 1 ? worlds[0] : 'all'} onChange={setWorld}
            options={[{ value: 'all', label: 'All' }, ...s.worlds.map(w => ({ value: w, label: s.worlds.length > 2 ? w : worldName(w) }))]} />
        </div>
      )}
      {periods.map(p => {
        const stat = s.rounds.find(r => r.round === p.index);
        const injects = s.injects.filter(x => x.round === p.index);
        return (
          <section key={p.index} className="flex flex-col gap-3">
            <header className="flex items-baseline gap-2">
              <h4 className="text-small font-medium text-ink-1">Period <span className="font-mono tabular-nums">{p.index}</span></h4>
              <span className="min-w-0 flex-1 truncate text-meta text-ink-3">{p.label}</span>
              {stat && <span className="shrink-0 text-small text-gold" title="The worlds pooled after this period"><Figures text={pooledLabel(s, stat)} /></span>}
            </header>
            {injects.map((inj, i) => (
              <p key={i} className="flex items-start gap-2 rounded-card bg-surface-2 px-3 py-2 text-small text-ink-1">
                <Zap aria-hidden className="mt-px size-3.5 shrink-0 text-ink-3" strokeWidth={1.75} />
                <span><span className="text-ink-3">Added to every world · </span>{inj.text}</span>
              </p>
            ))}
            {worlds.map(w => {
              const k = `${w}:${p.index}`;
              // The newest period, or a single world, shows its moves; older periods across every world fold them away.
              const fixed = p.index === reached || worlds.length === 1;
              return <WorldPeriod key={w} s={s} world={w} period={p} cast={cast} showMoves={fixed || open.has(k)} onToggle={fixed ? undefined : () => toggle(k)} selected={selected} onSelect={onSelect} />;
            })}
          </section>
        );
      })}
    </div>
  );
}

/** One world in one period: what happened, where it left the question, and what each actor did. */
function WorldPeriod({ s, world, period, cast, showMoves, onToggle, selected, onSelect }: {
  s: RunState; world: string; period: Period; cast: Actor[]; showMoves: boolean; onToggle?: () => void; selected: string | null; onSelect: (k: string | null) => void;
}) {
  const point = s.points.find(x => x.world === world && x.period === period.index);
  const resolvedBefore = s.points.find(x => x.world === world && x.period < period.index && x.resolved);
  const events = s.events.filter(e => e.world === world && e.period === period.index && e.kind !== 'injected');
  const moves = cast.map(a => s.moves.find(m => m.world === world && m.period === period.index && m.actor === a.id)).filter((m): m is Move => !!m);
  const deciding = cast.filter(a => s.thinking[`${world}:${a.id}`] === period.index);
  const key = `w:${world}`;
  const pick = (k: string) => onSelect(selected === k ? null : k);

  if (resolvedBefore) {
    return (
      <div className="flex items-center gap-2 text-small text-ink-3">
        <WorldChip world={world} on={selected === key} onClick={() => pick(key)} />
        Settled in period <span className="font-mono tabular-nums">{resolvedBefore.period}</span>: <span className="text-ink-2">{resolvedBefore.resolved}</span>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3 rounded-card border border-line p-3">
      <div className="flex min-w-0 items-center gap-2">
        <WorldChip world={world} on={selected === key} onClick={() => pick(key)} />
        {point ? <span className="ml-auto"><PointTag point={point} frame={s.frame} /></span>
          : deciding.length ? <span className="ml-auto inline-flex items-center gap-1.5 text-meta text-ink-3"><LoaderCircle aria-hidden className="size-3 animate-spin motion-reduce:animate-none" /><span className="font-mono tabular-nums">{deciding.length}</span> deciding</span> : null}
      </div>
      {point?.price && s.quant && <WorldPrice close={point.price.close} high={point.price.high} low={point.price.low} open={s.points.find(x => x.world === world && x.period === period.index - 1)?.price?.close ?? s.quant.price} symbol={s.quant.symbol} currency={s.quant.currency} level={s.frame?.measure?.threshold} />}
      {point?.note && <p className="text-small text-ink-2"><Mentions text={point.note} s={s} onSelect={onSelect} /></p>}
      {events.length > 0 && <div className="flex flex-col">{events.map(e => <EventRow key={e.id} s={s} event={e} on={selected === `e:${e.id}`} onSelect={onSelect} />)}</div>}
      {moves.length > 0 && (showMoves ? (
        <div className="flex flex-col gap-3 border-t border-line pt-3">
          {moves.map(m => <MoveRow key={m.id} s={s} move={m} on={selected === `a:${m.actor}`} onSelect={onSelect} />)}
          {onToggle && <Button variant="ghost" size="sm" className="-ml-2 self-start" onClick={onToggle}>Hide the moves</Button>}
        </div>
      ) : (
        <Button variant="ghost" size="sm" className="-mb-1 -ml-2 self-start" onClick={onToggle}>
          {plural(moves.length, 'move')}<ChevronDown aria-hidden className="-mr-0.5 size-3.5 text-ink-3" strokeWidth={1.75} />
        </Button>
      ))}
      {showMoves && deciding.length > 0 && (
        <p className="inline-flex items-center gap-1.5 text-meta text-ink-3">
          <LoaderCircle aria-hidden className="size-3 animate-spin motion-reduce:animate-none" />Deciding: {deciding.map(a => a.name).join(', ')}
        </p>
      )}
    </div>
  );
}

/** Where a world's price ended a period, how far it moved, its range in the period, and the level the question is about. */
export function WorldPrice({ close, high, low, open, symbol, currency, level }: { close: number; high: number; low: number; open: number; symbol: string; currency: string; level?: number }) {
  const change = open > 0 ? close / open - 1 : 0;
  const reached = level !== undefined && (level >= open ? high >= level : low <= level);
  return (
    <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-meta text-ink-3">
      <span className="text-ink-2">{symbol}</span>
      <span className="font-mono text-small text-ink-1 tabular-nums">{priceText(close, currency)}</span>
      <span className="font-mono tabular-nums">{change >= 0 ? '+' : '−'}{Math.abs(Math.round(change * 1000) / 10)}%</span>
      <span>range <span className="font-mono tabular-nums">{priceText(low, currency)}–{priceText(high, currency)}</span></span>
      {level !== undefined && <span className={reached ? 'text-gold' : undefined}>level <span className="font-mono tabular-nums">{priceText(level, currency)}</span>{reached ? ' reached' : ''}</span>}
    </p>
  );
}

function WorldChip({ world, on, onClick }: { world: string; on: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} title={`Open ${worldName(world)}`} aria-pressed={on}
      className={cx('inline-flex h-6 items-center gap-1.5 rounded-control border px-2 text-small font-medium', on ? 'border-line-strong bg-surface-3 text-ink-1' : 'border-line text-ink-1 hover:bg-surface-2', FOCUS_RING, TRANSITION)}>
      <TypeIcon k={`w:${world}`} className="size-3.5 text-gold" />{worldName(world)}
    </button>
  );
}

/** Something that happened in a world, dated, with which way it pushed the question. */
export function EventRow({ s, event, on, onSelect }: { s: RunState; event: SimEvent; on: boolean; onSelect: (k: string | null) => void }) {
  const key = `e:${event.id}`;
  const surprise = event.kind === 'shock';
  return (
    <button type="button" onClick={() => onSelect(on ? null : key)}
      className={cx('-mx-2 flex items-start gap-2.5 rounded-control px-2 py-1.5 text-left', on ? 'bg-surface-3' : 'hover:bg-surface-2', FOCUS_RING, TRANSITION)}>
      <TypeIcon k={key} subtype={event.kind} className={cx('mt-0.5 size-3.5 shrink-0', surprise ? 'text-gold' : 'text-ink-3')} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-meta text-ink-3">
          <span className="truncate"><span className="font-mono tabular-nums">{fmtDate(event.date)}</span>{event.place && ` · ${event.place}`}</span>
          {surprise && <span className="shrink-0 text-ink-2">· Surprise</span>}
          <span className="ml-auto"><PushTag c={event} frame={s.frame} /></span>
        </span>
        {/* Plain text: the row is itself a button, so the names in it open from the event's own view. */}
        <span className="mt-0.5 block text-body font-medium text-ink-1">{event.title}</span>
        {event.detail && <span className="mt-0.5 block text-small text-ink-2">{event.detail}</span>}
      </span>
    </button>
  );
}

/** What an actor did in a period: the act, what it said, who it was aimed at, and what it quoted. */
export function MoveRow({ s, move, on, onSelect, showWorld = false }: { s: RunState; move: Move; on: boolean; onSelect: (k: string | null) => void; showWorld?: boolean }) {
  const actor = s.actors.find(a => a.id === move.actor);
  const key = `a:${move.actor}`;
  const pick = () => onSelect(on ? null : key);
  const targets = move.targets.map(t => s.actors.find(a => a.id === t)).filter((a): a is Actor => !!a);
  return (
    <article className="flex gap-2.5">
      <button type="button" onClick={pick} aria-label={`Open ${actor?.name ?? move.actor}`} className={cx('self-start rounded-full', FOCUS_RING)}>
        <Avatar name={actor?.name ?? '?'} size={24} ring={on ? 'selected' : undefined} />
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <button type="button" onClick={pick} className={cx('min-w-0 truncate rounded-control text-body font-medium text-ink-1 hover:underline', FOCUS_RING)}>{actor?.name ?? move.actor}</button>
          <StanceTag stance={move.stance} />
          {showWorld && <span className="ml-auto shrink-0 text-meta text-ink-3">{worldName(move.world)} · period <span className="font-mono tabular-nums">{move.period}</span></span>}
        </div>
        {targets.length > 0 && <p className="mt-0.5 truncate text-meta text-ink-3">Toward {targets.map(t => t.name).join(', ')}</p>}
        <p className="mt-1 text-small text-ink-1"><Mentions text={move.action} s={s} onSelect={onSelect} /></p>
        {move.statement && <p className="mt-1 text-small text-ink-2 italic">“{move.statement}”</p>}
        <Quotes s={s} cites={move.cites} onSelect={onSelect} />
      </div>
    </article>
  );
}
