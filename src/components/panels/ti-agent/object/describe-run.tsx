'use client';
/** TAKIP TI: what the simulation's own objects show: a link, an actor, an event, a world. */
import { MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LINK_LABEL, TYPE_LABEL } from '@/lib/oi/objects';
import { moveFor, nodeName } from '@/lib/oi/research';
import { evidenceLedger } from '@/lib/oi/sources';
import { worldName } from '@/lib/oi/state';
import type { Move } from '@/lib/oi/types';
import { TONE_WORD, ago, fmtDate } from '../theme';
import { Mentions, PointTag, STANCE, TypeIcon } from '../atoms';
import { PushTag, SourceLink, Verbatim, sourceLabel } from '@/components/panels/ti-agent/parts/quotes';
import { EventRow, MoveRow, periodReached } from '@/components/panels/ti-agent/run/sim-feed';
import { Group, LeanBar, LinkRows, ObjectChip, OwnMove, Standing, StrengthBar, ToneDot, exactOf, whereOf } from './parts';
import { placeOf, type Describer } from './describe';

const STANCE_VERB: Record<Move['stance'], string> = { cooperate: 'cooperates with', pressure: 'presses', oppose: 'opposes', hold: 'holds toward' };
const QUOTE = 'border-l-2 border-line-strong pl-3 text-small text-ink-1';

export const describeLink: Describer<'link'> = (sel, { s, onSelect }) => {
  const l = sel.link;
  const a = placeOf(s, l.from), b = placeOf(s, l.to);
  const fromReport = l.from === 'r:report';
  const mv = moveFor(s, l);
  const verb = l.kind === 'cite' ? (fromReport ? 'rests on' : 'quotes')
    : l.kind === 'relation' ? 'and' : l.kind === 'evidence' ? 'bears on' : mv ? STANCE_VERB[mv.stance] : 'moves on';
  const quotedSource = l.kind === 'cite' ? s.context.find(c => `c:${c.id}` === l.to) : undefined;
  const evidenceEffect = s.frame?.kind === 'number' ? (l.tone === 'support' ? 'Points higher' : l.tone === 'oppose' ? 'Points lower' : 'Bears on it')
    : l.tone === 'support' ? 'Points toward yes' : l.tone === 'oppose' ? 'Points toward no' : 'Bears on it';
  const period = l.round ? s.periods.find(p => p.index === l.round) : undefined;
  const item = l.kind === 'evidence' ? s.context.find(c => `c:${c.id}` === l.from) : undefined;
  return {
    type: 'Link',
    subtype: LINK_LABEL[l.kind],
    iconLink: l.kind,
    inGraph: true,
    locate: a && b ? { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2, zoom: 2.2 } : null,
    title: <>{nodeName(s, l.from)} <span className="font-normal text-ink-3">{verb}</span> {l.kind === 'cite' ? sourceLabel(quotedSource, l.to.slice(2)) : nodeName(s, l.to)}</>,
    props: [
      ['Tone', l.kind === 'cite' ? null : <span key="t" className="inline-flex items-center gap-1.5"><ToneDot tone={l.tone} />{l.kind === 'evidence' ? evidenceEffect : l.kind === 'move' && mv ? STANCE[mv.stance] : TONE_WORD[l.tone]}</span>],
      ['Strength', l.kind === 'cite' ? null : <StrengthBar key="s" value={l.strength} />],
      ['When', l.kind === 'cite' && fromReport ? 'The report' : l.round ? <span key="w">{whereOf(l)}{period && <span className="text-ink-3"> · {period.label}</span>}</span> : 'World model'],
      ['From', <ObjectChip key="f" s={s} k={l.from} onSelect={onSelect} />],
      ['To', <ObjectChip key="o" s={s} k={l.to} onSelect={onSelect} />],
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
          <Group label={fromReport ? 'The source' : 'Where it comes from'}>
            <div className="rounded-card border border-line px-3 py-2">
              <p className="text-small text-ink-1">{quotedSource.kind === 'data' && quotedSource.id !== 'data' ? `“${quotedSource.title}”` : quotedSource.title}</p>
              <p className="mt-1 text-meta text-ink-3"><span className="font-mono">[{quotedSource.id}]</span> {[sourceLabel(quotedSource, quotedSource.id), quotedSource.place, ago(quotedSource.published)].filter(Boolean).join(' · ')}</p>
            </div>
          </Group>
        )}
        {l.label && !(l.kind === 'cite' && !fromReport) && !(l.kind === 'move' && mv) && <blockquote className={QUOTE}>{l.label}</blockquote>}
        {item && <p className="text-meta text-ink-3">{[item.source, item.place, ago(item.published)].filter(Boolean).join(' · ')}</p>}
        {mv && (
          <Group label={l.kind === 'cite' ? 'The move it shaped' : 'The move it was drawn from'}>
            <div className="rounded-card border border-line p-3"><MoveRow s={s} move={mv} on={false} onSelect={onSelect} showWorld /></div>
          </Group>
        )}
      </>
    ),
  };
};

