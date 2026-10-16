import type { ContextItem, Period } from '../types';
import { feedBlock, clockLine } from './shared';

/** The research plan: what to search the news for, and what background to read, before anything else. */
export function researchPrompt(question: string, seed: string, today: string): string {
  const head = seed.trim().slice(0, 1500);
  return `TODAY: ${today} (UTC)
QUESTION: ${question}
${head ? `
SEED (the start of the asker's own material):
<<<
${head}
>>>
` : ''}
Plan the research for this forecast.
- "news": 2 news searches that would find the most recent reporting on what decides this question. Each is 2 to 4 keywords: names and key terms only, no punctuation or operators. Start each with the name the reporting would carry (the asset, the country, the person, the company).
- "desks": the newsroom desks that cover it, 1 to 3 of: world, politics, business, markets, crypto, tech, energy, defense, health, science, climate, sports.
- "instruments": if the question turns on a price that markets set every day (a coin, a share, an index, a commodity, a currency, a bond yield), its ticker as Yahoo Finance writes it, e.g. "BTC-USD", "SOL-USD", "NVDA", "^GSPC", "BZ=F", "GC=F", "EURUSD=X", "^TNX"; at most 2. Otherwise [].
- "markets": 1 or 2 short searches (2 to 4 words) that would find prediction markets (Polymarket, Manifold) on this same question, worded the way such markets are titled: for a price, the asset, "price" and the year ("Bitcoin price 2026"); otherwise the subject and the event ("Israel Lebanon invasion", "Fed December rates").
- "background": 1 or 2 Wikipedia article titles that give the background or the base rate (the institution, the conflict, the market, the recurring event).
- "cameras": only if the question turns on something a public street camera would show right now (traffic, a crowd or protest, a queue, a border crossing, floodwater, snow), 1 or 2 places to look, as a city or a landmark ("Madrid", "Port of Rotterdam"). TAKIP looks through the nearest live cameras and counts what is in view. For anything else (prices, elections, decisions), [].

JSON shape:
{"news": ["…", "…"], "desks": ["…"], "instruments": [], "markets": ["…"], "background": ["…"], "cameras": []}`;
}

export function worldPrompt(question: string, seed: string, items: ContextItem[], today: string): string {
  const hasSeed = Boolean(seed.trim());
  return `TODAY: ${today} (UTC)
QUESTION: ${question}

SEED (material supplied by the user, may be empty):
<<<
${seed.trim() || '(none)'}
>>>

SOURCES (news reporting as w…, market data as q…, prediction markets as m…, background as b…, the live TAKIP feeds as c…; cite by id):
<<<
${feedBlock(items)}
>>>

Build the world model for this forecast.
1. Decide what kind of answer the question asks for:
   - "binary": whether something happens. It resolves YES or NO.
   - "choice": which of a few named outcomes happens (who wins, which option, which way it goes). List 2 to 6 mutually exclusive outcomes that cover the realistic space; add "Other" only when the named ones leave real probability uncovered.
   - "number": how much or how many (a price, a level, a count, a rate, a share). Give the unit.
2. Pin the question down: for binary, one proposition that will clearly resolve YES or NO; for choice and number, the exact question. Give a horizon date (the simulation runs from today to it) and how a reader will judge the result.
3. Start from the outside view: for binary, a base rate from reference classes; for choice, a prior share for each outcome; for number, the current or reference value as an anchor. Say what it rests on. For a level of a market price, the market data (q…) says where the price is and how far it habitually swings: how far the level is from today's price, measured in those swings, is the outside view. A prediction market (m…) on the same question is the crowd's view: weigh it.
4. Name 6 to 12 actors that will shape the outcome: states, leaders, organisations, companies, armed or civic groups. The ones that decide will be played as agents in a simulation, so name real, specific actors that can decide and act. A market, a price, an index or "the economy" is not an actor: it is the world the actors move, and the simulation prices it. Put each on Earth (capital, headquarters, or where they act) with decimal lat/lng and an ISO 3166 country code.
5. Map 8 to 20 relations between those actors.
6. Cite the sources that bear on the outcome, by id.
7. "measure": if the question turns on a price in the market data (q…), its symbol; for a yes/no question also the level, which side of it means YES ("above" or "below"), and "touch": true if trading there once before the horizon is enough, false if it must stand there at the horizon. Otherwise null.
8. "market": if a prediction market (m…) asks this same question (the same event, the same level, a deadline within days of this one), its id; otherwise null.${hasSeed ? `
9. Quote up to 8 passages from SEED that bear on the outcome, each copied word for word (at most 240 characters). They are numbered d1, d2… in your order; the actors will quote them, and your evidence can cite them.` : ''}

JSON shape:
{
  "kind": "binary|choice|number",
  "proposition": "the YES/NO statement, or the exact question", "resolution": "how a reader would judge the result", "horizon": "YYYY-MM-DD",
  "outcomes": ["…", "…"] (choice only),
  "unit": "…" (number only, e.g. "USD per barrel"),
  "base_rate": 0.0-1.0 (binary only), "prior": [shares in the order of outcomes, summing to 1] (choice only), "anchor": number (number only),
  "base_rate_reason": "the reference class or reading, and why",
  "focus": {"place": "…", "lat": 0, "lng": 0},
  "measure": {"symbol": "SOL-USD", "threshold": 0, "direction": "above|below", "touch": true} or null,
  "market": "m1" or null,
  "actors": [{"id": "short_snake_case", "name": "…", "kind": "state|leader|organisation|company|group", "country": "US", "place": "…", "lat": 0, "lng": 0, "role": "why they matter, one line", "lean": -1.0-1.0 (pushes toward NO or lower … YES or higher; 0 for a choice question)}],
  "relations": [{"from": "actor_id", "to": "actor_id", "kind": "alliance|rivalry|conflict|trade|supply|influence|dependency|negotiation|sanctions", "strength": 0.0-1.0, "note": "one line"}],
  "evidence": [{"source": "${hasSeed ? 'w1, b1, c1 or d1' : 'w1, b1 or c1'}", "actor": "actor_id", "effect": "yes|no|neutral" (yes = toward YES or higher), "note": "one line"}]${hasSeed ? `,
  "quotes": [{"text": "a passage copied exactly from SEED", "note": "why it matters, one line"}]` : ''}
}`;
}

/** The actors who will play: chosen from the world model, each given what it wants, what it can do and what it will not accept. */
export function castPrompt(brief: string, count: number, today: string, periods: Period[]): string {
  return `TODAY: ${today} (UTC)
${brief}

${clockLine(periods)}

Cast the ${count} actors whose decisions will most shape the outcome, chosen from ACTORS above by id. Each will be played as an agent acting in its own interest, period by period, against the others. Cast only actors that can decide and act (decide, sign, veto, vote, sanction, strike, invest, list, regulate, negotiate), never a market, a price, an index or a place: those are the world the actors move. For each give:
- goal: what it actually wants out of this, in its own terms
- levers: 2 to 4 concrete things it can really do within this time, at its real scale and within its real powers
- red_lines: what it will not accept
- style: how it decides (cautious, opportunistic, bound by procedure, driven by domestic politics…), one line

JSON shape:
{"cast": [{"id": "actor_id", "goal": "…", "levers": ["…", "…"], "red_lines": "…", "style": "…"}]}`;
}
