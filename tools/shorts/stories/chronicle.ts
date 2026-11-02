/**
 * A chronicle: dated stops on History's map. Each stop flies to its place while the clock runs from the last
 * stop's date to its own, so the borders change on the way. The words come from each stop's Wikipedia lead alone.
 */
import { wikiSummary } from '../../../src/lib/core/wikipedia/client';
import { backToStart, isLong, lengthProblem, saidAs, loopBeats, shortHold, shortPace, wordsFor } from '../loop';
import { askJson } from '../narrate/llm';
import { glibIn, STYLE } from '../narrate/style';
import type { Beat } from '../scene';
import type { Maker } from './context';
import { keepOutKinds } from './kept-out';
import { CHRONICLES, type Stop } from './presets/chronicles';

const FLY_MS = 2600;
/** How long a stop's title and date stay up after the camera lands, however short its line. */
const HOLD_MS = 1800;
/** The short's own pins, route and labels over History's layers; text-font must be one OpenFreeMap serves. */
const PINS = 'shorts-stops';
const ADD_PINS = `(() => { const m = __takipMap; if (m.getSource('${PINS}')) return; ` +
  `m.addSource('${PINS}', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } }); ` +
  `m.addLayer({ id: '${PINS}-route', type: 'line', source: '${PINS}', filter: ['==', ['geometry-type'], 'LineString'], ` +
  `paint: { 'line-color': '#52C1D6', 'line-width': 2.5, 'line-dasharray': [2, 1.5], 'line-opacity': 0.9 } }); ` +
  `m.addLayer({ id: '${PINS}-dots', type: 'circle', source: '${PINS}', filter: ['==', ['geometry-type'], 'Point'], ` +
  `paint: { 'circle-radius': 6, 'circle-color': '#52C1D6', 'circle-stroke-color': '#0A0C0F', 'circle-stroke-width': 2 } }); ` +
  `m.addLayer({ id: '${PINS}-labels', type: 'symbol', source: '${PINS}', filter: ['has', 'label'], ` +
  `layout: { 'text-field': ['get', 'label'], 'text-font': ['Noto Sans Bold'], 'text-size': 15, 'text-offset': [0, 1.1], 'text-anchor': 'top' }, ` +
  `paint: { 'text-color': '#ECEEF0', 'text-halo-color': '#0A0C0F', 'text-halo-width': 1.6 } }); })()`;
/** Stops told: short, as the user wants; a preset's own `short` list, else its first, middle and last. */
const SHORT = 3;
/** The hook opens this long before the first stop, so the first flight already has borders to change. */
const LEAD_DAYS = 120;
/** Wikimedia asks for a gentle rate. */
const WIKI_GAP_MS = 300;

const SYSTEM = `You write voiceover for short vertical history videos on a map.
Use only the facts in the article extracts you are given; never add dates, numbers, names or causes they don't state.
Tragedies stay plain: never say how many died or were killed, even where an extract does; tell what happened. ${STYLE}
Reply with JSON only.`;