export const describeActor: Describer<'actor'> = (sel, { s, onSelect, onAsk }) => {
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
  const leanWords = s.frame?.kind === 'number' ? (a.lean > 0.15 ? 'pushes higher' : a.lean < -0.15 ? 'pushes lower' : 'balanced') : a.lean > 0.15 ? 'toward yes' : a.lean < -0.15 ? 'toward no' : 'balanced';
  return {
    type: TYPE_LABEL.actor,
    subtype: a.persona ? `${a.kind} · plays in the simulation` : a.kind,
    iconSub: a.kind,
    title: a.name,
    inGraph: true,
    locate: a.lat !== null && a.lng !== null ? { lat: a.lat, lng: a.lng, zoom: 3.5 } : null,
    props: [
      ['Role', a.role],
      ['Wants', a.persona?.goal],
      ['Can', a.persona?.levers.length ? a.persona.levers.join(' · ') : null],
      ['Will not', a.persona?.redLines],
      ['Decides', a.persona?.style],
      ['Location', a.place],
      ['Lean', s.frame?.kind === 'choice' ? null : <LeanBar key="l" lean={a.lean} words={leanWords} />],
      ['Now', deciding.length ? <span key="d" className="text-ink-2">Deciding in {deciding.map(worldName).join(', ')}…</span> : null],
    ],
    body: (
      <>
        {predicted && <Group label="Predicted to"><blockquote className={QUOTE}><Mentions text={predicted} s={s} onSelect={onSelect} /></blockquote></Group>}
        {s.worlds.map(w => {
          const own = moves.filter(m => m.world === w);
          if (!own.length) return null;
          return (
            <Group key={w} label={`Its moves in ${worldName(w)}`} count={own.length}>
              <div className="flex flex-col gap-3">{own.map(m => <OwnMove key={m.id} s={s} move={m} onSelect={onSelect} />)}</div>
            </Group>
          );
        })}
        {moved.length > 0 && (
          <Group label="What moved it" count={moved.length}>
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
          <Group label="Moved with it or against it" count={aimedBy.length}>
            <div className="flex flex-wrap gap-1.5">{aimedBy.map(k => <ObjectChip key={k} s={s} k={k} onSelect={onSelect} />)}</div>
          </Group>
        )}
        {rel.length > 0 && <Group label="Relations" count={rel.length}><LinkRows s={s} links={rel} from={sel.key} onSelect={onSelect} /></Group>}
        {ev.length > 0 && <Group label="Evidence" count={ev.length}><LinkRows s={s} links={ev} from={sel.key} onSelect={onSelect} /></Group>}
        {a.persona && (
          <Button size="sm" icon={MessageSquare} className="self-start" onClick={() => onAsk(a.id)}>
            Ask {a.name.split(' ').slice(0, 2).join(' ')}
          </Button>
        )}
      </>
    ),
  };
};

