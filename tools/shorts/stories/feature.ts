/**
 * A tour of one feature, filmed in the phone interface: the feature as its /map/<slug> page opens it, a tap on
 * Layers to show where it lives, then a flight to each of the page's spots. The words come from that page alone,
 * which already says what the layer shows, where its data comes from and how fresh it is.
 */
import { LAYER_PAGES, openPath } from '../../../src/lib/platform/site/layer-pages';
import { askJson } from '../narrate/llm';
import type { Beat } from '../scene';
import type { Maker } from './context';
import { liveFacts } from './live-facts';

const MAX_SPOTS = 3;
const SECTION_TAGS: Record<string, string[]> = {
  air: ['#Aviation', '#FlightTracking'], sea: ['#Shipping', '#Maritime'], space: ['#Space', '#Satellites'],
  weather: ['#Weather', '#Storm'], hazards: ['#NaturalDisasters', '#Earthquake'], cameras: ['#LiveCam', '#Webcam'],
  ground: ['#Transit', '#Travel'], world: ['#WorldNews', '#Geopolitics'], network: ['#CyberSecurity', '#Internet'],
  past: ['#History', '#HistoryMaps'], tools: ['#OSINT', '#GIS'],
};
const FLY_MS = 2600;
const LAYERS = '[data-tab="layers"]';

const SYSTEM = `You write voiceover for short vertical videos that show one feature of TAKIP, a free live map of public data.
The tone is a calm, curious narrator showing a friend something useful; never salesy, no hype words, no questions,
no exclamation marks. Use only the facts given. Reply with JSON only.`;

type Lines = { hook: string; shows: string; now?: string; title?: string; spots: Record<string, string>; sources: string; outro: string };

export const feature: Maker = {
  id: 'feature',
  kind: 'tour',
  about: 'A tour of one feature from its /map page (--page earthquakes); --fact, --at lat,lon,zoom and --label lead with a situation',
  async make(ctx) {
    const page = LAYER_PAGES.find(p => p.slug === ctx.args.page);
    if (!page) throw new Error(`--page must be one of: ${LAYER_PAGES.map(p => p.slug).join(', ')}`);
    const { fact, label } = ctx.args;
    const [lat, lon, zoom = 5.5] = ctx.args.at?.split(',').map(Number) ?? [];
    const focus = Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon, zoom } : null;
    const candidates = page.mode ? [] : (page.spots ?? []);
    const live = await ctx.once('live', () => liveFacts(ctx.base, page, candidates));
    // a live page flies only where its feed has something to say today
    const telling = page.live ? candidates.filter(s => live.spots[s.label]) : candidates;
    const spots = (telling.length ? telling : candidates).slice(0, fact ? 1 : MAX_SPOTS);
    const note = (label: string, n?: string) => [n, live.spots[label]].filter(Boolean).join('; ');
    const lines = await ctx.once('lines', () => askJson<Lines>(SYSTEM,
      `The feature: ${page.heading}. ${page.lede}\nWhat you see: ${page.shows.join(' ')}\n` +
      `Sources: ${page.sources.map(s => `${s.name}: ${s.detail}`).join(' ')}\nFreshness: ${page.freshness}\n` +
      (live.line ? `Live right now: ${live.line}\n` : '') +
      (spots.length ? `Places the video flies to:\n${spots.map(s => `- ${s.label}${note(s.label, s.note) ? `: ${note(s.label, s.note)}` : ''}`).join('\n')}\n` : '') +
      (fact ? `Today's situation, which the video leads with: ${fact}\n` : '') +
      `\nWrite:\n- "hook": at most 10 words, opens the video and makes people stay${fact ? '; it is about today\'s situation' : ''};\n` +
      (fact ? `- "now": one or two sentences, at most 24 words, telling today's situation with its numbers exactly as given;\n` +
        `- "title": a post title of at most 70 characters about today's situation;\n` : '') +
      `- "shows": one or two sentences, at most 26 words, on what the map shows here${live.line ? ', with the live numbers' : ''};\n` +
      `- "spots": for each place, one sentence of at most 18 words naming it, with its live numbers where given;\n` +
      `- "sources": one sentence, at most 20 words, on where the data comes from and how fresh it is;\n` +
      `- "outro": at most 10 words, inviting people to open it themselves on TAKIP.\n` +
      `Return {"hook": "...", "shows": "...", ${fact ? '"now": "...", "title": "...", ' : ''}"spots": {${spots.map(s => `"${s.label}": "..."`).join(', ')}}, "sources": "...", "outro": "..."}.`,
      { check: v => (v.hook && v.shows && v.sources && v.outro && (!fact || (v.now && v.title)) && spots.every(s => v.spots?.[s.label]) ? null : 'every field and every place is needed') }));

    const fly = (v: { lat: number; lon: number; zoom: number }) =>
      `__takipMap.flyTo({ center: [${v.lon}, ${v.lat}], zoom: ${v.zoom}, duration: ${FLY_MS}, essential: true })`;
    const spotBeats: Beat[] = spots.map((s, i) => ({ id: `spot-${i + 1}`, say: lines.spots[s.label], title: s.label, enter: fly(s.view), minMs: FLY_MS + 1500 }));

    return {
      id: `feature-${page.slug}`,
      kind: 'tour',
      path: openPath(page, page.view),
      chrome: 'app',
      kicker: page.heading,
      beats: [
        { id: 'hook', card: 'hook', say: lines.hook, minMs: 2500 },
        ...(fact && lines.now ? [{ id: 'now', say: lines.now, ...(label ? { title: label } : {}), ...(focus ? { enter: fly(focus), minMs: FLY_MS + 1500 } : {}) }] : []),
        // Layers opens on the feature's own switch, then closes again
        { id: 'shows', say: lines.shows, minMs: 5200, taps: [
          { at: 500, selector: LAYERS, expect: `document.querySelector('${LAYERS}').getAttribute('aria-pressed') === 'true'` },
          { at: 3800, selector: LAYERS, expect: `document.querySelector('${LAYERS}').getAttribute('aria-pressed') === 'false'` },
        ] },
        ...spotBeats,
        { id: 'sources', say: lines.sources, ...(page.view && spots.length ? { enter: fly(page.view), minMs: FLY_MS + 800 } : {}) },
        { id: 'outro', card: 'end', say: lines.outro },
      ],
      sources: [...page.sources.map(s => s.name), 'TAKIP'],
      post: {
        title: lines.title ?? page.title,
        description: `${page.description} Live at takip.dev/map/${page.slug}`,
        hashtags: ['#TAKIP', '#Maps', ...(SECTION_TAGS[page.section] ?? []), '#OpenData'],
      },
    };
  },
};
