'use client';
/** TAKIP TI: the pieces an object's view is made of. */
import type { ReactNode } from 'react';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { useT } from '@/components/ui/use-t';
import type { Translate } from '@/lib/core/i18n/translator';
import { moveFor, nodeName } from '@/lib/ai/workspace/selection';
import type { RunState } from '@/lib/ai/state';
import type { Link, Move } from '@/lib/ai/types';
import { TONE_WORD, toneColor } from '../theme';
import { Avatar, Mentions, PointTag, StanceTag, TypeIcon, accentFor } from '../atoms';
import { Quotes, Verbatim } from '@/components/panels/ti-agent/parts/quotes';
import { LineGlyph } from '@/components/panels/ti-agent/run/research-list';

export type Pick = (k: string | null) => void;

/** A link to another object: its icon and its name. */
export function ObjectChip({ s, k, onSelect }: { s: RunState; k: string; onSelect: Pick }) {
  const t = useT();
  const name = nodeName(s, k, t);
  const source = k.startsWith('c:') ? s.context.find(c => `c:${c.id}` === k) : undefined;
  const subtype = k.startsWith('a:') ? s.actors.find(a => `a:${a.id}` === k)?.kind : k.startsWith('e:') ? s.events.find(e => `e:${e.id}` === k)?.kind : source?.kind ?? '';
  return (
    <button type="button" onClick={() => onSelect(k)} title={name}
      className={cx('inline-flex h-6 max-w-full items-center gap-1.5 rounded-[4px] border border-line px-1.5 text-small text-ink-1 hover:bg-surface-2', FOCUS_RING, TRANSITION)}>
      <TypeIcon k={k} subtype={subtype} className={cx('size-3 shrink-0', accentFor(k))} />
      <span className="truncate">{name}</span>
      {source && <span className="shrink-0 font-mono text-meta text-ink-3">[{source.id}]</span>}
    </button>
  );
}

/** Whether the words a quote link carries were found in its source. */
export const exactOf = (s: RunState, l: Link) => moveFor(s, l)?.cites?.find(c => `c:${c.source}` === l.to)?.exact ?? false;

/** "World A · period 2": where in the simulation a move or a quote link was drawn. */
export const whereOf = (l: Link, t: Translate) => t('World {w} · period {n}', { w: l.id.split(':')[1] ?? '', n: l.round });

const ROW = cx('-mx-2 rounded-control px-2 py-1.5 text-left hover:bg-surface-2', FOCUS_RING, TRANSITION);

/** Who quoted a source, and in which words: each row opens the quote. */
export function QuoteRows({ s, links, onSelect }: { s: RunState; links: Link[]; onSelect: Pick }) {
  const t = useT();
  return (
    <div className="flex flex-col">
      {links.map(l => (
        <button key={l.id} type="button" onClick={() => onSelect(`link:${l.id}`)} className={ROW}>
          <span className="flex items-center gap-2">
            <Avatar name={nodeName(s, l.from, t)} size={18} />
            <span className="truncate text-small font-medium text-ink-1">{nodeName(s, l.from, t)}</span>
            <span className="text-meta whitespace-nowrap text-ink-3">{whereOf(l, t)}</span>
            <span className="ml-auto"><Verbatim exact={exactOf(s, l)} /></span>
          </span>
          <span className="mt-1 block pl-[26px] text-small text-ink-2">“{l.label}”</span>
        </button>
      ))}
    </div>
  );
}

