import { amount, normalizeShares, uniform } from '../forecast';
import { dateIn } from '../engine/clock';
import { parseCites, pushOf } from '../engine/sources';
import type { Frame, Move, Period, Persona, SimEvent, WorldPoint } from '../types';
import { clamp, prob, text, slug, oneOf, list, obj, locate, favored } from './values';

/**
 * The cast: up to \`count\` actors from the world model, each with what it
 * wants, what it can do, what it will not accept and how it decides. Actors
 * the world model did not name are ignored, as are repeats.
 */
export function parseCast(raw: Record<string, unknown>, count: number, actorIds: Set<string>): { id: string; persona: Persona }[] {
  const out: { id: string; persona: Persona }[] = [];
  for (const c of list(raw.cast ?? raw.actors, count + 6)) {
    const o = obj(c);
    const id = slug(o.id ?? o.actor, '');
    if (!actorIds.has(id) || out.some(x => x.id === id)) continue;
    out.push({
      id,
      persona: {
        goal: text(o.goal, 240, 'Advance its own interests'),
        levers: list(o.levers, 4).map(l => text(l, 140)).filter(Boolean),
        redLines: text(o.red_lines ?? o.redLines, 220),
        style: text(o.style, 180),
      },
    });
    if (out.length >= count) break;
  }
  return out;
}

const STANCES = ['cooperate', 'pressure', 'oppose', 'hold'] as const;

/**
 * One actor's move. Throws when the reply says nothing the actor does: a move
 * is an action, and an actor that names none is asked again.
 */
export function parseMove(
  raw: Record<string, unknown>, actor: string, world: string, period: number, actorIds: Set<string>,
  frame?: Pick<Frame, 'kind' | 'outcomes'>,
  /** What each citable source says, to check the move's quotes against. */
  sources?: Map<string, string>,
): Move {
  const action = text(raw.action ?? raw.move, 240);
  if (!action) throw new Error('no action in the reply');
  const targets = list(Array.isArray(raw.targets) ? raw.targets : raw.target ? [raw.target] : [], 3)
    .map(t => slug(t, '')).filter((t, i, a) => actorIds.has(t) && t !== actor && a.indexOf(t) === i);
  const outcomes = frame?.kind === 'choice' ? frame.outcomes : [];
  const favors = favored(raw.favors, outcomes);
  const why = text(raw.why ?? raw.reasoning, 240);
  return {
    id: `${world}:${actor}:${period}`,
    world,
    period,
    actor,
    action,
    statement: text(raw.statement ?? raw.says, 300),
    targets,
    stance: oneOf(raw.stance, STANCES, targets.length ? 'pressure' : 'hold'),
    push: frame?.kind === 'choice' ? (favors ? 'yes' : 'neutral') : pushOf(raw.effect ?? raw.push),
    ...(favors ? { favors } : {}),
    why,
    cites: sources ? parseCites(raw.cites ?? raw.citations ?? raw.quotes, sources, 2, outcomes) : [],
  };
}

/**
 * The world engine's step: what happened in one period of one world (one to
 * four events, dated inside the period, at most one of them a surprise), and
 * where the question then stands. A figure the reply leaves out falls back on
 * the world's last one, then on the frame's prior; a number question with
 * neither throws, and the step is asked again.
 */
/**
 * The world engine's step: the period's events, where the question stands,
 * and, on a price question (`priced`), how far the events push the price
 * beyond its own course (`push`, a fraction, at most ±30%). On a price
 * question the price decides the standing, so a reply without one is fine.
 */
export function parseStep(
  raw: Record<string, unknown>, world: string, period: Period, actorIds: Set<string>,
  frame: Pick<Frame, 'kind' | 'outcomes' | 'baseRate' | 'prior' | 'anchor'>,
  last: WorldPoint | null,
  priced = false,
): { events: SimEvent[]; point: WorldPoint; push: number } {
  const outcomes = frame.kind === 'choice' ? frame.outcomes : [];
  const events: SimEvent[] = [];
  let shocks = 0;
  for (const e of list(raw.events, 6)) {
    const o = obj(e);
    const title = text(o.title ?? o.event, 140);
    if (!title) continue;
    const kind = oneOf(o.kind, ['event', 'shock'] as const, 'event');
    if (kind === 'shock' && shocks++ > 0) continue;
    const favors = favored(o.favors, outcomes);
    events.push({
      id: `${world}:${period.index}:${events.length + 1}`,
      world,
      period: period.index,
      date: dateIn(o.date, period),
      title,
      detail: text(o.detail ?? o.description, 360),
      actors: list(o.actors, 4).map(a => slug(a, '')).filter(a => actorIds.has(a)),
      push: frame.kind === 'choice' ? (favors ? 'yes' : 'neutral') : pushOf(o.effect ?? o.push),
      ...(favors ? { favors } : {}),
      kind,
      ...locate(o),
    });
    if (events.length >= 4) break;
  }
  events.sort((a, b) => a.date.localeCompare(b.date));

  const st = obj(raw.state ?? raw.standing);
  const note = text(st.note ?? st.summary, 240);
  const said = text(st.resolved, 60).toLowerCase();
  const pushed = amount(raw.price_push ?? st.price_push);
  // A model that writes 8 for 8% means 0.08.
  const push = pushed === null ? 0 : clamp(Math.abs(pushed) > 1 ? pushed / 100 : pushed, -0.3, 0.3);
  if (frame.kind === 'choice') {
    const won = said && said !== 'null' && said !== 'none' ? favored(st.resolved, outcomes) : '';
    const shares = won
      ? outcomes.map(o => (o === won ? 1 : 0))
      : normalizeShares(st.shares ?? st.distribution, outcomes, last?.shares ?? (frame.prior.length === outcomes.length ? frame.prior : uniform(outcomes.length)));
    return { events, point: { world, period: period.index, probability: Math.max(...shares), shares, resolved: won || null, note }, push };
  }
  if (frame.kind === 'number') {
    const value = amount(st.value ?? st.estimate) ?? last?.value ?? frame.anchor;
    if ((value === null || value === undefined) && !priced) throw new Error('no value in the reply');
    return { events, point: { world, period: period.index, probability: 0.5, value: value ?? 0, resolved: null, note }, push };
  }
  const resolved = /^y(es)?$/.test(said) ? 'yes' : /^no?$/.test(said) ? 'no' : null;
  const probability = resolved === 'yes' ? 0.99 : resolved === 'no' ? 0.01 : prob(st.probability ?? st.p, last?.probability ?? frame.baseRate);
  return { events, point: { world, period: period.index, probability, resolved, note }, push };
}
