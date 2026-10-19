'use client';
/** TAKIP TI: what the simulation's own objects show: a link, an actor, an event, a world. */
import type { ReactNode } from 'react';
import { MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { RichTranslate } from '@/components/ui/use-t';
import { LINK_LABEL, TYPE_LABEL } from '@/lib/ai/workspace/objects';
import { moveFor, nodeName } from '@/lib/ai/workspace/selection';
import { evidenceLedger } from '@/lib/ai/engine/sources';
import type { Link, Move } from '@/lib/ai/types';
import { TONE_WORD, ago, fmtDate } from '../theme';
import { Mentions, PointTag, STANCE, TypeIcon } from '../atoms';
import { PushTag, SourceLink, Verbatim, sourceLabel } from '@/components/panels/ti-agent/parts/quotes';
import { EventRow, MoveRow, periodReached } from '@/components/panels/ti-agent/run/sim-feed';
import { Group, LeanBar, LinkRows, ObjectChip, OwnMove, Standing, StrengthBar, ToneDot, exactOf, whereOf } from './parts';
import { placeOf, type Describer } from './describe';

const QUOTE = 'border-l-2 border-line-strong pl-3 text-small text-ink-1';

/** "China presses Japan", the names in full ink and the verb quiet. */
function linkTitle(t: RichTranslate, l: Link, mv: Move | undefined, from: ReactNode, to: ReactNode): ReactNode {
  const v = { from, to };
  if (l.kind === 'cite') return l.from === 'r:report' ? t.rich('{from} rests on {to}', v) : t.rich('{from} quotes {to}', v);
  if (l.kind === 'relation') return t.rich('{from} and {to}', v);
  if (l.kind === 'evidence') return t.rich('{from} bears on {to}', v);
  switch (mv?.stance) {
    case 'cooperate': return t.rich('{from} cooperates with {to}', v);
    case 'pressure': return t.rich('{from} presses {to}', v);
    case 'oppose': return t.rich('{from} opposes {to}', v);
    case 'hold': return t.rich('{from} holds toward {to}', v);
    default: return t.rich('{from} moves on {to}', v);
  }
}

export const describeLink: Describer<'link'> = (sel, { s, t, onSelect }) => {
  const l = sel.link;
  const a = placeOf(s, l.from), b = placeOf(s, l.to);
  const fromReport = l.from === 'r:report';
  const mv = moveFor(s, l);
  const quotedSource = l.kind === 'cite' ? s.context.find(c => `c:${c.id}` === l.to) : undefined;
  const evidenceEffect = s.frame?.kind === 'number' ? (l.tone === 'support' ? t('Points higher') : l.tone === 'oppose' ? t('Points lower') : t('Bears on it'))
    : l.tone === 'support' ? t('Points toward yes') : l.tone === 'oppose' ? t('Points toward no') : t('Bears on it');
  const period = l.round ? s.periods.find(p => p.index === l.round) : undefined;
  const item = l.kind === 'evidence' ? s.context.find(c => `c:${c.id}` === l.from) : undefined;
  const name = (v: string) => <span className="font-semibold text-ink-1">{v}</span>;
  return {
    type: t('Link'),
    subtype: t(LINK_LABEL[l.kind]),
    iconLink: l.kind,
    inGraph: true,
    locate: a && b ? { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2, zoom: 2.2 } : null,
    title: (
      <span className="font-normal text-ink-3">
        {linkTitle(t, l, mv, name(nodeName(s, l.from, t)), name(l.kind === 'cite' ? sourceLabel(quotedSource, l.to.slice(2), t) : nodeName(s, l.to, t)))}
      </span>
    ),
    props: [
      [t('Tone'), l.kind === 'cite' ? null : <span key="t" className="inline-flex items-center gap-1.5"><ToneDot tone={l.tone} />{l.kind === 'evidence' ? evidenceEffect : l.kind === 'move' && mv ? t(STANCE[mv.stance]) : t(TONE_WORD[l.tone])}</span>],
      [t('Strength'), l.kind === 'cite' ? null : <StrengthBar key="s" value={l.strength} />],
      [t('When'), l.kind === 'cite' && fromReport ? t('The report') : l.round ? <span key="w">{whereOf(l, t)}{period && <span className="text-ink-3"> · {period.label}</span>}</span> : t('World model')],
      [t('From'), <ObjectChip key="f" s={s} k={l.from} onSelect={onSelect} />],
      [t('To'), <ObjectChip key="o" s={s} k={l.to} onSelect={onSelect} />],
    ],
    body: (
      <>
        {l.kind === 'cite' && !fromReport && (
          <div className="flex flex-col gap-1.5">
            <blockquote className={QUOTE}>“{l.label}”</blockquote>
            <span className="pl-3.5"><Verbatim exact={exactOf(s, l)} /></span>
          </div>
        )}
        {l.kind === 'cite' && quotedSource && (
          <Group label={fromReport ? t('The source') : t('Where it comes from')}>
            <div className="rounded-card border border-line px-3 py-2">
              <p className="text-small text-ink-1">{quotedSource.kind === 'data' && quotedSource.id !== 'data' ? `“${quotedSource.title}”` : quotedSource.title}</p>
              <p className="mt-1 text-meta text-ink-3"><span className="font-mono">[{quotedSource.id}]</span> {[sourceLabel(quotedSource, quotedSource.id, t), quotedSource.place, ago(quotedSource.published, t)].filter(Boolean).join(' · ')}</p>
            </div>
          </Group>
        )}
        {l.label && !(l.kind === 'cite' && !fromReport) && !(l.kind === 'move' && mv) && <blockquote className={QUOTE}>{l.label}</blockquote>}
        {item && <p className="text-meta text-ink-3">{[item.source, item.place, ago(item.published, t)].filter(Boolean).join(' · ')}</p>}
        {mv && (
          <Group label={l.kind === 'cite' ? t('The move it shaped') : t('The move it was drawn from')}>
            <div className="rounded-card border border-line p-3"><MoveRow s={s} move={mv} on={false} onSelect={onSelect} showWorld /></div>
          </Group>
        )}
      </>
    ),
  };
};

export const describeActor: Describer<'actor'> = (sel, { s, t, onSelect, onAsk }) => {
  const a = sel.actor;
  const touching = s.links.filter(l => l.from === sel.key || l.to === sel.key);
  const rel = touching.filter(l => l.kind === 'relation');
  const ev = touching.filter(l => l.kind === 'evidence');
  const moves = s.moves.filter(m => m.actor === a.id);
  const aimedBy = [...new Set(s.moves.filter(m => m.actor !== a.id && m.targets.includes(a.id)).map(m => `a:${m.actor}`))];
  // What moved it: every source it quoted, and which way.
  const moved = evidenceLedger(moves);
  const deciding = s.worlds.filter(w => `${w}:${a.id}` in s.thinking);
  const predicted = s.report?.actorMoves.find(m => m.actor === a.id)?.prediction;
  const leanWords = s.frame?.kind === 'number'
    ? (a.lean > 0.15 ? t('pushes higher') : a.lean < -0.15 ? t('pushes lower') : t('balanced'))
    : a.lean > 0.15 ? t('toward yes') : a.lean < -0.15 ? t('toward no') : t('balanced');
  return {
    type: t(TYPE_LABEL.actor),
    subtype: a.persona ? t('{kind} · plays in the simulation', { kind: a.kind }) : a.kind,
    iconSub: a.kind,
    title: a.name,
    inGraph: true,
    locate: a.lat !== null && a.lng !== null ? { lat: a.lat, lng: a.lng, zoom: 3.5 } : null,
    props: [
      [t('Role'), a.role],
      [t('Wants'), a.persona?.goal],
      [t('Can'), a.persona?.levers.length ? a.persona.levers.join(' · ') : null],
      [t('Will not'), a.persona?.redLines],
      [t('Decides'), a.persona?.style],
      [t('Location'), a.place],
      [t('Lean'), s.frame?.kind === 'choice' ? null : <LeanBar key="l" lean={a.lean} words={leanWords} />],
      [t('Now'), deciding.length ? <span key="d" className="text-ink-2">{t('Deciding in {worlds}…', { worlds: deciding.map(w => t('World {w}', { w })).join(', ') })}</span> : null],
    ],
    body: (
      <>
        {predicted && <Group label={t('Predicted to')}><blockquote className={QUOTE}><Mentions text={predicted} s={s} onSelect={onSelect} /></blockquote></Group>}
        {s.worlds.map(w => {
          const own = moves.filter(m => m.world === w);
          if (!own.length) return null;
          return (
            <Group key={w} label={t('Its moves in World {w}', { w })} count={own.length}>
              <div className="flex flex-col gap-3">{own.map(m => <OwnMove key={m.id} s={s} move={m} onSelect={onSelect} />)}</div>
            </Group>
          );
        })}
        {moved.length > 0 && (
          <Group label={t('What moved it')} count={moved.length}>
            <div className="flex flex-col">
              {moved.map(r => {
                const c = s.context.find(x => x.id === r.source);
                const last = moves.flatMap(m => m.cites ?? []).filter(x => x.source === r.source).at(-1);
                return (
                  <div key={r.source} className="-mx-2 flex items-center gap-2 rounded-control px-2 py-1.5 hover:bg-surface-2">
                    <button type="button" onClick={() => onSelect(`c:${r.source}`)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                      <TypeIcon k={`c:${r.source}`} subtype={c?.kind} className="size-3.5 shrink-0 text-ink-3" />
                      <span className="truncate text-small text-ink-1">{c?.title ?? r.source}</span>
                    </button>
                    {last && <PushTag c={last} frame={s.frame} />}
                    <span className="font-mono text-meta text-ink-3 tabular-nums">{r.quoted}×</span>
                    <SourceLink url={c?.url} />
                  </div>
                );
              })}
            </div>
          </Group>
        )}
        {aimedBy.length > 0 && (
          <Group label={t('Moved with it or against it')} count={aimedBy.length}>
            <div className="flex flex-wrap gap-1.5">{aimedBy.map(k => <ObjectChip key={k} s={s} k={k} onSelect={onSelect} />)}</div>
          </Group>
        )}
        {rel.length > 0 && <Group label={t('Relations')} count={rel.length}><LinkRows s={s} links={rel} from={sel.key} onSelect={onSelect} /></Group>}
        {ev.length > 0 && <Group label={t('Evidence')} count={ev.length}><LinkRows s={s} links={ev} from={sel.key} onSelect={onSelect} /></Group>}
        {a.persona && (
          <Button size="sm" icon={MessageSquare} className="self-start" onClick={() => onAsk(a.id)}>
            {t('Ask {name}', { name: a.name.split(' ').slice(0, 2).join(' ') })}
          </Button>
        )}
      </>
    ),
  };
};

export const describeEvent: Describer<'event'> = (sel, { s, t, onSelect }) => {
  const e = sel.event;
  const period = s.periods.find(p => p.index === e.period);
  const point = s.points.find(p => p.world === e.world && p.period === e.period);
  // The moves behind it: what the actors it involves did in that world and period.
  const behind = s.moves.filter(m => m.world === e.world && m.period === e.period && (e.actors.length === 0 || e.actors.includes(m.actor)));
  return {
    type: t(TYPE_LABEL.event),
    subtype: e.kind === 'shock' ? t('surprise') : e.kind === 'injected' ? t('added by you') : '',
    iconSub: e.kind,
    title: e.title,
    inGraph: false,
    locate: e.lat !== null && e.lng !== null ? { lat: e.lat, lng: e.lng, zoom: 4 } : null,
    props: [
      [t('World'), <ObjectChip key="w" s={s} k={`w:${e.world}`} onSelect={onSelect} />],
      [t('Date'), <span key="d"><span className="font-mono tabular-nums">{fmtDate(e.date, t)}</span>{period && <span className="text-ink-3"> · {t('period {n}, {label}', { n: period.index, label: period.label })}</span>}</span>],
      [t('Pushes'), <PushTag key="p" c={e} frame={s.frame} />],
      [t('Where'), e.place],
      [t('Involves'), e.actors.length ? <div key="a" className="flex flex-wrap gap-1.5">{e.actors.map(id => <ObjectChip key={id} s={s} k={`a:${id}`} onSelect={onSelect} />)}</div> : null],
    ],
    body: (
      <>
        {e.detail && <p className="text-small text-ink-2"><Mentions text={e.detail} s={s} onSelect={onSelect} /></p>}
        {point && <Group label={t('Where it left the question')}><Standing s={s} point={point} onSelect={onSelect} /></Group>}
        {e.kind !== 'injected' && behind.length > 0 && (
          <Group label={t('The moves behind it')} count={behind.length}>
            <div className="flex flex-col gap-3">{behind.map(m => <MoveRow key={m.id} s={s} move={m} on={false} onSelect={onSelect} />)}</div>
          </Group>
        )}
      </>
    ),
  };
};

export const describeWorld: Describer<'world'> = (sel, { s, t, onSelect }) => {
  const w = sel.world;
  const points = s.points.filter(p => p.world === w);
  const last = points.at(-1);
  const ended = s.report?.worlds.find(x => x.world === w);
  const reached = periodReached(s);
  return {
    type: t(TYPE_LABEL.world),
    subtype: t('simulated'),
    title: t('World {w}', { w }),
    inGraph: false,
    locate: null,
    props: [
      [t('Stands'), last ? <PointTag key="p" point={last} frame={s.frame} /> : <span key="p" className="text-ink-3">{t('Not started')}</span>],
      [t('Outcome'), ended?.outcome],
      [t('Events'), <span key="e" className="font-mono tabular-nums">{s.events.filter(e => e.world === w).length}</span>],
      [t('Moves'), <span key="m" className="font-mono tabular-nums">{s.moves.filter(m => m.world === w).length}</span>],
    ],
    body: (
      <>
        {ended?.summary && <p className="text-small text-ink-2"><Mentions text={ended.summary} s={s} onSelect={onSelect} /></p>}
        {s.periods.filter(p => p.index <= reached).map(p => {
          const point = points.find(x => x.period === p.index);
          const events = s.events.filter(e => e.world === w && e.period === p.index);
          if (!point && !events.length) return null;
          return (
            <Group key={p.index} label={t('Period {n} · {label}', { n: p.index, label: p.label })}>
              {events.length > 0 && <div className="flex flex-col">{events.map(e => <EventRow key={e.id} s={s} event={e} on={false} onSelect={onSelect} />)}</div>}
              {point && <Standing s={s} point={point} onSelect={onSelect} />}
            </Group>
          );
        })}
      </>
    ),
  };
};