/** Facts about the object, label beside value. */
export function Props({ rows }: { rows: [string, ReactNode][] }) {
  const shown = rows.filter(([, v]) => v !== null && v !== undefined && v !== '');
  if (!shown.length) return null;
  return (
    <dl className="grid grid-cols-[88px_1fr] items-baseline gap-x-3 gap-y-2">
      {shown.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-small text-ink-3">{k}</dt>
          <dd className="m-0 min-w-0 text-small break-words text-ink-1">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Group({ label, count, children }: { label: string; count?: number; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h5 className="text-meta font-medium text-ink-3">{label}{count !== undefined && <span className="font-normal"> · {count}</span>}</h5>
      {children}
    </section>
  );
}

/** A lean from −1 (no, lower) to +1 (yes, higher), on a centred track. */
export function LeanBar({ lean, words }: { lean: number; words: string }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="relative h-0.5 w-24 rounded-full bg-surface-3">
        <span className="absolute inset-y-0 left-1/2 w-px bg-ink-4" />
        <span className="absolute -top-[5px] -ml-px h-3 w-0.5 rounded-full bg-gold" style={{ left: `${(0.5 + lean / 2) * 100}%` }} />
      </span>
      <span className="text-small text-ink-2">{words}</span>
    </span>
  );
}

export function StrengthBar({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-0.5 w-20 overflow-hidden rounded-full bg-surface-3"><span className="block h-full rounded-full bg-ink-2" style={{ width: `${value * 100}%` }} /></span>
      <span className="font-mono text-small text-ink-2 tabular-nums">{Math.round(value * 100)}</span>
    </span>
  );
}

/** One of an actor's own moves, without its name: the period, the act, what it said, why, and what it quoted. */
export function OwnMove({ s, move, onSelect }: { s: RunState; move: Move; onSelect: Pick }) {
  const t = useT();
  const targets = move.targets.map(id => s.actors.find(a => a.id === id)?.name).filter(Boolean);
  const period = s.periods.find(p => p.index === move.period);
  return (
    <div className="flex gap-2.5">
      <span className="mt-0.5 w-6 shrink-0 font-mono text-meta text-ink-3 tabular-nums" title={period?.label}>P{move.period}</span>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <StanceTag stance={move.stance} />
          {targets.length > 0 && <span className="truncate text-meta text-ink-3">{t('Toward {actors}', { actors: targets.join(', ') })}</span>}
        </div>
        <p className="mt-1 text-small text-ink-1"><Mentions text={move.action} s={s} onSelect={onSelect} /></p>
        {move.statement && <p className="mt-1 text-small text-ink-2 italic">“{move.statement}”</p>}
        {move.why && <p className="mt-1 text-small text-ink-3">{t('Why: {reason}', { reason: move.why })}</p>}
        <Quotes s={s} cites={move.cites} onSelect={onSelect} />
      </div>
    </div>
  );
}

/** Links from one object, each with its line, the object at the other end, and what the link says. */
export function LinkRows({ s, links, from, onSelect }: { s: RunState; links: Link[]; from: string; onSelect: Pick }) {
  const t = useT();
  return (
    <div className="flex flex-col">
      {links.map(l => {
        const other = l.from === from ? l.to : l.from;
        return (
          <button key={l.id} type="button" onClick={() => onSelect(`link:${l.id}`)} className={cx(ROW, 'flex items-center gap-2.5')}>
            <LineGlyph link={l} />
            <span className="min-w-0 flex-1 truncate text-small text-ink-1">
              {nodeName(s, other, t)}{l.label && <span className="text-ink-3"> · {l.label}</span>}
            </span>
            <span className="shrink-0 text-meta text-ink-3">{t(TONE_WORD[l.tone])}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Where a world stood after a period, with the line that says why. */
export function Standing({ s, point, onSelect }: { s: RunState; point: RunState['points'][number]; onSelect: Pick }) {
  return (
    <div className="flex items-start gap-2.5">
      <PointTag point={point} frame={s.frame} />
      <span className="text-small text-ink-2"><Mentions text={point.note} s={s} onSelect={onSelect} /></span>
    </div>
  );
}

/** The arc colour a link is drawn in, as a dot beside its tone. */
export const ToneDot = ({ tone }: { tone: Link['tone'] }) => <span className="size-2 shrink-0 rounded-full" style={{ background: toneColor(tone) }} />;
