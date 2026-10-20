/**
 * An event family over time on History's map: the clock runs from the first year to the last and each event
 * shows as it happens, while the globe turns to where most of each stretch's events were. Every number the
 * narrator says (counts, places, the biggest events) is counted from history.db here.
 */
import { askJson } from '../narrate/llm';
import type { Beat } from '../scene';
import type { Maker } from './context';
import { countBy, decadeOf, densest, sampleYears } from './facts';
import { eventsIn } from './history-db';
import { EVENT_PRESETS } from './presets/events';

const LEGS = 4;
const LEG_MS = 7000;
const FLY_MS = 2500;
const YEAR_S = 365.2425 * 86400;

const yearMs = (y: number) => {
  const d = new Date(0);
  d.setUTCFullYear(y, 0, 1);
  return d.getTime();
};

const SYSTEM = `You write voiceover for short vertical videos where events appear on a world map as a year counter runs.
A calm documentary narrator. Use only the numbers, names and places in the facts; never add causes, blame or numbers
of your own. Short, vivid sentences; no questions, no exclamation marks. Reply with JSON only.`;

export const events: Maker = {
  id: 'events',
  kind: 'story',
  presets: Object.keys(EVENT_PRESETS),
  about: `An event family over time, counted from history.db (--preset ${Object.keys(EVENT_PRESETS).join('|')})`,
  async make(ctx) {
    const p = EVENT_PRESETS[ctx.args.preset ?? ''];
    if (!p) throw new Error(`--preset must be one of ${Object.keys(EVENT_PRESETS).join(', ')}`);
    const years = sampleYears(p.from, p.to, LEGS + 1);
    const id = (i: number) => `leg-${i + 1}`;

    const facts = await ctx.once('facts', async () => {
      const all = eventsIn(p.kinds, yearMs(p.from), yearMs(p.to));
      const legs = years.slice(0, -1).map((y, i) => {
        const rows = all.filter(e => e.t >= yearMs(y) && e.t < yearMs(years[i + 1]));
        return {
          from: y,
          to: years[i + 1] - 1,
          count: rows.length,
          where: countBy(rows, p.where).slice(0, 3).map(([k, n]) => `${k} (${n})`),
          biggest: [...rows].sort((a, b) => p.size(b) - p.size(a)).filter(e => p.size(e) > 0).slice(0, 3).map(p.describe),
          centre: densest(rows),
        };
      });
      const [busiest, busiestCount] = countBy(all, e => String(decadeOf(e.t)))[0] ?? ['', 0];
      return { total: all.length, busiest: busiest ? `the ${busiest}s (${busiestCount})` : null, where: countBy(all, p.where).slice(0, 5).map(([k, n]) => `${k} (${n})`), legs };
    });
    if (!facts.total) throw new Error(`no events of ${p.kinds.join(', ')} between ${p.from} and ${p.to}`);

    const lines = await ctx.once('lines', () => askJson<{ hook: string; lines: Record<string, string>; outro: string }>(SYSTEM,
      `The video shows ${p.topic}. ${p.coverage}\nIn all: ${facts.total} events; most in ${facts.where.join(', ')}; ` +
      `busiest decade ${facts.busiest}.\n\nStretches, in order:\n` +
      facts.legs.map((l, i) => `[${id(i)}] ${l.from}–${l.to}: ${l.count} events; most in ${l.where.join(', ') || 'nowhere'}; ` +
        `biggest: ${l.biggest.join('; ') || 'none recorded'}`).join('\n') +
      `\n\nWrite:\n- "hook": at most 10 words that open the video and make people stay, with the total;\n` +
      `- "lines": for each stretch, one sentence of at most 18 words with its numbers or a named event;\n` +
      `- "outro": at most 12 words inviting people to explore it themselves on TAKIP.\n` +
      `Return {"hook": "...", "lines": {${facts.legs.map((_, i) => `"${id(i)}": "..."`).join(', ')}}, "outro": "..."}.`,
      { check: v => (v.hook && v.outro && facts.legs.every((_, i) => v.lines?.[id(i)]?.trim()) ? null : 'need the hook, the outro and a line for every stretch id') }));

    const at = (c: [number, number] | null) => c ?? [20, 0];
    const fly = (c: [number, number] | null) =>
      `__takipMap.flyTo({ center: [${at(c)[1]}, ${at(c)[0]}], zoom: ${p.zoom}, duration: ${FLY_MS}, essential: true })`;
    const legs: Beat[] = facts.legs.map((l, i) => ({
      id: id(i),
      say: lines.lines[id(i)],
      enter: fly(l.centre),
      // a steady run through the stretch: events show in step with the counter
      frame: `__takipHistory.clock.seek(${yearMs(l.from)} + ${yearMs(years[i + 1]) - yearMs(l.from)} * p)`,
      minMs: LEG_MS,
    }));
    const [lat0, lon0] = at(facts.legs[0].centre);
    // History keeps an ended event drawn for three seconds of playback at the clock's speed
    const speed = ((p.to - p.from) * YEAR_S) / ((LEGS * LEG_MS) / 1000);

    return {
      id: `events-${ctx.args.preset}`,
      kind: 'story',
      path: `/?view=history&year=${p.from}&families=${p.families}&lat=${lat0}&lon=${lon0}&zoom=${p.zoom}`,
      chrome: 'map-only',
      ready: 'window.__takipHistory && !__takipHistory.deep()',
      waitOn: '/api/replay/',
      setup: `(() => { const c = __takipHistory.clock; c.pause(); c.setSpeed(${speed}); c.seek(${yearMs(p.from)}); __takipMap.jumpTo({ center: [${lon0}, ${lat0}], zoom: ${p.zoom} }); })()`,
      kicker: p.kicker,
      counter: { expr: 'new Date(__takipHistory.clock.time()).getUTCFullYear()', unit: '{n}', kind: 'year' },
      beats: [
        { id: 'hook', card: 'hook', say: lines.hook, minMs: 2600 },
        ...legs,
        { id: 'outro', card: 'end', say: lines.outro },
      ],
      sources: p.sources,
      post: {
        title: p.postTitle,
        description: `${p.postTitle}: ${facts.total.toLocaleString('en')} events on TAKIP's History map. ${p.coverage} Explore it yourself at takip.dev.`,
        hashtags: p.hashtags,
      },
    };
  },
};
