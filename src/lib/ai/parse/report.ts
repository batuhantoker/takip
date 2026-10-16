import { amount, answerText, normalizeShares, orderEstimate, uniform } from '../forecast';
import { sourceIds } from '../engine/sources';
import type { Driver, Estimate, Frame, PathStep, Report, Scenario, Signpost } from '../types';
import { num, prob, text, slug, oneOf, list, obj, locate, favored } from './values';

/** A direction as a model writes it: yes/no, up/down, higher/lower, for/against. */
function direction(v: unknown): 'yes' | 'no' {
  const s = typeof v === 'string' ? v.toLowerCase().trim() : '';
  return /^(no|down|lower|against|decrease|less)/.test(s) ? 'no' : 'yes';
}

/**
 * The report. `swarm` is where the simulation ended: a binary question's
 * pooled P(YES), a choice question's pooled shares, a number question's
 * pooled estimate. The report agent's figures override it only where they
 * parse. The predicted path keeps its steps in date order.
 */
export function parseReport(
  raw: Record<string, unknown>,
  swarm: { probability: number; shares?: number[]; estimate?: Estimate },
  actorIds: Set<string>,
  frame?: Pick<Frame, 'kind' | 'outcomes' | 'unit'>,
  /** The ids a driver may cite. */
  sources?: Set<string>,
  /** The simulated worlds, by id. */
  worldIds?: Set<string>,
): Report {
  const outcomes = frame?.kind === 'choice' ? frame.outcomes : [];
  const drivers: Driver[] = list(raw.drivers, 6).map(d => {
    const o = obj(d);
    const actor = slug(o.actor, '');
    return {
      text: text(o.text, 220),
      push: direction(o.push),
      favors: favored(o.favors ?? o.push, outcomes),
      weight: num(o.weight, 0, 1, 0.5),
      actor: actorIds.has(actor) ? actor : null,
      ...(sources ? { sources: sourceIds(o.sources ?? o.source, sources) } : {}),
    };
  }).filter(d => d.text);

  const scenarios: Scenario[] = list(raw.scenarios, 4).map(s => {
    const o = obj(s);
    return { name: text(o.name, 80), probability: num(o.probability, 0, 1, 0), description: text(o.description, 360), ...locate(o) };
  }).filter(s => s.name);
  // Scenarios are alternatives: make them add up, whatever the model wrote.
  const total = scenarios.reduce((t, s) => t + s.probability, 0);
  if (total > 0) for (const s of scenarios) s.probability = Math.round((s.probability / total) * 100) / 100;

  const signposts: Signpost[] = list(raw.signposts, 6).map(s => {
    const o = obj(s);
    return { text: text(o.text, 220), means: direction(o.means), favors: favored(o.favors ?? o.means, outcomes), ...locate(o) };
  }).filter(s => s.text);

  let probability = prob(raw.probability, swarm.probability);
  let shares: number[] | undefined;
  let estimate: Estimate | undefined;
  if (frame?.kind === 'choice') {
    shares = normalizeShares(raw.shares ?? raw.distribution, outcomes, swarm.shares ?? uniform(outcomes.length));
    probability = Math.max(...shares);
  } else if (frame?.kind === 'number') {
    const e = obj(raw.estimate);
    const value = amount(raw.estimate !== null && typeof raw.estimate === 'object' ? e.value : raw.estimate);
    estimate = value === null && swarm.estimate ? swarm.estimate
      : value === null ? undefined
      : orderEstimate(value, amount(e.low ?? raw.low), amount(e.high ?? raw.high));
    probability = 0.5;
  }
  const report: Report = {
    headline: text(raw.headline, 120, 'Prediction'),
    answer: '',
    probability,
    swarm: swarm.probability,
    ...(shares ? { shares } : {}),
    ...(estimate ? { estimate } : {}),
    confidence: oneOf(raw.confidence, ['low', 'medium', 'high'] as const, 'medium'),
    summary: text(raw.summary, 1200),
    drivers,
    scenarios,
    signposts,
    dissent: text(raw.dissent, 400),
    caveats: list(raw.caveats, 5).map(c => text(c, 200)).filter(Boolean),
    deviation: text(raw.deviation_reason ?? raw.deviation, 300),
    path: list(raw.path ?? raw.timeline, 10).map((p): PathStep => {
      const o = obj(p);
      const date = text(o.date, 10);
      return {
        date: /^\d{4}-\d{2}(-\d{2})?$/.test(date) ? date : '',
        title: text(o.title ?? o.event, 160),
        detail: text(o.detail ?? o.description, 320),
        actors: list(o.actors, 4).map(a => slug(a, '')).filter(a => actorIds.has(a)),
      };
    }).filter(p => p.title).sort((a, b) => (a.date && b.date ? a.date.localeCompare(b.date) : 0)),
    actorMoves: list(raw.actor_moves ?? raw.actorMoves, 10).map(m => {
      const o = obj(m);
      return { actor: slug(o.actor ?? o.id, ''), prediction: text(o.prediction ?? o.move, 260) };
    }).filter(m => actorIds.has(m.actor) && m.prediction),
    worlds: list(raw.worlds, 8).map(w => {
      const o = obj(w);
      return { world: text(o.world ?? o.id, 12).replace(/^world\s*/i, '').slice(0, 2).toUpperCase(), outcome: text(o.outcome, 140), summary: text(o.summary, 260) };
    }).filter(w => w.outcome && (!worldIds || worldIds.has(w.world))),
  };
  report.answer = frame ? answerText({ ...emptyFrame, ...frame }, report, null) : `${Math.round(probability * 100)}% YES`;
  return report;
}

/** The fields answerText needs beyond the kind, when a caller has only part of a frame. */
const emptyFrame: Frame = {
  question: '', kind: 'binary', proposition: '', resolution: '', horizon: '', outcomes: [], unit: '',
  baseRate: 0.5, prior: [], anchor: null, baseRateReason: '', focus: null,
};
