/**
 * Everything on the globe that can be clicked (an arc, an actor, a source, an
 * event of a simulated world, a scenario, a signpost) resolved back into the
 * piece of the research it stands for. The globe's tooltips and the panel's
 * inspector both read through here, so a click always shows exactly what was
 * drawn.
 *
 * Keys: "link:<link id>" for an arc; "a:<actor>", "c:<source>", "e:<event>"
 * for nodes; "w:<world>" for a simulated world; "s:<index>" and "p:<index>" for the report's scenarios and
 * signposts; "r:report" for the report itself, where every thread ends.
 */
import type { RunState } from '../state';
import type { Actor, ContextItem, Link, Move, Report, Scenario, Signpost, SimEvent } from '../types';
import { DEFAULT_LOCALE } from '@/lib/core/i18n/locales';
import { createTranslator, msg, type Vars } from '@/lib/core/i18n/translator';

/** Any translator: the component's, or the page's for code outside React (the globe's tooltips). */
type Translate = (source: string, vars?: Vars) => string;

const english: Translate = createTranslator(DEFAULT_LOCALE, {});

export type Selection =
  | { type: 'link'; key: string; link: Link }
  | { type: 'actor'; key: string; actor: Actor }
  | { type: 'event'; key: string; event: SimEvent }
  | { type: 'world'; key: string; world: string }
  | { type: 'context'; key: string; item: ContextItem }
  | { type: 'scenario'; key: string; scenario: Scenario; index: number }
  | { type: 'signpost'; key: string; signpost: Signpost; index: number }
  | { type: 'report'; key: string; report: Report };

export function resolve(s: RunState, key: string | null): Selection | null {
  if (!key) return null;
  if (key.startsWith('link:')) {
    const link = s.links.find(l => l.id === key.slice(5));
    return link ? { type: 'link', key, link } : null;
  }
  const [prefix, ...rest] = key.split(':');
  const id = rest.join(':');
  if (prefix === 'a') { const actor = s.actors.find(a => a.id === id); return actor ? { type: 'actor', key, actor } : null; }
  if (prefix === 'e') { const event = s.events.find(e => e.id === id); return event ? { type: 'event', key, event } : null; }
  if (prefix === 'w') return s.worlds.includes(id) ? { type: 'world', key, world: id } : null;
  if (prefix === 'c') { const item = s.context.find(c => c.id === id); return item ? { type: 'context', key, item } : null; }
  if (prefix === 's' && s.report) { const i = Number(id); const scenario = s.report.scenarios[i]; return scenario ? { type: 'scenario', key, scenario, index: i } : null; }
  if (prefix === 'p' && s.report) { const i = Number(id); const signpost = s.report.signposts[i]; return signpost ? { type: 'signpost', key, signpost, index: i } : null; }
  if (prefix === 'r' && s.report) return { type: 'report', key, report: s.report };
  return null;
}

/** The arcs that belong to a selection: the arc itself, or every arc touching a selected node. */
export function relatedLinks(s: RunState, key: string | null): Set<string> {
  const out = new Set<string>();
  if (!key) return out;
  if (key.startsWith('link:')) { out.add(key.slice(5)); return out; }
  for (const l of s.links) if (l.from === key || l.to === key) out.add(l.id);
  return out;
}

/** A node's name, from its key, in `t`'s language where it is not the run's own data. */
export function nodeName(s: RunState, nodeKey: string, t: Translate = english): string {
  const [prefix, ...rest] = nodeKey.split(':');
  const id = rest.join(':');
  if (prefix === 'a') return s.actors.find(a => a.id === id)?.name ?? id;
  if (prefix === 'e') return s.events.find(e => e.id === id)?.title ?? id;
  if (prefix === 'w') return t('World {w}', { w: id });
  if (prefix === 'c') return s.context.find(c => c.id === id)?.title ?? id;
  if (prefix === 'r') return t('The report');
  return id;
}

/**
 * The move a link was drawn from: a move arc, or an actor's quote, belongs to
 * that actor's move in that world and period (the world is in the link's id).
 */