/** Mass deaths told by a number or as "most" or "thousands" (a single named death, "he dies at 32", is history, not a toll). */
const MASS_DEATHS = /\b(deaths|dead|killed|killing|lives|victims|casualt\w*)\b/i;
const MANY = /\d{2,}(?!\d)|\b(most|thousands?|hundreds?|millions?)\b/i;
/** Why a chronicle line tells a toll, or null. */
export const chronicleToll = (lines: string[]) => {
  const line = lines.find(l => MASS_DEATHS.test(l) && MANY.test(l));
  return line ? `no death tolls, tragedies stay plain: "${line}"` : null;
};

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
    const long = isLong(ctx.args);
    const stops = long ? preset.stops : preset.short ? preset.stops.filter(s => preset.short!.includes(s.id))
      : preset.stops.length <= SHORT ? preset.stops : [0, Math.floor(preset.stops.length / 2), preset.stops.length - 1].map(i => preset.stops[i]);

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

    const holdMs = shortPace(ctx.args) ? shortHold(stops.length, FLY_MS + HOLD_MS) : FLY_MS + HOLD_MS;
    // a long cut's stops hold for the camera alone, so its lines carry the pace
    const words = shortPace(ctx.args) ? wordsFor(holdMs) : { lo: 11, hi: 15 };
    const lines = await ctx.once('lines', () => askJson<{ lines: Record<string, string> }>(SYSTEM,
      `The video is about ${preset.topic}. Overview (${facts.overview.title}): ${facts.overview.extract}\n\nStops, in order:\n` +
      stops.map(s => `[${s.id}] ${yearAsWritten(s.date)}${s.date.slice(-6)}, ${facts[s.id].title}: ${facts[s.id].extract}`).join('\n\n') +
      `\n\nWrite (the video is about ${long ? 50 : 22} seconds):\n` +
      `- "lines": for each stop, one or two sentences of ${saidAs(words)} with the most vivid detail of that stop from its own extract, so the stops ` +
      `together tell ${preset.topic}.\n` +
      `Return {"lines": {${stops.map(s => `"${s.id}": "..."`).join(', ')}}}.`,
      { check: v => (!stops.every(s => v.lines?.[s.id]?.trim()) ? 'need a line for every stop id' : chronicleToll(Object.values(v.lines)) ?? glibIn(Object.values(v.lines)) ?? lengthProblem(v.lines, words)) }));
    const { hook, outro } = await loopBeats(ctx, { topic: preset.topic, lines: stops.map(s => lines.lines[s.id]), ...(preset.grave ? { grave: true } : {}),
      check: e => chronicleToll([e.hook, e.outro]) });

    const start = dayMs(stops[0].date) - LEAD_DAYS * 86_400_000;
    // each stop is pinned and labelled, with the route so far, so a stop at sea or on ice still shows where it is
    const pinOf = (s: Stop) => s.pin ?? [s.at[0], s.at[1]];
    const pinsTo = (i: number) => JSON.stringify({ type: 'FeatureCollection', features: [
      ...stops.slice(1, i + 1).map((s, j) => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [pinOf(stops[j]), pinOf(s)].map(([la, lo]) => [lo, la]) } })),
      ...stops.slice(0, i + 1).map((s, j) => ({ type: 'Feature', properties: j === i ? { label: s.place ?? s.title } : {}, geometry: { type: 'Point', coordinates: [pinOf(s)[1], pinOf(s)[0]] } })),
    ] });
    const showPins = (i: number) => `(() => { const m = __takipMap; m.getSource('${PINS}')?.setData(${pinsTo(i)}); ` +
      `['${PINS}-route', '${PINS}-dots', '${PINS}-labels'].forEach(l => m.getLayer(l) && m.moveLayer(l)); })()`;
    const beats: Beat[] = stops.map((s, i) => {
      const from = i ? dayMs(stops[i - 1].date) : start;
      const [lat, lon, zoom] = s.at;
      return {
        id: s.id,
        say: lines.lines[s.id],
        title: s.title,
        // the title and the date wait for the clock and the camera to reach this stop: a date still running
        // from the last one would sit under this stop's words
        titleAt: { ms: FLY_MS },
        counterWithTitle: true,
        enter: `(() => { __takipHistory.setLayer('${s.layer}', true); __takipMap.flyTo({ center: [${lon}, ${lat}], zoom: ${zoom}, duration: ${FLY_MS}, essential: true }); ${showPins(i)}; })()`,
        // the clock eases from the last stop's date to this one while the camera flies
        frame: `{ const k = Math.min(1, ms / ${FLY_MS}); const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2; __takipHistory.clock.seek(${from} + ${dayMs(s.date) - from} * e); }`,
        minMs: holdMs,
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
      // the default conflict events would include massacres, which no short draws
      setup: `(() => { const h = __takipHistory; h.clock.pause(); h.setLayer('${stops[0].layer}', true); h.clock.seek(${start}); ${keepOutKinds()} __takipMap.jumpTo({ center: [${lon0}, ${lat0}], zoom: ${zoom0} }); ${ADD_PINS}; })()`,
      kicker: preset.kicker,
      // a day shown for a stop known only by its year would be a precision the sources don't have
      counter: stops.some(s => s.approx)
        ? { expr: 'new Date(__takipHistory.clock.time()).getUTCFullYear()', unit: '{n}', kind: 'year' }
        : { expr: '__takipHistory.clock.time()', unit: '{n}', kind: 'date' },
      // the clock sits before the first stop on the hook and outro, at a date that belongs to no event (Feb 1948 before
      // the Berlin Blockade, the day of the Czechoslovak coup), so the counter waits for the first stop
      beats: [
        { ...hook, counterWithTitle: true },
        ...beats,
        // back to the first stop's layer, the opening date and view, so the loop's last frame meets its first
        { ...outro, counterWithTitle: true, enter: backToStart(`(() => { const h = __takipHistory; h.setLayer('${stops[0].layer}', true); h.clock.seek(${start}); __takipMap.getSource('${PINS}')?.setData({ type: 'FeatureCollection', features: [] }); })()`) },
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
