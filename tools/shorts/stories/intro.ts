/**
 * What TAKIP is, in one short: a shot per live layer (flights, ships, quakes, temperature, cameras), each flown to and
 * switched on alone, then a tap into History. The words come from those features' /map pages and today's quakes.
 */
import { LAYER_PAGES } from '../../../src/lib/platform/site/layer-pages';
import { askJson } from '../narrate/llm';
import type { Beat } from '../scene';
import type { Maker } from './context';
import { liveFacts } from './live-facts';

const FLY_MS = 2600;
const HISTORY = '[data-tab="history"]';
const HISTORY_SHUT = `document.querySelector('${HISTORY}').getAttribute('aria-pressed') === 'false'`;
const OPENING = { layers: ['satellites', 'flights'], view: { lat: 28, lon: 15, zoom: 1.5 } };
const SHOTS = [
  { id: 'flights', page: 'flight-tracker', layers: ['flights'], view: { lat: 50.6, lon: 1.5, zoom: 5.4 } },
  { id: 'ships', page: 'ship-tracker', layers: ['maritime'], view: { lat: 51.95, lon: 4.05, zoom: 9.5 } },
  { id: 'quakes', page: 'earthquakes', layers: ['earthquakes'], view: { lat: 12, lon: 150, zoom: 1.5 } },
  { id: 'weather', page: 'temperature-map', layers: ['wx_temperature'], view: { lat: 30, lon: 10, zoom: 2.2 } },
  // previews draw from zoom 13 (cctv-previews.tsx), once the flight has ended
  { id: 'cameras', page: 'live-cameras', layers: ['cctv', 'cctv_previews'], view: { lat: 51.5074, lon: -0.1278, zoom: 13.3 }, holdMs: 3500 },
] as const;
const PAST = { from: 1900, to: 2000, view: { lat: 48, lon: 18, zoom: 2.9 } };
const SWITCHED = [...new Set([...OPENING.layers, ...SHOTS.flatMap(s => s.layers)])];

const SYSTEM = `You write voiceover for a short vertical video that introduces TAKIP, a free live map of the world's public data.
The tone is a calm, curious narrator showing a friend something useful; never salesy, no hype words, no questions,
no exclamation marks. Use only the facts given. Reply with JSON only.`;

type Lines = { hook: string; past: string; outro: string; title: string } & Record<(typeof SHOTS)[number]['id'], string>;

const page = (slug: string) => {
  const p = LAYER_PAGES.find(x => x.slug === slug);
  if (!p) throw new Error(`no /map page ${slug}`);
  return p;
};

/** Page code that leaves only `on` of the layers this short switches. */
const only = (on: readonly string[]) =>
  `__takipLayers(prev => ({ ...prev, ${SWITCHED.map(k => `${k}: ${on.includes(k)}`).join(', ')} }))`;
const fly = (v: { lat: number; lon: number; zoom: number }) =>
  `__takipMap.flyTo({ center: [${v.lon}, ${v.lat}], zoom: ${v.zoom}, duration: ${FLY_MS}, essential: true })`;

