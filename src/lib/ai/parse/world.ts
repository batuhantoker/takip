import { amount, normalizeShares, uniform } from '../forecast';
import type { Actor, ActorKind, ContextItem, Frame, Link, Tone } from '../types';
import { num, prob, text, slug, oneOf, list, obj, locate, spreadDuplicates } from './values';

const ACTOR_KINDS: readonly ActorKind[] = ['state', 'leader', 'organisation', 'company', 'market', 'group', 'place'];

const SUPPORT_RELATIONS = new Set(['alliance', 'ally', 'trade', 'supply', 'negotiation', 'cooperation', 'support', 'partnership']);
const OPPOSE_RELATIONS = new Set(['rivalry', 'rival', 'conflict', 'war', 'sanction', 'sanctions', 'hostility', 'competition', 'opposition']);

export function relationTone(kind: string): Tone {
  if (SUPPORT_RELATIONS.has(kind)) return 'support';
  if (OPPOSE_RELATIONS.has(kind)) return 'oppose';
  return 'neutral';
}

export interface WorldModel {
  frame: Frame;
  actors: Actor[];
  links: Link[];
}

/** The question's kind and its outcomes. A choice with fewer than two usable outcomes is asked as yes or no. */
export function parseKind(raw: Record<string, unknown>): Pick<Frame, 'kind' | 'outcomes' | 'unit' | 'prior' | 'anchor'> {
  let kind = oneOf(raw.kind, ['binary', 'choice', 'number'] as const, 'binary');
  const outcomes: string[] = [];
  for (const o of list(raw.outcomes, 6)) {
    const label = text(typeof o === 'object' && o ? (o as Record<string, unknown>).label ?? (o as Record<string, unknown>).name : o, 60);
    if (label && !outcomes.some(x => x.toLowerCase() === label.toLowerCase())) outcomes.push(label);
  }
  if (kind === 'choice' && outcomes.length < 2) kind = 'binary';
  const anchor = kind === 'number' ? amount(raw.anchor) : null;
  return {
    kind,
    outcomes: kind === 'choice' ? outcomes : [],
    unit: kind === 'number' ? text(raw.unit, 40) : '',
    prior: kind === 'choice' ? normalizeShares(raw.prior, outcomes, uniform(outcomes.length)) : [],
    anchor,
  };
}

export function parseWorld(raw: Record<string, unknown>, question: string, context: ContextItem[]): WorldModel {
  const focusRaw = obj(raw.focus);
  const focus = locate(focusRaw);
  const frame: Frame = {
    question,
    ...parseKind(raw),
    proposition: text(raw.proposition, 300, question),
    resolution: text(raw.resolution, 400),
    horizon: /^\d{4}-\d{2}-\d{2}$/.test(String(raw.horizon ?? '')) ? String(raw.horizon) : '',
    baseRate: prob(raw.base_rate ?? raw.baseRate, 0.5),
    baseRateReason: text(raw.base_rate_reason ?? raw.baseRateReason, 400),
    focus: focus.lat === null && !focus.place ? null : focus,
  };
  // The price the question turns on, when the research found it: a ticker the model names without data behind it is dropped.
  const m = obj(raw.measure);
  const symbol = text(m.symbol, 20).toUpperCase();
  const priced = symbol ? context.find(c => c.kind === 'series' && c.symbol?.toUpperCase() === symbol) : undefined;
  if (priced?.symbol) {
    const level = amount(m.threshold ?? m.level);
    frame.measure = {
      symbol: priced.symbol,
      ...(frame.kind === 'binary' && level !== null && level > 0 ? {
        threshold: level,
        direction: oneOf(m.direction, ['above', 'below'] as const, 'above'),
        touch: m.touch !== false && m.touch !== 'false',
      } : {}),
    };
  }
  // The prediction market that asks this same question, when one does.
  const market = text(raw.market, 8).toLowerCase();
  if (market && context.some(c => c.kind === 'odds' && c.id === market)) frame.market = market;

  const actors: Actor[] = [];
  const ids = new Set<string>();
  for (const [i, a] of list(raw.actors, 16).entries()) {
    const o = obj(a);
    const name = text(o.name, 80);
    if (!name) continue;
    let id = slug(o.id ?? name, `actor_${i + 1}`);
    while (ids.has(id)) id = `${id}_${i}`;
    ids.add(id);
    actors.push({
      id,
      name,
      kind: oneOf(o.kind, ACTOR_KINDS, 'group'),
      role: text(o.role, 200),
      lean: num(o.lean, -1, 1, 0),
      ...locate(o),
    });
  }
  const placed = spreadDuplicates(actors);

  const links: Link[] = [];
  const pairs = new Set<string>();
  for (const r of list(raw.relations, 28)) {
    const o = obj(r);
    const from = slug(o.from, '');
    const to = slug(o.to, '');
    if (!ids.has(from) || !ids.has(to) || from === to) continue;
    const pair = [from, to].sort().join('|');
    if (pairs.has(pair)) continue;
    pairs.add(pair);
    const kind = text(o.kind, 24, 'influence').toLowerCase();
    links.push({
      id: `rel:${pair}`,
      from: `a:${from}`,
      to: `a:${to}`,
      kind: 'relation',
      tone: relationTone(kind),
      strength: num(o.strength, 0, 1, 0.5),
      label: text(o.note, 160, kind),
      round: 0,
    });
  }

  const ctxIds = new Set(context.map(c => c.id));
  for (const [i, e] of list(raw.evidence, 24).entries()) {
    const o = obj(e);
    const source = text(o.source, 12).toLowerCase();
    const actor = slug(o.actor, '');
    if (!ctxIds.has(source) || !ids.has(actor)) continue;
    const effect = oneOf(o.effect, ['yes', 'no', 'neutral'] as const, 'neutral');
    links.push({
      id: `ev:${source}:${actor}:${i}`,
      from: `c:${source}`,
      to: `a:${actor}`,
      kind: 'evidence',
      tone: effect === 'yes' ? 'support' : effect === 'no' ? 'oppose' : 'neutral',
      strength: 0.5,
      label: text(o.note, 160),
      round: 0,
    });
  }

  return { frame, actors: placed, links };
}
