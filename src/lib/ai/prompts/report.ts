import { formatAmount } from '../forecast';
import { priceText } from '../quant/series';
import { recordSentence } from '../quant/backtest';
import { ladderGaps, ladderSentence, readLadder } from '../quant/ladder';
import { evidenceLedger, type LedgerRow } from '../engine/sources';
import type { Actor, ContextItem, Frame, Move, Period, Quant, Report, RoundStat, WorldPoint } from '../types';
import { pct, dataBlock, outcomeList } from './shared';

/** One line per period, the worlds pooled, in the terms of the question's kind. */
export function trajectoryLine(frame: Frame, r: RoundStat): string {
  if (frame.kind === 'choice' && r.shares) {
    const picks = r.votes ? ` (worlds leaning to each: ${frame.outcomes.map((o, i) => `${o} ${r.votes![i] ?? 0}`).join(', ')})` : '';
    return `period ${r.round}: ${frame.outcomes.map((o, i) => `${o} ${pct(r.shares![i] ?? 0)}`).join(', ')}${picks}, worlds=${r.n}`;
  }
  if (frame.kind === 'number' && r.value) {
    const v = r.value;
    return `period ${r.round}: median ${formatAmount(v.median)}, worlds from ${formatAmount(v.min)} to ${formatAmount(v.max)}, worlds=${r.n}`;
  }
  return `period ${r.round}: P(YES) pooled ${pct(r.consensus)}, worlds from ${pct(r.min)} to ${pct(r.max)}, worlds=${r.n}`;
}

/** What the actors quoted, source by source, for the report agent: the evidence the simulation started from. */
function ledgerBlock(frame: Frame, rows: LedgerRow[]): string {
  if (!rows.length) return '';
  const up = frame.kind === 'number' ? 'up' : 'toward YES';
  const down = frame.kind === 'number' ? 'down' : 'toward NO';
  const lines = rows.slice(0, 14).map(r => {
    const how = frame.kind === 'choice'
      ? Object.entries(r.favors).map(([o, n]) => `${n} for ${o}`).join(', ') || 'context'
      : [r.yes && `${r.yes} ${up}`, r.no && `${r.no} ${down}`, r.neutral && `${r.neutral} context`].filter(Boolean).join(', ');
    return `[${r.source}] quoted ${r.quoted}× by ${r.actors.length} actor${r.actors.length === 1 ? '' : 's'}: ${how}`;
  });
  return `
EVIDENCE LEDGER (what the actors quoted, and which way it pushed them):
${lines.join('\n')}
`;
}

/** How one world ended, in the question's terms. */
export function worldOutcome(frame: Frame, p: WorldPoint | undefined): string {
  if (!p) return 'no result';
  if (p.resolved) return frame.kind === 'binary' ? `resolved ${p.resolved.toUpperCase()}` : `came about: ${p.resolved}`;
  if (frame.kind === 'number') return p.value !== undefined ? `${formatAmount(p.value)}${frame.unit ? ` ${frame.unit}` : ''}` : 'no value';
  if (frame.kind === 'choice' && p.shares) return frame.outcomes.map((o, i) => `${o} ${pct(p.shares![i] ?? 0)}`).join(', ');
  return `still open, ${pct(p.probability)} YES`;
}

/**
 * What the prediction rests on, for the report agent: the statistical
 * baseline from the price's own history, the prediction markets (the one on
 * this same question named as such), and the worlds pooled.
 */
export function anchorsBlock(frame: Frame, quant: Quant | null, odds: ContextItem[], last: RoundStat | undefined): string {
  const lines: string[] = [];
  if (quant) {
    const range = `80% of paths end between ${priceText(quant.p10, quant.currency)} and ${priceText(quant.p90, quant.currency)}, the middle at ${priceText(quant.p50, quant.currency)}`;
    lines.push(`- Statistical baseline (${quant.symbol}'s own price history, no view on events)${quant.probability !== undefined && frame.kind === 'binary' ? `: ${pct(quant.probability)} YES` : ''}. ${range}. ${quant.method}`);
    // How far the baseline can be trusted on this instrument: its record on the instrument's own past.
    if (quant.backtest) lines.push(`- The baseline's record: ${recordSentence(quant.backtest, quant.symbol, quant.probability)}`);
    // The crowd's whole ladder beside the model's curve: where each sees more upside or downside.
    const ladder = (odds.find(o => o.id === frame.market) ?? odds.find(o => o.odds?.ladder))?.odds;
    if (quant.curve && ladder?.ladder) {
      const read = ladderSentence(readLadder(ladderGaps(quant.curve, ladder.ladder, quant.price)), n => priceText(n, quant.currency), ladder.platform);
      if (read) lines.push(`- The ladder: ${read}`);
    }
  }
  for (const o of odds) {
    if (!o.odds) continue;
    const same = frame.market === o.id;
    const what = same ? 'Prediction market on THIS question'
      // A "which" question is priced one outcome at a time: each market is the crowd's price on one of them.
      : frame.kind === 'choice' ? 'Prediction market on one outcome (or a related question)'
        : 'Related prediction market (a different question: context, not an anchor)';
    lines.push(`- [${o.id}] ${what}: "${o.title}". ${o.excerpt ?? ''}`);
  }
  if (last) lines.push(`- The worlds as they ended: ${trajectoryLine(frame, last)}.`);
  const sim = quant?.simulated;
  if (sim) {
    lines.push(frame.kind === 'binary' && sim.probability !== undefined
      ? `- The simulation, priced (each world's events applied, as the push they gave the price, across thousands of the market's own paths): ${pct(sim.probability)} YES. A handful of worlds is too few to count outcomes in; this is the simulation's probability.`
      : `- The simulation, priced (each world's events applied across thousands of the market's own paths): the middle at ${priceText(sim.p50, quant!.currency)}, 80% between ${priceText(sim.p10, quant!.currency)} and ${priceText(sim.p90, quant!.currency)}.`);
  }
  return lines.join('\n');
}

