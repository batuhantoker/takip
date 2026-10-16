import { DATA_ID } from '../engine/sources';
import type { Actor, Frame, Move, Period, SimEvent } from '../types';
import { dataBlock, outcomeList } from './shared';

/** How an actor or the report cites: by id, the words copied exactly, so a reader can follow every quote to its source. */
const CITE_RULE = 'Quote your sources word for word, each by its id: copy the words exactly as they appear, never paraphrase inside a quote, and quote only what is there.';

/**
 * What has happened in one world so far, period by period, in dated events;
 * on a price question, each period ends with where the price went in it
 * (`priced`, a line per period, or null where there is none).
 */
export function historyBlock(periods: Period[], events: SimEvent[], upTo: number, priced?: (period: number) => string | null): string {
  const lines: string[] = [];
  for (const p of periods.filter(x => x.index < upTo)) {
    const evs = events.filter(e => e.period === p.index);
    const price = priced?.(p.index) ?? null;
    lines.push(`Period ${p.index} (${p.label}):${evs.length || price ? '' : ' nothing of note'}`);
    for (const e of evs) lines.push(`- ${e.date}: ${e.title}${e.kind === 'shock' ? ' [surprise]' : e.kind === 'injected' ? ' [injected]' : ''}. ${e.detail}`);
    if (price) lines.push(`- The market: ${price}`);
  }
  return lines.join('\n') || '(nothing yet: the simulation starts today, in the world as the sources describe it)';
}

/** The moves of one period, as the others and the world engine see them. */
export function movesBlock(moves: Move[], name: (id: string) => string): string {
  if (!moves.length) return '(none)';
  return moves.map(m => {
    const said = m.statement ? ` Says: "${m.statement}"` : '';
    const at = m.targets.length ? ` (aimed at ${m.targets.map(name).join(', ')}, ${m.stance})` : m.stance === 'hold' ? ' (holds)' : '';
    return `- ${m.actor} (${name(m.actor)}): ${m.action}${at}.${said}`;
  }).join('\n');
}

function effectAsk(frame: Frame): { words: string; field: string } {
  if (frame.kind === 'choice') return { words: 'which outcome it helps, or neutral', field: '"effect": "yes|neutral", "favors": "the outcome it helps"' };
  if (frame.kind === 'number') return { words: 'whether it pushes the quantity up or down, or neutral', field: '"effect": "up|down|neutral"' };
  return { words: 'whether it pushes toward YES or toward NO, or neutral', field: '"effect": "yes|no|neutral"' };
}

export interface MoveInput {
  frame: Frame;
  actor: Actor;
  cast: Actor[];
  world: string;
  period: Period;
  periods: number;
  brief: string;
  evidence: string;
  /** The asker's own data, when the whole simulation reads it. */
  data?: string;
  history: string;
  /** What the others did last period. */
  others: string;
  injects: string[];
  /** There are sources to quote. */
  citable: boolean;
  /** A price question: where the price stands in this world, in a line. */
  market?: string;
  today: string;
}

/** One actor's move in one period of one world. */
export function movePrompt(i: MoveInput): string {
  const a = i.actor;
  const p = a.persona!;
  const ids = i.data ? `ids such as w2, b1, c3 or d1, or ${DATA_ID} for SEED` : 'ids such as w2, b1 or c3';
  const effect = effectAsk(i.frame);
  const first = i.period.index === 1;
  const cite = i.citable
    ? first
      ? `\nGround your first move in the real world: quote 1 or 2 sources that shape it (${ids}). Quote what decides the move (a reported fact, a figure, a statement, a price, the odds), never a general description of who you are or what something is. ${CITE_RULE} A first move without a quote is sent back.`
      : `\nIf a source still shapes your decision, quote what in it decides the move (${ids}). ${CITE_RULE}`
    : '';
  const injects = i.injects.length ? `\nBREAKING (it has just happened; it is real in this world):\n${i.injects.map(t => `- ${t}`).join('\n')}\n` : '';
  return `TODAY (the real date): ${i.today} (UTC)
SIMULATED WORLD ${i.world}, PERIOD ${i.period.index} OF ${i.periods}: ${i.period.label}

You are ${a.name} (${a.kind}${a.place ? `, ${a.place}` : ''}): ${a.role}. Play it as it really is, not as anyone would like it to be.
YOUR GOAL: ${p.goal}
WHAT YOU CAN DO: ${p.levers.join('; ')}
YOUR RED LINES: ${p.redLines || 'none stated'}
HOW YOU DECIDE: ${p.style || 'as your record suggests'}

${i.brief}

THE OTHER ACTORS IN PLAY:
${i.cast.filter(c => c.id !== a.id).map(c => `- ${c.id}: ${c.name}: wants ${c.persona?.goal ?? c.role}`).join('\n') || '(none)'}

SOURCES (the real world as of today):
<<<
${i.evidence}
>>>
${dataBlock(i.data)}
WHAT HAS HAPPENED IN THIS WORLD SO FAR:
${i.history}
${i.market ? `\nTHE MARKET IN THIS WORLD: ${i.market}\n` : ''}
WHAT THE OTHERS DID LAST PERIOD:
${i.others}
${injects}
Decide your move for this period (${i.period.start} to ${i.period.end}): the one concrete thing you would really do now, within your levers and red lines, given what has happened. Act at your real scale and within your real powers, the way your record says you act: no secret coordination with others, no moving a price at will, nothing you could not really do in this time. Waiting is a move when it is what you would really do. Say what you announce in public, if anything, which actors your move is aimed at, your stance toward them, and ${effect.words}.${cite}

JSON shape:
{"action": "what you do, concretely, at most 200 characters", "statement": "what you say in public, or empty", "targets": ["actor_id"], "stance": "cooperate|pressure|oppose|hold", ${effect.field}, "why": "your private reasoning, one line"${i.citable ? ', "cites": [{"source": "w2", "quote": "words copied exactly from that source, at most 200 characters", "effect": "yes|no|neutral", "why": "how it shapes your move, at most 120 characters"}]' : ''}}`;
}