export const intro: Maker = {
  id: 'intro',
  kind: 'tour',
  about: 'What TAKIP is: flights, ships, quakes, temperature and cameras live, then History',
  async make(ctx) {
    const pages = Object.fromEntries(SHOTS.map(s => [s.id, page(s.page)]));
    const history = page('history-map');
    const quakes = await ctx.once('live', () => liveFacts(ctx.base, pages.quakes, []));
    const about = (p: ReturnType<typeof page>) =>
      `${p.heading}. ${p.lede} ${p.shows.join(' ')} Sources: ${p.sources.map(s => s.name).join(', ')}. ${p.freshness}`;
    const lines = await ctx.once('lines', () => askJson<Lines>(SYSTEM,
      `The video flies to one feature after another, each shown alone on the map:\n` +
      SHOTS.map(s => `- "${s.id}": ${about(pages[s.id])}${s.id === 'quakes' && quakes.line ? `\n  Live right now: ${quakes.line}` : ''}`).join('\n') +
      `\n- "past": ${about(history)} The video runs its world borders from ${PAST.from} to ${PAST.to} over Europe.\n` +
      `\nTAKIP is free and runs in the browser at takip.dev. Write:\n` +
      `- "hook": at most 9 words, over a turning globe, saying what TAKIP is;\n` +
      SHOTS.map(s => `- "${s.id}": one sentence, at most 15 words, on what the map shows here${s.id === 'quakes' && quakes.line ? ', with the live numbers exactly as given' : ''};\n`).join('') +
      `- "past": one sentence, at most 15 words, on going back in time in History;\n` +
      `- "outro": at most 9 words, inviting people to open it themselves at takip.dev;\n` +
      `- "title": a post title of at most 70 characters naming TAKIP and what it is.\n` +
      `Return {"hook": "...", ${SHOTS.map(s => `"${s.id}": "..."`).join(', ')}, "past": "...", "outro": "...", "title": "..."}.`,
      { check: v => (['hook', ...SHOTS.map(s => s.id), 'past', 'outro', 'title'] as const).every(k => v[k]) ? null : 'every field is needed' }));

    const shots: Beat[] = SHOTS.map(s => ({
      id: s.id, say: lines[s.id], title: pages[s.id].heading, minMs: FLY_MS + ('holdMs' in s ? s.holdMs : 1800),
      enter: `(() => { ${only(s.layers)}; ${fly(s.view)}; })()`,
    }));
    const seek = `{ const h = window.__takipHistory; if (!h) return; h.clock.pause(); h.setLayer('world-borders', true); ` +
      `const k = Math.min(1, Math.max(0, (ms - 1500) / 5500)); const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2; ` +
      `const d = new Date(0); d.setUTCFullYear(Math.round(${PAST.from} + ${PAST.to - PAST.from} * e), 6, 1); h.clock.seek(d.getTime()); }`;

    return {
      id: 'intro',
      kind: 'tour',
      // every shot's layer opens on, so its data has loaded before filming; setup leaves the opening ones
      path: `/?lat=${OPENING.view.lat}&lon=${OPENING.view.lon}&zoom=${OPENING.view.zoom}&layers=day_night,sky_stars,${SWITCHED.join(',')}`,
      chrome: 'app',
      ready: '__shortsClock.inflight() === 0',
      setup: only(OPENING.layers),
      kicker: 'TAKIP',
      beats: [
        { id: 'hook', card: 'hook', say: lines.hook, minMs: 3000, frame: `__takipMap.jumpTo({ center: [${OPENING.view.lon} + ms / 400, ${OPENING.view.lat}] })` },
        ...shots,
        { id: 'past', say: lines.past, title: history.heading, minMs: 7500,
          enter: `(() => { ${only([])}; __takipMap.jumpTo({ center: [${PAST.view.lon}, ${PAST.view.lat}], zoom: ${PAST.view.zoom} }); })()`,
          // the second tap closes the sheet and leaves History running over the map
          taps: [{ at: 300, selector: HISTORY, expect: '!!window.__takipHistory' }, { at: 1200, selector: HISTORY, expect: HISTORY_SHUT }], frame: seek },
        { id: 'outro', card: 'end', say: lines.outro },
      ],
      sources: [...new Set([...SHOTS.flatMap(s => pages[s.id].sources.map(x => x.name)), ...history.sources.map(x => x.name), 'TAKIP'])],
      post: {
        title: lines.title,
        description: 'TAKIP is a free live map of the world\'s public data: flights, ships, satellites, public cameras, earthquakes and weather on one map. Replay what happened, or open the history atlas for borders and events across centuries. Open it at takip.dev.',
        hashtags: ['#TAKIP', '#Maps', '#FlightTracking', '#ShipTracking', '#Earthquake', '#History', '#OpenData'],
      },
    };
  },
};