export const describeEvent: Describer<'event'> = (sel, { s, onSelect }) => {
  const e = sel.event;
  const period = s.periods.find(p => p.index === e.period);
  const point = s.points.find(p => p.world === e.world && p.period === e.period);
  // The moves behind it: what the actors it involves did in that world and period.
  const behind = s.moves.filter(m => m.world === e.world && m.period === e.period && (e.actors.length === 0 || e.actors.includes(m.actor)));
  return {
    type: TYPE_LABEL.event,
    subtype: e.kind === 'shock' ? 'surprise' : e.kind === 'injected' ? 'added by you' : '',
    iconSub: e.kind,
    title: e.title,
    inGraph: false,
    locate: e.lat !== null && e.lng !== null ? { lat: e.lat, lng: e.lng, zoom: 4 } : null,
    props: [
      ['World', <ObjectChip key="w" s={s} k={`w:${e.world}`} onSelect={onSelect} />],
      ['Date', <span key="d"><span className="font-mono tabular-nums">{fmtDate(e.date)}</span>{period && <span className="text-ink-3"> · period {period.index}, {period.label}</span>}</span>],
      ['Pushes', <PushTag key="p" c={e} frame={s.frame} />],
      ['Where', e.place],
      ['Involves', e.actors.length ? <div key="a" className="flex flex-wrap gap-1.5">{e.actors.map(id => <ObjectChip key={id} s={s} k={`a:${id}`} onSelect={onSelect} />)}</div> : null],
    ],
    body: (
      <>
        {e.detail && <p className="text-small text-ink-2"><Mentions text={e.detail} s={s} onSelect={onSelect} /></p>}
        {point && <Group label="Where it left the question"><Standing s={s} point={point} onSelect={onSelect} /></Group>}
        {e.kind !== 'injected' && behind.length > 0 && (
          <Group label="The moves behind it" count={behind.length}>
            <div className="flex flex-col gap-3">{behind.map(m => <MoveRow key={m.id} s={s} move={m} on={false} onSelect={onSelect} />)}</div>
          </Group>
        )}
      </>
    ),
  };
};

export const describeWorld: Describer<'world'> = (sel, { s, onSelect }) => {
  const w = sel.world;
  const points = s.points.filter(p => p.world === w);
  const last = points.at(-1);
  const ended = s.report?.worlds.find(x => x.world === w);
  const reached = periodReached(s);
  return {
    type: TYPE_LABEL.world,
    subtype: 'simulated',
    title: worldName(w),
    inGraph: false,
    locate: null,
    props: [
      ['Stands', last ? <PointTag key="p" point={last} frame={s.frame} /> : <span key="p" className="text-ink-3">Not started</span>],
      ['Outcome', ended?.outcome],
      ['Events', <span key="e" className="font-mono tabular-nums">{s.events.filter(e => e.world === w).length}</span>],
      ['Moves', <span key="m" className="font-mono tabular-nums">{s.moves.filter(m => m.world === w).length}</span>],
    ],
    body: (
      <>
        {ended?.summary && <p className="text-small text-ink-2"><Mentions text={ended.summary} s={s} onSelect={onSelect} /></p>}
        {s.periods.filter(p => p.index <= reached).map(p => {
          const point = points.find(x => x.period === p.index);
          const events = s.events.filter(e => e.world === w && e.period === p.index);
          if (!point && !events.length) return null;
          return (
            <Group key={p.index} label={`Period ${p.index} · ${p.label}`}>
              {events.length > 0 && <div className="flex flex-col">{events.map(e => <EventRow key={e.id} s={s} event={e} on={false} onSelect={onSelect} />)}</div>}
              {point && <Standing s={s} point={point} onSelect={onSelect} />}
            </Group>
          );
        })}
      </>
    ),
  };
};