/** How each world is told to treat chance: the first follows the likeliest course, the last is tested hardest. */
export function worldTemper(index: number, count: number): string {
  if (index === 0) return 'This world follows the most likely course: no surprises beyond what the moves themselves bring.';
  if (index === count - 1 && count > 2) return 'In this world, test the course against friction: delays, misjudgements and at most one plausible surprise from outside are more likely than usual.';
  return 'In this world, chance plays its normal part: things can go somewhat better or worse than the actors expect, and one plausible surprise from outside may occur.';
}

export interface StepInput {
  frame: Frame;
  world: string;
  worldIndex: number;
  worlds: number;
  period: Period;
  periods: number;
  brief: string;
  history: string;
  /** Where the question stood after the last period, in a line. */
  standing: string;
  moves: string;
  injects: string[];
  /**
   * A price question: the price in this world, its own course this period,
   * and whether the price decides where the question stands (a level, or a
   * value at the horizon), in which case the world engine does not.
   */
  market?: { line: string; decides: boolean };
  today: string;
}

function standingAsk(frame: Frame, last: boolean): { ask: string; fields: string } {
  if (frame.kind === 'choice') {
    return {
      ask: `Has one outcome come about in this world? If not, what share does each outcome now have (${outcomeList(frame)})?`,
      fields: `"resolved": null or "the outcome that came about", "shares": [${frame.outcomes.map(() => '0.0').join(', ')}]`,
    };
  }
  if (frame.kind === 'number') {
    return {
      ask: last
        ? `What is the quantity's value at the horizon in this world${frame.unit ? `, in ${frame.unit}` : ''}?`
        : `What is the quantity's value now, at the end of this period, in this world${frame.unit ? `, in ${frame.unit}` : ''}?`,
      fields: '"value": number',
    };
  }
  return {
    ask: last
      ? 'This is the last period: has the proposition come true in this world (resolved "yes") or not ("no")? If it is still genuinely open at the horizon, give how likely YES is.'
      : 'Has the proposition already resolved in this world (yes or no)? If not, how likely is YES by the horizon, as this world now stands?',
    fields: '"resolved": null or "yes" or "no", "probability": 0.0-1.0',
  };
}

/** The world engine's step: what actually happens in one period of one world, and where the question then stands. */
export function stepPrompt(i: StepInput): string {
  const last = i.period.index === i.periods;
  const { ask, fields } = i.market?.decides
    ? { ask: 'The price decides where the question stands, so do not judge that yourself: say in a line where things stand.', fields: '' }
    : standingAsk(i.frame, last);
  const market = i.market ? `\nTHE MARKET IN THIS WORLD: ${i.market.line}\n` : '';
  const pushAsk = i.market
    ? `\n4. The price: if this period's events would move it beyond its own course (news that changes what it is worth: a ruling, a listing, a hack, a deal, a shock), give "price_push", the extra move as a fraction (0.05 = 5% higher than its own course, −0.05 = 5% lower); 0 if they would not. Be realistic: ordinary news moves a price a few percent; only news of real weight 15 to 30%; never more.`
    : '';
  const injects = i.injects.length
    ? `\nEVENTS INJECTED BY THE OPERATOR (they happen in this period, as stated, and the world reacts):\n${i.injects.map(t => `- ${t}`).join('\n')}\n`
    : '';
  const effect = effectAsk(i.frame);
  return `TODAY (the real date): ${i.today} (UTC)
You are the world engine of simulated world ${i.world} (${i.worldIndex + 1} of ${i.worlds}): an impartial, realistic simulator of what actually happens. ${worldTemper(i.worldIndex, i.worlds)}

${i.brief}

PERIOD ${i.period.index} OF ${i.periods}: ${i.period.label} (${i.period.start} to ${i.period.end})

WHAT HAS HAPPENED IN THIS WORLD SO FAR:
${i.history}

WHERE THE QUESTION STOOD: ${i.standing}

THE ACTORS' MOVES THIS PERIOD (made at the same time, each without knowing the others'):
${i.moves}
${injects}${market}
Decide what actually happens in this period.
1. Give 1 to 4 events, dated within the period, that follow from the moves and how they collide: what works, what fails, what is delayed, who reacts and how. Be realistic about time: talks take rounds, laws take readings and votes, deals slip, markets move on news. Place each event on Earth.
2. Add a surprise from outside the actors' control (kind "shock") only if this world calls for it, and only one.
3. Then say where the question stands at the end of the period. ${ask}${pushAsk}
For each event, say ${effect.words}.

JSON shape:
{"events": [{"date": "YYYY-MM-DD", "title": "what happened, at most 100 characters", "detail": "one or two sentences", "actors": ["actor_id"], ${effect.field}, "kind": "event|shock", "place": "…", "lat": 0, "lng": 0}], "state": {${fields ? `${fields}, ` : ''}"note": "where things stand, one line"}${i.market ? ', "price_push": 0.0' : ''}}`;
}