function reportAsk(frame: Frame, last: RoundStat | undefined, simulated?: { probability?: number; p10: number; p50: number; p90: number }): { ask: string; fields: string; push: string } {
  if (frame.kind === 'choice') {
    const pooled = last?.shares ? frame.outcomes.map((o, i) => `${o} ${pct(last.shares![i] ?? 0)}`).join(', ') : 'unknown';
    return {
      ask: `Give a calibrated final share for each outcome, in the order listed (${outcomeList(frame)}). The worlds pooled give ${pooled}. Where a liquid prediction market prices one of the outcomes, it is real money on that outcome: weigh it as such. If you move any outcome more than 10 points from the worlds or from such a market, say why in deviation_reason.`,
      fields: `"shares": [${frame.outcomes.map(() => '0.0').join(', ')}]`,
      push: '"push": "yes|no", "favors": "the outcome it helps"',
    };
  }
  if (frame.kind === 'number') {
    const pooled = simulated ? `${formatAmount(simulated.p50)} (80% of the priced paths between ${formatAmount(simulated.p10)} and ${formatAmount(simulated.p90)})`
      : last?.value ? `${formatAmount(last.value.median)} (worlds from ${formatAmount(last.value.min)} to ${formatAmount(last.value.max)})` : 'unknown';
    return {
      ask: `Give a calibrated final estimate${frame.unit ? ` in ${frame.unit}` : ''} with an 80% range. The worlds' median is ${pooled}; if you move far from it, say why in deviation_reason.`,
      fields: '"estimate": {"value": number, "low": number, "high": number}',
      push: '"push": "up|down"',
    };
  }
  return {
    ask: `Give a calibrated final probability that the proposition resolves YES. The worlds pooled give ${simulated?.probability !== undefined ? `${pct(simulated.probability)} (priced: each world's events applied across the market's own paths)` : last ? pct(last.consensus) : 'unknown'}. Weigh what the prediction rests on: a liquid prediction market on this same question is real money from many traders and usually the best single estimate; the statistical baseline is the outside view for a price; the worlds are a handful, a small sample, but each tells you what could move the outcome. Move off the market or the baseline only for reasons the sources and the simulation give, and if you end more than 10 points from the pool or from such a market, say why in deviation_reason.`,
    fields: '"probability": 0.0-1.0',
    push: '"push": "yes|no"',
  };
}

export interface ReportInput {
  frame: Frame;
  brief: string;
  periods: Period[];
  worlds: { world: string; history: string; outcome: string }[];
  rounds: RoundStat[];
  injects: string[];
  evidence: string;
  /** The asker's own data, when the whole simulation reads it. */
  data?: string;
  /** There are sources to quote. */
  citable?: boolean;
  /** Every move of the run, for the evidence ledger. */
  moves?: Move[];
  /** What the prediction rests on (see anchorsBlock). */
  anchors?: string;
  /** A price question: the simulation priced across the market's own paths. */
  simulated?: { probability?: number; p10: number; p50: number; p90: number };
  today: string;
}