export function moveFor(s: RunState, link: Link): Move | undefined {
  if ((link.kind !== 'move' && link.kind !== 'cite') || !link.from.startsWith('a:')) return undefined;
  const actor = link.from.slice(2);
  const world = link.id.split(':')[1];
  return s.moves.find(m => m.actor === actor && m.world === world && m.period === link.round);
}

const RELATION_WORD = { support: msg('aligned'), oppose: msg('opposed'), neutral: msg('linked') } as const;

const clip = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t);

/** What an evidence link does to the question, and to whom: "points toward NO: China". */
function effectLine(s: RunState, tone: Link['tone'], target: string, t: Translate): string {
  if (tone === 'neutral') return t('bears on: {target}', { target });
  if (s.frame?.kind === 'number') return tone === 'support' ? t('points higher: {target}', { target }) : t('points lower: {target}', { target });
  return tone === 'support' ? t('points toward YES: {target}', { target }) : t('points toward NO: {target}', { target });
}

/** "United States presses China": a move arc, as its stance reads. */
function stanceLine(tone: Link['tone'], from: string, to: string, t: Translate): string {
  if (tone === 'support') return t('{from} works with {to}', { from, to });
  if (tone === 'oppose') return t('{from} presses {to}', { from, to });
  return t('{from} holds toward {to}', { from, to });
}

/** Two short lines for a tooltip, in `t`'s language (English when none is given). */
export function brief(s: RunState, key: string, t: Translate = english): { title: string; detail: string } | null {
  const sel = resolve(s, key);
  if (!sel) return null;
  switch (sel.type) {
    case 'link': {
      const l = sel.link;
      const from = nodeName(s, l.from, t);
      const to = nodeName(s, l.to, t);
      if (l.kind === 'relation') return { title: `${from} ⇄ ${to}`, detail: `${t(RELATION_WORD[l.tone])} · ${clip(l.label, 90)}` };
      if (l.kind === 'evidence') return { title: clip(from, 80), detail: effectLine(s, l.tone, to, t) };
      const world = l.id.split(':')[1];
      if (l.kind === 'cite') {
        return l.from === 'r:report'
          ? { title: t('The report rests on {source}', { source: clip(to, 60) }), detail: clip(l.label, 100) }
          : { title: t('{actor} quotes {source}', { actor: from, source: clip(to, 60) }), detail: t('World {w}, period {n} · “{quote}”', { w: world, n: l.round, quote: clip(l.label, 90) }) };
      }
      return { title: stanceLine(l.tone, from, to, t), detail: t('World {w}, period {n} · {label}', { w: world, n: l.round, label: clip(l.label, 90) }) };
    }
    case 'actor': return { title: sel.actor.name, detail: clip(sel.actor.persona ? t('Plays to: {goal}', { goal: sel.actor.persona.goal }) : sel.actor.role, 90) };
    case 'world': {
      const last = [...s.points].reverse().find(p => p.world === sel.world);
      return { title: t('World {w}', { w: sel.world }), detail: last ? (last.resolved ? t('Resolved {answer}', { answer: last.resolved }) : clip(last.note, 90)) : t('Not started') };
    }
    case 'event': {
      const e = sel.event;
      const kind = e.kind === 'shock' ? t('surprise') : e.kind === 'injected' ? t('injected') : '';
      return { title: clip(e.title, 90), detail: [t('World {w}', { w: e.world }), e.date, kind].filter(Boolean).join(' · ') };
    }
    case 'context': return { title: clip(sel.item.title, 90), detail: [sel.item.source, sel.item.place].filter(Boolean).join(' · ') };
    case 'scenario': return { title: t('Scenario: {name}', { name: sel.scenario.name }), detail: `${Math.round(sel.scenario.probability * 100)}% · ${clip(sel.scenario.description, 70)}` };
    case 'signpost': return { title: t('Signpost'), detail: clip(sel.signpost.text, 90) };
    case 'report': return { title: t('The report'), detail: `${sel.report.answer} · ${clip(sel.report.headline, 80)}` };
  }
}
