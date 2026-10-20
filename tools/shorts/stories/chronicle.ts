/**
 * A chronicle: dated stops on History's map. Each stop flies to its place while the clock runs from the last
 * stop's date to its own, so the borders change on the way. The words come from each stop's Wikipedia lead alone.
 */
import { wikiSummary } from '../../../src/lib/core/wikipedia/client';
import { askJson } from '../narrate/llm';
import type { Beat } from '../scene';
import type { Maker } from './context';
import { CHRONICLES } from './presets/chronicles';

const FLY_MS = 3200;
const HOLD_MS = 1200;
/** The hook opens this long before the first stop, so the first flight already has borders to change. */
const LEAD_DAYS = 120;
/** Wikimedia asks for a gentle rate. */
const WIKI_GAP_MS = 300;

const SYSTEM = `You write voiceover for short vertical history videos on a map, read by a calm documentary narrator.
Use only the facts in the article extracts you are given; never add dates, numbers, names or causes they don't state.
Short, vivid sentences; no questions, no exclamation marks. Reply with JSON only.`;

/** Noon UTC on a YYYY-MM-DD date with an astronomical year (-48 is 49 BCE). */
export function dayMs(date: string) {
  const [, y, m, d] = date.match(/^(-?\d+)-(\d\d)-(\d\d)$/) ?? [];
  if (!y) throw new Error(`bad date ${date}`);
  const t = new Date(0);
  t.setUTCFullYear(Number(y), Number(m) - 1, Number(d));
  t.setUTCHours(12);
  return t.getTime();
}

/** How an article writes the year: "1914", or "49 BC" for astronomical -48. */
export const yearAsWritten = (date: string) => {
  const y = Number(date.match(/^(-?\d+)/)![1]);
  return y > 0 ? String(y) : `${1 - y} BC`;
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const chronicle: Maker = {
  id: 'chronicle',
  kind: 'story',
  presets: Object.keys(CHRONICLES),
  about: `Dated stops on History's map, told from Wikipedia (--preset ${Object.keys(CHRONICLES).join('|')})`,
  async make(ctx) {
    const preset = CHRONICLES[ctx.args.preset ?? ''];
    if (!preset) throw new Error(`--preset must be one of ${Object.keys(CHRONICLES).join(', ')}`);
    const { stops } = preset;

    const facts = await ctx.once('facts', async () => {
      const out: Record<string, { title: string; extract: string; url: string; dateChecked?: boolean }> = {};
      for (const [id, title] of [['overview', preset.overview], ...stops.map(s => [s.id, s.wiki])]) {
        const s = await wikiSummary(title);
        if (!s?.extract) throw new Error(`no Wikipedia summary for "${title}"`);
        out[id] = { title: s.title, extract: s.extract, url: s.url };
        await sleep(WIKI_GAP_MS);
      }
      // a stop's date is ours; its article should say the same year, or the date needs a second look
      for (const s of stops) {
        out[s.id].dateChecked = out[s.id].extract.replace(/\s+/g, ' ').includes(yearAsWritten(s.date).replace(/^(\d+) BC$/, '$1'));
        if (!out[s.id].dateChecked) console.warn(`  ! ${s.id}: the lead of "${s.wiki}" doesn't mention ${yearAsWritten(s.date)}; check ${s.date}`);
      }
      return out;
    });

    const lines = await ctx.once('lines', () => askJson<{ hook: string; lines: Record<string, string>; outro: string }>(SYSTEM,
      `The video is about ${preset.topic}. Overview (${facts.overview.title}): ${facts.overview.extract}\n\nStops, in order:\n` +
      stops.map(s => `[${s.id}] ${yearAsWritten(s.date)}${s.date.slice(-6)}, ${facts[s.id].title}: ${facts[s.id].extract}`).join('\n\n') +
      `\n\nWrite:\n- "hook": at most 10 words that open the video and make people stay;\n` +
      `- "lines": for each stop, one sentence of at most 16 words telling that stop from its own extract, so the stops ` +
      `together tell ${preset.topic};\n- "outro": at most 12 words inviting people to scrub through history themselves on TAKIP.\n` +
      `Return {"hook": "...", "lines": {${stops.map(s => `"${s.id}": "..."`).join(', ')}}, "outro": "..."}.`,
      { check: v => (v.hook && v.outro && stops.every(s => v.lines?.[s.id]?.trim()) ? null : 'need the hook, the outro and a line for every stop id') }));

    const start = dayMs(stops[0].date) - LEAD_DAYS * 86_400_000;
    const beats: Beat[] = stops.map((s, i) => {
      const from = i ? dayMs(stops[i - 1].date) : start;
      const [lat, lon, zoom] = s.at;
      return {
        id: s.id,
        say: lines.lines[s.id],
        title: s.title,
        enter: `(() => { __takipHistory.setLayer('${s.layer}', true); __takipMap.flyTo({ center: [${lon}, ${lat}], zoom: ${zoom}, duration: ${FLY_MS}, essential: true }); })()`,
        // the clock eases from the last stop's date to this one while the camera flies
        frame: `{ const k = Math.min(1, ms / ${FLY_MS}); const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2; __takipHistory.clock.seek(${from} + ${dayMs(s.date) - from} * e); }`,
        minMs: FLY_MS + HOLD_MS,
      };
    });
    const [lat0, lon0, zoom0] = stops[0].at;
    const first = new Date(start).getUTCFullYear();
    const span = (s: string) => yearAsWritten(s).replace(/ BC$/, ' BCE');

    return {
      id: `chronicle-${ctx.args.preset}`,
      kind: 'story',
      path: `/?view=history&year=${Math.max(-3000, first)}&layer=${stops[0].layer}&lat=${lat0}&lon=${lon0}&zoom=${zoom0}`,
      chrome: 'map-only',
      ready: 'window.__takipHistory && !__takipHistory.deep()',
      waitOn: '/api/replay/',
      setup: `(() => { const h = __takipHistory; h.clock.pause(); h.setLayer('${stops[0].layer}', true); h.clock.seek(${start}); __takipMap.jumpTo({ center: [${lon0}, ${lat0}], zoom: ${zoom0} }); })()`,
      kicker: preset.kicker,
      // a day shown for a stop known only by its year would be a precision the sources don't have
      counter: stops.some(s => s.approx)
        ? { expr: 'new Date(__takipHistory.clock.time()).getUTCFullYear()', unit: '{n}', kind: 'year' }
        : { expr: '__takipHistory.clock.time()', unit: '{n}', kind: 'date' },
      beats: [
        { id: 'hook', card: 'hook', say: lines.hook, minMs: 2600 },
        ...beats,
        { id: 'outro', card: 'end', say: lines.outro },
      ],
      sources: preset.sources,
      post: {
        title: preset.postTitle,
        description: `${preset.postTitle}, stop by stop on TAKIP's History map, from ${span(stops[0].date)} to ${span(stops[stops.length - 1].date)}. ` +
          `Sources: ${stops.map(s => facts[s.id].url).join(' ')}`,
        hashtags: preset.hashtags,
      },
    };
  },
};