/** The prediction: the probability the worlds add up to, and the story of how it most likely unfolds. */
export function reportPrompt(input: ReportInput): string {
  const f = input.frame;
  const { ask, fields, push } = reportAsk(f, input.rounds[input.rounds.length - 1], input.simulated);
  const means = f.kind === 'number' ? '"means": "up|down"' : f.kind === 'choice' ? '"means": "yes|no", "favors": "the outcome it points to"' : '"means": "yes|no"';
  const ledger = input.moves?.length ? ledgerBlock(f, evidenceLedger(input.moves)) : '';
  const span = input.periods.length ? `from ${input.periods[0].start} to ${input.periods[input.periods.length - 1].end}` : 'to the horizon';
  return `TODAY: ${input.today} (UTC)
You are the TAKIP report agent. The simulation is over: ${input.worlds.length} worlds ran ${span}, the actors playing themselves. Write the prediction.

${input.brief}

SOURCES:
<<<
${input.evidence}
>>>
${dataBlock(input.data)}${ledger}
THE WORLDS:
${input.worlds.map(w => `WORLD ${w.world}: ended ${w.outcome}\n${w.history}`).join('\n\n')}

THE WORLDS POOLED, PERIOD BY PERIOD:
${input.rounds.map(r => trajectoryLine(f, r)).join('\n')}
${input.anchors ? `\nWHAT THE PREDICTION RESTS ON:\n${input.anchors}\n` : ''}${input.injects.length ? `\nEVENTS INJECTED DURING THE SIMULATION:\n${input.injects.map(t => `- ${t}`).join('\n')}\n` : ''}
${ask}
Then tell the story. "path": the course the future most likely takes, date by date from today to the horizon, built from what the worlds agree on (4 to 8 steps, real dates, named actors). "actor_moves": what each main actor is predicted to do, one line each. "worlds": how each world ended, one line each. Scenarios are the distinct ways the worlds played out (group worlds that ended alike), each with its probability and where it would unfold. Signposts are concrete, observable things to watch, each placed on Earth, saying which way they would move the prediction.${input.citable ? '\nSource every driver: give the ids of the sources it rests on, so a reader can follow it back.' : ''}

JSON shape:
{"headline": "the prediction, at most 90 characters", ${fields}, "confidence": "low|medium|high", "summary": "3 to 5 sentences: the prediction and why", "path": [{"date": "YYYY-MM-DD", "title": "what happens", "detail": "one sentence", "actors": ["actor_id"]}], "actor_moves": [{"actor": "actor_id", "prediction": "what it will do"}], "worlds": [{"world": "A", "outcome": "how it ended", "summary": "one line"}], "drivers": [{"text": "…", ${push}, "weight": 0.0-1.0, "actor": "actor_id or null"${input.citable ? ', "sources": ["w3", "c1"]' : ''}}], "scenarios": [{"name": "…", "probability": 0.0-1.0, "description": "…", "place": "…", "lat": 0, "lng": 0}], "signposts": [{"text": "…", ${means}, "place": "…", "lat": 0, "lng": 0}], "dissent": "the strongest case against the prediction", "caveats": ["…"], "deviation_reason": "… or null"}`;
}

/* ───────────────────────────── After the run ───────────────────────────── */

/** An actor answering the reader, in character, about what it did in the worlds. */
export function askActorPrompt(actor: Actor, brief: string, moves: Move[], report: Report | null, message: string): string {
  const p = actor.persona;
  return `You are ${actor.name} (${actor.kind}): ${actor.role}.${p ? ` Your goal: ${p.goal}. Your red lines: ${p.redLines}.` : ''}
You were played in a TI (Takip AI) simulation of the future.

${brief}

WHAT YOU DID IN THE SIMULATED WORLDS:
${moves.map(m => `World ${m.world}, period ${m.period}: ${m.action}${m.statement ? ` Said: "${m.statement}"` : ''} (why: ${m.why})`).join('\n') || '(nothing)'}
${report ? `\nTHE PREDICTION: ${report.headline}. ${report.answer}. ${report.summary}` : ''}

Someone asks you:
<<<
${message}
>>>

Answer in character, in plain prose (no JSON, no markdown headings), in at most 180 words.`;
}

export function askReportPrompt(frame: Frame, brief: string, report: Report, rounds: RoundStat[], message: string): string {
  return `You are the TAKIP report agent who wrote this prediction from a simulation of the future.

${brief}

PREDICTION: ${report.headline}
Answer: ${report.answer}, confidence ${report.confidence}.
${report.summary}
Predicted path: ${report.path.map(s => `${s.date}: ${s.title}`).join('; ')}
Drivers: ${report.drivers.map(d => `${d.text} (${frame.kind === 'choice' ? d.favors || d.push : d.push})`).join('; ')}
Scenarios: ${report.scenarios.map(s => `${s.name} ${pct(s.probability)}`).join('; ')}
Dissent: ${report.dissent}
The worlds pooled, by period:
${rounds.map(r => trajectoryLine(frame, r)).join('\n')}

Question from the reader:
<<<
${message}
>>>

Answer plainly and specifically in at most 220 words of prose (no JSON, no markdown headings).`;
}
