/**
 * A tour of one feature, filmed in the phone interface: the feature as its /map/<slug> page opens it, a tap on
 * Layers to show where it lives, then a flight to each of the page's spots. A space page flies out from the Earth
 * through the space view's stops instead. The words come from that page alone; its sources are credited on screen,
 * not read out.
 */
import type { LayerPage, Spot } from '../../../src/lib/platform/site/catalog/types';
import { LAYER_PAGES, openPath } from '../../../src/lib/platform/site/layer-pages';
import { BASE_LAYERS, mapHref } from '../../../src/lib/platform/site/map-link';
import type { SpaceFocus } from '../../../src/lib/space/worlds';
import { askJson } from '../narrate/llm';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { backToStart, closeCards, isLong, lengthProblem, saidAs, loopBeats, shortPace, wordsFor } from '../loop';
import { glibIn, STYLE, tollIn } from '../narrate/style';
import type { Beat } from '../scene';
import type { Maker } from './context';
import { historyTour } from './history-tour';
import { liveFacts, recount, roundCount } from './live-facts';
import { retold } from '../narrate/numbers';
import { TRAIL_ZOOM, trailSpots, type TrailSpot } from './trails';

const MAX_SPOTS = 3;
/** A long tour's places, filled from the day's busiest views where the page has too few. */
const LONG_SPOTS = 4;
/** Layers whose item opens a sheet card over the lower half of a phone, rather than a popup by the item. */
const SHEETS = new Set(['flights', 'private', 'jets', 'military', 'maritime', 'cctv']);
/** The ride's own close view on a followed object, which the hook shows and the loop comes back to. */
const RIDE_BACK = { zoom: 5.5, pitch: 60 };
/** A plane worth a card is flying: `alt` is in metres, so about 1,000 ft, and parked or taxiing planes fail the speed. */
const AIRBORNE = 'Number(p.alt) > 300 && Number(p.speed_knots) > 60';
/**
 * The item a spot opens, so the details are on screen (the user, 2026-10-21: "show details"): the app's own card or
 * popup, opened through its click handler. `max` picks the biggest by a property, otherwise the one nearest the middle.
 */
const PICKS: Record<string, { layers: string[]; max?: string; recent?: boolean; when?: string; line?: boolean }> = {
  earthquakes: { layers: ['eq-circles'], max: 'magnitude', recent: true },
  flights: { layers: ['fl-commercial'], when: AIRBORNE }, private: { layers: ['fl-private'], when: AIRBORNE },
  jets: { layers: ['fl-jets'], when: AIRBORNE }, military: { layers: ['fl-military'], when: AIRBORNE },
  // moored ships have nowhere to be going
  maritime: { layers: ['ship-dots'], when: 'Number(p.speed) > 2' },
  fires: { layers: ['fires-heat'], max: 'frp' },
  cctv: { layers: ['cctv-dots'] },
  launches: { layers: ['launch-dots'] },
  // a cable is a line: its card opens at its point nearest the middle
  sdk_sea: { layers: ['sdk-sea'], line: true },
};
/** Spots a tour visits where its page names none: undersea cables bunch at their landings (takip-98, 2026-10-21). */
const TOUR_SPOTS: Record<string, Spot[]> = {
  'undersea-cables': [
    { label: 'Marseille', view: { lat: 42.6, lon: 5.6, zoom: 5 } }, { label: 'The Red Sea', view: { lat: 23, lon: 38, zoom: 4.2 } },
    { label: 'Singapore', view: { lat: 2, lon: 104.5, zoom: 5 } }, { label: 'Cornwall', view: { lat: 49.6, lon: -6.2, zoom: 5.8 } },
  ],
};
/**
 * Film-only restyling where a page's own drawing doesn't read on a phone: the cables are drawn thin and translucent under
 * everything, so they come up bright and thicker, and the conflict icons that sit over them go.
 */
const TOUR_SETUP: Record<string, string> = {
  'undersea-cables': `(() => { const m = __takipMap; if (m.getLayer('conflict-icons')) m.setLayoutProperty('conflict-icons', 'visibility', 'none'); ` +
    `m.setPaintProperty('sdk-sea', 'line-color', '#52C1D6'); m.setPaintProperty('sdk-sea', 'line-opacity', 0.85); ` +
    `m.setPaintProperty('sdk-sea', 'line-width', ['interpolate', ['linear'], ['zoom'], 1, 1.2, 5, 2.2, 10, 3.2]); })()`,
};
/** Layers whose spots are framed wider than their page's views, so the counted items sit in view with context. */
const WIDER: Record<string, number> = { earthquakes: 1, private: 1.5, jets: 1.5 };

/** Page code that opens the card of the best item of a page's layers in view, as a tap on it would; never one opened before. */
function pickScript(page: LayerPage) {
  const rules = page.layers.flatMap(l => PICKS[l] ?? []);
  if (!rules.length) return null;
  const layers = rules.flatMap(r => r.layers);
  const { max, recent, when, line } = rules[0];
  return `(() => { const m = __takipMap, c = m.project(m.getCenter()), seen = (window.__pickedItems ??= new Set()); ` +
    `const key = f => f.properties.icao24 ?? f.properties.mmsi ?? f.properties.id ?? f.properties.fromName ?? JSON.stringify(f.geometry.coordinates).slice(0, 80); ` +
    // a line's point is its vertex nearest the middle
    `const at = f => f.geometry.type === 'Point' ? f.geometry.coordinates : f.geometry.coordinates.flat(f.geometry.type === 'MultiLineString' ? 1 : 0)` +
    `.reduce((b, q) => { const p = m.project(q), d = (p.x - c.x) ** 2 + (p.y - c.y) ** 2; return d < b.d ? { q, d } : b; }, { q: null, d: Infinity }).q; ` +
    `const fs = m.queryRenderedFeatures({ layers: ${JSON.stringify(layers)}.filter(l => m.getLayer(l)) })` +
    `.filter(f => { const p = f.properties; return (f.geometry.type === 'Point'${line ? " || /LineString/.test(f.geometry.type)" : ''}) && !seen.has(key(f))` +
    `${recent ? ' && (!p.time || Number(p.time) >= Date.now() - 864e5)' : ''}${when ? ` && ${when}` : ''}; }); ` +
    `const d = f => { const p = m.project(at(f)); return (p.x - c.x) ** 2 + (p.y - c.y) ** 2; }; ` +
    // a tap takes the topmost item under it, so one drawn over another (a parked plane at its gate) would open instead;
    // the strongest quake stays the pick though circles overlap
    `const alone = f => { const q = m.project(at(f)); return m.queryRenderedFeatures([[q.x - 8, q.y - 8], [q.x + 8, q.y + 8]], { layers: ${JSON.stringify(layers)}.filter(l => m.getLayer(l)) }).every(h => key(h) === key(f)); }; ` +
    // cables bunch, so a line takes the nearest whichever lies over it
    `const best = fs.sort((a, b) => ${max ? `Number(b.properties.${max} ?? 0) - Number(a.properties.${max} ?? 0) ||` : ''} d(a) - d(b))${max || line ? '[0]' : '.find(alone)'}; ` +
    `if (!best) return; seen.add(key(best)); const p = m.project(at(best)); ` +
    `m.fire('click', { point: p, lngLat: m.unproject(p), originalEvent: new MouseEvent('click') }); })()`;
}
/** A beat's frame that opens the item once, `at` ms into the beat (after the camera has landed). */
const pickOnce = (script: string, key: string, at = FLY_MS + 300) =>
  `{ if (ms >= ${at} && !window.__picked?.['${key}']) { (window.__picked ??= {})['${key}'] = 1; ${script}; } }`;
/** How long a long cut's spot shows each of its two cards; a short cut from the long's spots shows one. */
const CARD_MS = 3200;
/** A short tour's one detail runs about this long, so the loop runs 20–25 s: its line is written to fill it. */
const DETAIL_MS = 13_000;
const WOW_WORDS = { lo: 18, hi: 26 };

/** Pages whose numbers don't hold (submarine-cables.json counts route segments, not cables): no number is said. */
const NO_NUMBERS = new Set(['undersea-cables']);

/** What a counted layer's points are, for the writer: "about 70 aircraft in view". */
const NOUNS: Record<string, string> = {
  maritime: 'ships', fires: 'fire hotspots', cctv: 'cameras', flights: 'aircraft', private: 'aircraft', jets: 'aircraft', military: 'aircraft',
};
/** A spot whose view holds fewer of the layer's points than this is left out: the feed doesn't reach it today. */
const MIN_IN_VIEW = 10;
const SECTION_TAGS: Record<string, string[]> = {
  air: ['#Aviation', '#FlightTracking'], sea: ['#Shipping', '#Maritime'], space: ['#Space', '#Satellites'],
  weather: ['#Weather', '#Storm'], hazards: ['#NaturalDisasters', '#Earthquake'], cameras: ['#LiveCam', '#Webcam'],
  ground: ['#Transit', '#Travel'], world: ['#WorldNews', '#Geopolitics'], network: ['#CyberSecurity', '#Internet'],
  past: ['#History', '#HistoryMaps'], tools: ['#OSINT', '#GIS'],
};
const FLY_MS = 2600;
/** How long a space-view stop holds: the camera's flight between worlds, then a look. */
const STOP_MS = 5500;

/** The space view's stops, out from the Earth. */
const OUTWARD: SpaceFocus[] = ['earth', 'moon', 'mars', 'sun', 'solar', 'stars', 'galaxy', 'universe'];
const STOP_NAMES: Record<SpaceFocus, string> = {
  earth: 'The Earth from space', moon: 'The Moon', mars: 'Mars', sun: 'The Sun', solar: 'The solar system',
  stars: 'The nearby stars', galaxy: 'The Milky Way', universe: 'The universe',
};
/** A page that follows one object (the ISS) keeps following it: its stops only change zoom and tilt, so the object and its card stay. */
const FOLLOW_STOPS = [{ label: 'Its whole orbit', zoom: 1.6, pitch: 0 }, { label: 'Riding along', zoom: 3.6, pitch: 45 }];
/** The follow re-centres the map every frame, which stops any camera animation, so zoom and tilt are stepped by frame. */
const followTo = ({ zoom, pitch }: { zoom: number; pitch: number }) => ({
  enter: `window.__followFrom = { zoom: __takipMap.getZoom(), pitch: __takipMap.getPitch() }`,
  frame: `{ const f = window.__followFrom, k = Math.min(1, ms / ${FLY_MS}), e = k * k * (3 - 2 * k); ` +
    `__takipMap.jumpTo({ zoom: f.zoom + (${zoom} - f.zoom) * e, pitch: f.pitch + (${pitch} - f.pitch) * e }); }`,
});
/** Live numbers go out hours or days after filming. */
const CLOCK = /\b\d{1,2}:\d{2}\b|\bUTC\b|\bGMT\b/;

/** Pages about the sky draw it around the map's globe, too faint to see on a phone; they open in the space view instead. */
const SKY: Record<string, SpaceFocus[]> = { 'night-sky': ['solar', 'stars'] };
/** What a space stop shows beyond its name, so a line can match the screen: the solar view labels spacecraft as much as planets. */
const STOP_FACTS: Partial<Record<SpaceFocus, string>> = {
  solar: 'the planets where they are now, with spacecraft labelled among them, from Ulysses and Kepler to a Tesla Roadster',
  stars: 'the nearby stars, named, with the Sun among them',
  galaxy: 'the Milky Way seen from outside, an artist\'s illustration labelled so, with the neighbouring galaxies',
  universe: 'tens of thousands of galaxies from the 2MASS and SDSS surveys, out to the cosmic microwave background mapped by WMAP',
};

/** The space-view stops a page's tour flies through: the Earth, the solar system on the way past it, the page's own. */
export function journeyOf(page: LayerPage, long = false): SpaceFocus[] {
  if (SKY[page.slug]) return long ? [...SKY[page.slug], 'galaxy'] : SKY[page.slug];
  if (page.mode?.view !== 'space') return [];
  const focus = page.mode.focus;
  // a long cut needs more than one stop: past the page's own, on to the next views out, or the other bodies after its own
  if (long && focus === 'solar') return ['sun', 'solar', 'stars'];
  if (long && (focus === 'moon' || focus === 'mars' || focus === 'sun')) return ['solar', focus, ...(['moon', 'mars', 'sun'] as const).filter(f => f !== focus)];
  // the Earth from space can face its night side, a black screen with a faint crescent for the whole hook: a tour opens
  // on the solar system, always lit, and a page past it flies through every view to the edge, as its words promise
  if (focus === 'earth') return ['earth'];
  if (focus === 'solar') return ['sun', 'solar'];
  return OUTWARD.indexOf(focus) > OUTWARD.indexOf('solar') ? ['solar', ...OUTWARD.slice(OUTWARD.indexOf(focus))] : ['solar', focus];
}

/** A link names every layer it wants, or the map opens with whatever the browser had (the filming profile's defaults). */
export const withLayers = (path: string) => (/[?&]layers=/.test(path) ? path : `${path}${path.includes('?') ? '&' : '?'}layers=${BASE_LAYERS.join(',')}`);

const SYSTEM = `You write voiceover for short vertical videos, about 30 seconds, that show one feature of TAKIP, a free live
map of the world's public data. ${STYLE}
At most one quick action in the whole script, such as "tap any plane to follow it". Never salesy. Never say a clock time or
a date, since the video goes out hours or days later, and round live numbers ("about 420 km up", "close to 8 km a second").
A count in view is all you know about those things: never say what they are doing (circling, landing, waiting, docked, heading
somewhere) unless the facts say it. Tragedies stay plain: never say how many died, were killed or were hurt, even where a fact
does. Each place's line says one striking thing about that place from its facts; never talk about
the camera, the page, the card or what comes next ("lands on", "next", "another one").
Reply with JSON only.`;

/** Lines about the video instead of the place: filler a viewer learns nothing from (takip-98, 2026-10-21). */
export const FILLER = /\b(camera|lands? on|next|another (site|stop|one|place)|its page|page open|card open|on screen|flies? (to|in)|zooms? (in|out|to))\b/i;

type Lines = { detail: string; now?: string; title?: string; place?: string };

export const feature: Maker = {
  id: 'feature',
  kind: 'tour',
  about: 'A tour of one feature from its /map page (--page earthquakes); --fact, --at lat,lon,zoom and --label lead with a situation; --angle "…" (with --name) leads with a theme and picks the spots that fit it',
  async make(ctx) {
    const page = LAYER_PAGES.find(p => p.slug === ctx.args.page);
    if (!page) throw new Error(`--page must be one of: ${LAYER_PAGES.map(p => p.slug).join(', ')}`);
    const { fact, label } = ctx.args;
    const [lat, lon, zoom = 5.5] = ctx.args.at?.split(',').map(Number) ?? [];
    const focus = Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon, zoom } : null;
    const wider = page.layers.reduce((z, l) => Math.max(z, WIDER[l] ?? 0), 0);
    const candidates = page.mode ? [] : (page.spots ?? TOUR_SPOTS[page.slug] ?? []).map(s => ({ ...s, view: { ...s.view, zoom: s.view.zoom - wider } }));
    const pick = pickScript(page);
    const past = await historyTour(page, ctx, isLong(ctx.args));
    // the trails are a raster with nothing to count: the tour pans along famous ones and opens their cards
    const trails = page.layers.includes('hiking_routes') ? await ctx.once('trails', trailSpots) : null;
    const unnumbered = NO_NUMBERS.has(page.slug);
    const shows = (unnumbered ? page.shows.filter(l => !/\d/.test(l)) : page.shows).join(' ');
    const numbered = (ls: (string | undefined)[]) => unnumbered && ls.some(l => l && /\d/.test(l)) ? 'no numbers at all: this page\'s counts and lengths are not reliable' : null;
    const live = await ctx.once('live', () => liveFacts(ctx.base, page, candidates, { busiest: isLong(ctx.args) ? LONG_SPOTS : 0 }));
    // a live tour filmed without its facts would tell nothing true about today; failing lets the queue try again later
    if (live.failed) {
      rmSync(join(ctx.dir, 'cache.live.json'), { force: true });
      throw new Error(`${page.slug}: its live feed didn't answer`);
    }
    // the queue re-films at any hour, so the counts its lines say are retold as of this filming
    const counted0 = live.inView && Object.keys(live.inView).length ? live.inView : null;
    const fresh = counted0 ? await recount(ctx.base, page, [...candidates, ...(live.busiest ?? [])].filter(s => s.label in counted0)) : undefined;
    if (counted0 && !fresh) throw new Error(`${page.slug}: its feed didn't answer, so its counts can't be told as of now`);
    const retell = (line: string, label?: string): { say: string; spoken?: string } => {
      const was = label !== undefined ? counted0?.[label] : undefined, now = label !== undefined ? fresh?.[label] : undefined;
      if (was === undefined || now === undefined || roundCount(was) === roundCount(now)) return { say: line };
      if (now < MIN_IN_VIEW) throw new Error(`${page.slug}: ${label} holds ${now} now (${was} when its lines were written); film it nearer that hour`);
      const told = retold(line, roundCount(was), roundCount(now));
      if (!told) console.warn(`  ! ${label}: its line doesn't say ${roundCount(was)}, so it keeps its wording: "${line}"`);
      return told ?? { say: line };
    };
    // a live page flies only where its feed has something to say today, a counted layer only where it has points
    const telling = candidates.filter(s => (!page.live || live.spots[s.label]) && (live.inView?.[s.label] ?? MIN_IN_VIEW) >= MIN_IN_VIEW);
    // with nothing worth counting it stays on the page's own view rather than fly to empty ones
    const journey = journeyOf(page, isLong(ctx.args));
    // a space page opens on its first stop; a sky page opens on the map and leaves it for the first
    const startsInSpace = page.mode?.view === 'space' || !!SKY[page.slug];
    const stops = journey.slice(startsInSpace ? 1 : 0);
    const angle = ctx.args.angle?.trim();
    const offered = telling.length || live.inView ? telling : candidates;
    // with an angle the writer picks the places that fit it, from those the day's feed backs
    const picking = !!angle && !journey.length && !page.track && !fact && offered.length > 0;
    const spots = journey.length ? stops.map(f => ({ label: STOP_NAMES[f], note: STOP_FACTS[f], focus: f }))
      : page.track ? FOLLOW_STOPS.map(f => ({ ...f, note: undefined }))
        : picking ? offered : offered.slice(0, fact ? 1 : MAX_SPOTS);
    const counted = live.inView && NOUNS[page.layers.find(l => NOUNS[l]) ?? ''];
    const inView = (label: string) => {
      const n = live.inView?.[label];
      return counted && n !== undefined ? `about ${n < 20 ? n : Math.round(n / 10) * 10} ${counted} in view` : undefined;
    };
    const note = (label: string, n?: string) => [n, live.spots[label], inView(label)].filter(Boolean).join('; ');
    const fly = (v: { lat: number; lon: number; zoom: number }) =>
      `__takipMap.flyTo({ center: [${v.lon}, ${v.lat}], zoom: ${v.zoom}, duration: ${FLY_MS}, essential: true })`;
    // a card left open from the last spot would sit over this one
    const flyOn = (v: { lat: number; lon: number; zoom: number }) => `(() => { ${closeCards}; ${fly(v)}; })()`;
    const world = (f: SpaceFocus) => `window.dispatchEvent(new CustomEvent('takip:world', { detail: { focus: '${f}' } }))`;
    // a globe with nowhere to fly turns slowly, so the picture isn't a still
    const spin = !spots.length && page.view && page.view.zoom <= 2
      ? `{ window.__spinFrom ??= performance.now(); __takipMap.jumpTo({ center: [${page.view.lon} + (performance.now() - window.__spinFrom) / 400, ${page.view.lat}] }); }`
      : undefined;
    const sheet = page.layers.some(l => SHEETS.has(l));
    // one detail on screen, told: today's strongest quake, the page's own stop in space, the whole orbit, one spot, or the page
    const detail: { what: string; beat: Omit<Beat, 'id' | 'say'> } = live.focus && !page.track && !journey.length
      ? { what: `the day's strongest quake, its card open on screen (say its magnitude and where it is): ${live.line}`,
        beat: { enter: fly({ ...live.focus, zoom: 4.5 }), minMs: FLY_MS + 2600, ...(pick ? { frame: pickOnce(pick, 'detail'), captionAt: sheet ? 'top' as const : 'bottom' as const } : {}) } }
      : stops.length
        ? { what: `${STOP_NAMES[stops[stops.length - 1]]}${STOP_FACTS[stops[stops.length - 1]] ? `: ${STOP_FACTS[stops[stops.length - 1]]}` : ''}`,
          beat: { title: STOP_NAMES[stops[stops.length - 1]], enter: world(stops[stops.length - 1]), minMs: STOP_MS } }
        : page.track
          ? { what: 'the camera pulls back from the followed object to its whole orbit around the Earth', beat: { title: FOLLOW_STOPS[0].label, ...followTo(FOLLOW_STOPS[0]), minMs: FLY_MS + 1500 } }
          : spots.length
            ? { what: '', beat: {} }
            : trails?.length ? { what: trailSaid(trails[0]), beat: trailBeat(trails[0], 'detail') }
            : past ? { what: past.what, beat: past.beat }
            : { what: `the map itself: ${shows}`, beat: { minMs: 4200, ...(spin ? { frame: spin } : {}) } };
    // the long cut: the wow, then up to three places each with its card open, every stop in space, or both orbit views
    const long = isLong(ctx.args);
    const cards = shortPace(ctx.args) ? 1 : 2;
    const spotMs = FLY_MS + 300 + cards * CARD_MS;
    type LongLines = { wow: string; spots: Record<string, string>; now?: string; title?: string };
    type Place = { label: string; note?: string; beat: Omit<Beat, 'id' | 'say'> };
    const places: Place[] = !long ? [] : past?.places ? past.places
      : trails?.length ? trails.map((t, i) => ({ label: t.label, note: trailSaid(t), beat: trailBeat(t, `trail-${i}`) })) : stops.length
      ? stops.map(f => ({ label: STOP_NAMES[f], note: STOP_FACTS[f], beat: { title: STOP_NAMES[f], enter: world(f), minMs: STOP_MS + 1500 } }))
      : page.track ? FOLLOW_STOPS.map(f => ({ label: f.label, beat: { title: f.label, ...followTo(f), minMs: FLY_MS + 1500 } }))
        : (picking ? offered : [...offered.slice(0, MAX_SPOTS), ...(live.busiest ?? [])].slice(0, LONG_SPOTS)).map(sp => ({ label: sp.label, note: note(sp.label, sp.note) || undefined,
          // two cards a spot, so the long cut stays on each place long enough to read them
          beat: { title: sp.label, enter: flyOn(sp.view), minMs: pick ? spotMs : FLY_MS + 2600,
            ...(pick ? { frame: Array.from({ length: cards }, (_, n) => pickOnce(pick, `${sp.label.replace(/['\\]/g, '')}#${n}`, FLY_MS + 300 + n * CARD_MS)).join(' '), captionAt: sheet ? 'top' as const : 'bottom' as const } : {}) } }));
    // a long row that comes out with its wow alone films a short in a long slot
    if (long && !shortPace(ctx.args) && places.length < 2) throw new Error(`${page.slug}: a long cut needs at least two stops, and this page gives ${places.length}`);
    const detailWords = wordsFor(DETAIL_MS);
    const lines = await ctx.once('lines', () => askJson<Lines>(SYSTEM,
      `The feature: ${page.heading}. ${page.lede}\nWhat you see: ${shows}\n` +
      (live.line ? `Live right now: ${live.line}\n` : '') +
      (detail.what ? `The one thing the video shows up close: ${detail.what}\n`
        : `${picking ? 'Places the video can fly to; choose one' : 'The place the video flies to, with a card open on what is there'}:\n` +
          `${(picking ? spots : spots.slice(0, 1)).map(s => `- ${s.label}${note(s.label, s.note) ? `: ${note(s.label, s.note)}` : ''}`).join('\n')}\n`) +
      (fact ? `Today's situation, which the video leads with: ${fact}\n` : '') +
      (angle ? `The video's angle: ${angle}. Lead with it, and say only what the facts here back up; where they don't, keep the angle light.\n` : '') +
      `\nWrite (the video is about 20 seconds):\n` +
      (fact ? `- "now": one sentence, at most 18 words, telling today's situation with its numbers exactly as given;\n` +
        `- "title": a post title of at most 70 characters about today's situation;\n` : '') +
      `- "detail": two or three short sentences, ${saidAs(detailWords)}: the most striking thing on screen there, with its live numbers where given, ` +
      `then the next most striking facts about it or about what the map shows${picking ? '; and "place": the exact name of the place you chose' : ''}.\n` +
      `Return {${fact ? '"now": "...", "title": "...", ' : ''}"detail": "..."${picking ? ', "place": "..."' : ''}}.`,
      { check: v => numbered([v.detail, v.now]) ?? filler([v.detail]) ?? tollIn([v.detail, v.now ?? '']) ?? glibIn([v.detail, v.now]) ?? ([v.detail, v.now].some(l => l && CLOCK.test(l)) ? 'no clock times or time zones: the video goes out later'
        : !(v.detail && (!fact || (v.now && v.title))) ? 'every field is needed'
          : picking && !spots.some(s => s.label === v.place) ? 'choose one of the places listed, by its exact name' : lengthProblem({ detail: v.detail }, detailWords)) }));
    // the spot shown: the one the writer chose with an angle, else the first the day's feed backs
    const spot = !detail.what ? (picking ? spots.find(s => s.label === lines.place) : spots[0]) : undefined;
    const detailBeat: Beat = spot && 'view' in spot
      // a sheet card covers the lower half on a phone, so the words move above it
      ? { id: 'detail', ...retell(lines.detail, spot.label), title: spot.label, enter: flyOn(spot.view), minMs: pick ? FLY_MS + 300 + 2 * CARD_MS : FLY_MS + 2600,
        ...(pick ? { frame: `${pickOnce(pick, 'detail')} ${pickOnce(pick, 'detail#1', FLY_MS + 300 + CARD_MS)}`, captionAt: sheet ? 'top' as const : 'bottom' as const } : {}) }
      : { id: 'detail', say: lines.detail, ...detail.beat };
    // each place's line fills its longest hold: the camera's flight and its cards
    const spotWords = wordsFor(Math.max(6000, ...places.map(pl => pl.beat.minMs ?? 0)));
    const longLines = !long ? null : await ctx.once('tour', () => askJson<LongLines>(SYSTEM,
      `The feature: ${page.heading}. ${page.lede}\nWhat you see: ${shows}\n` +
      (live.line ? `Live right now: ${live.line}\n` : '') +
      (past ? `What the video shows: ${past.what}\n` : '') +
      (places.length ? `${picking ? 'Places the video can fly to; choose up to three' : past?.places ? 'Dated stops the video flies to, in order, the map at each date (tell each from its facts)' : 'Places the video flies to, in order, each with a card open on what is there'}:\n` +
        `${places.map(pl => `- ${pl.label}${pl.note ? `: ${pl.note}` : ''}`).join('\n')}\n` : '') +
      (fact ? `Today's situation, which the video leads with: ${fact}\n` : '') +
      (angle ? `The video's angle: ${angle}. Lead with it, and say only what the facts here back up; where they don't, keep the angle light.\n` : '') +
      `\nWrite (the video is about 45 seconds):\n` +
      (fact ? `- "now": one sentence, at most 18 words, telling today's situation with its numbers exactly as given;\n- "title": a post title of at most 70 characters about today's situation;\n` : '') +
      `- "wow": two or three short sentences, ${saidAs(WOW_WORDS)}, ${live.focus && !page.track && !journey.length ? "about the day's strongest quake, whose card is open (its magnitude and where it is)" : 'with the most striking facts about what is on the map'};\n` +
      `- "spots": ${picking ? 'for up to three of the places listed that fit the angle, in the order to visit them' : 'for each place listed'}, one or two sentences of ${saidAs(spotWords)} about what is on screen there, with its live numbers where given.\n` +
      `Return {"wow": "...", ${fact ? '"now": "...", "title": "...", ' : ''}"spots": {${(picking ? [] : places).map(pl => `"${pl.label}": "..."`).join(', ')}${picking ? '"<place>": "..."' : ''}}}.`,
      { check: v => numbered([v.wow, v.now, ...Object.values(v.spots ?? {})]) ?? filler([v.wow, ...Object.values(v.spots ?? {})])
        ?? tollIn([v.wow, v.now ?? '', ...Object.values(v.spots ?? {})]) ?? glibIn([v.wow, v.now, ...Object.values(v.spots ?? {})]) ?? ([v.wow, v.now, ...Object.values(v.spots ?? {})].some(l => l && CLOCK.test(l)) ? 'no clock times or time zones: the video goes out later'
        : !(v.wow && (!fact || (v.now && v.title))) ? 'every field is needed'
          : picking ? (Object.keys(v.spots ?? {}).length >= 1 && Object.keys(v.spots).length <= MAX_SPOTS && Object.keys(v.spots).every(l => places.some(pl => pl.label === l)) ? null : 'choose up to three of the places listed, by their exact names')
            : places.every(pl => v.spots?.[pl.label]) ? null : 'every place is needed')
        ?? lengthProblem({ wow: v.wow }, WOW_WORDS) ?? lengthProblem(v.spots, spotWords) }));
    // lines written before the tour's stops changed (a space tour's longer journey) tell fewer of them: the cut keeps those
    const toldPlaces = !longLines ? [] : (picking ? Object.keys(longLines.spots).flatMap(l => places.filter(pl => pl.label === l)) : places)
      .filter(pl => longLines.spots?.[pl.label]);
    if (longLines && !shortPace(ctx.args) && toldPlaces.length < Math.min(2, places.length))
      throw new Error(`${page.slug}: its long lines (cache.tour.long.json) tell ${toldPlaces.length} of its ${places.length} stops; set them aside to write the cut anew`);
    const longBeats: Beat[] = !longLines ? [] : [
      { id: 'wow', say: longLines.wow, ...(live.focus && !page.track && !journey.length
        ? { enter: fly({ ...live.focus, zoom: 4.5 }), minMs: FLY_MS + 2600, ...(pick ? { frame: pickOnce(pick, 'wow'), captionAt: sheet ? 'top' as const : 'bottom' as const } : {}) }
        : past ? past.wow ?? past.beat : { minMs: 4500, ...(spin ? { frame: spin } : {}) }) },
      ...toldPlaces.map((pl, i) => ({ id: `spot-${i + 1}`, ...retell(longLines.spots[pl.label], pl.label), ...pl.beat })),
    ];
    // what was filmed is what the folder keeps, so the next filming retells from these counts
    if (fresh && Object.entries(fresh).some(([l, n]) => roundCount(n) !== roundCount(counted0![l]))) {
      ctx.keep('live', { ...live, inView: { ...counted0, ...fresh } });
      if (longLines) ctx.keep('tour', { ...longLines, spots: Object.fromEntries(Object.entries(longLines.spots).map(([l, s]) => [l, retell(s, l).say])) });
      else if (spot) ctx.keep('lines', { ...lines, detail: detailBeat.say });
    }
    const path = startsInSpace ? mapHref({ layers: [], mode: { view: 'space', focus: journey[0] } }) : openPath(past?.page ?? page, page.view ?? past?.view);
    // the outro comes back to the opening: the first stop in space, the ride's close view on a followed object, else the camera
    const back = startsInSpace ? backToStart(world(journey[0]))
      : page.track ? `(() => { ${backToStart()}; window.__followFrom = { zoom: __takipMap.getZoom(), pitch: __takipMap.getPitch() }; })()`
        : backToStart(past?.back);
    const now = fact ? (longLines ?? lines).now : undefined;
    // the lines as filmed, counts retold, so a hook never says a count the tour no longer shows
    const { hook, outro } = await loopBeats(ctx, { topic: `${page.heading}. ${page.lede}`, lines: [...(now ? [now] : []), ...(longLines ? longBeats : [detailBeat]).map(b => b.say)],
      facts: [live.line, fact, shows].filter(Boolean).join('; ') }, { back });

    return {
      id: `feature-${page.slug}`,
      kind: 'tour',
      path: withLayers(path),
      chrome: 'app',
      kicker: page.heading,
      ...(past ? { waitOn: '/api/replay/', ready: past.ready, setup: past.setup, captions: 'history' as const } : {}),
      // a Space or deep-time link opens its sheet on a phone too
      ...(!past && page.mode ? { setup: 'window.__takipPanel?.(null)' } : {}),
      ...(TOUR_SETUP[page.slug] ? { setup: TOUR_SETUP[page.slug] } : {}),
      // hook, one detail, and a bridge back into the hook: the platforms loop shorts, so this one has no end
      beats: [
        hook,
        ...(now ? [{ id: 'now', say: now, ...(label ? { title: label } : {}), ...(focus ? { enter: fly(focus), minMs: FLY_MS + 1500 } : {}) }] : []),
        ...(longLines ? longBeats : [detailBeat]),
        ...(page.track ? [{ ...outro, frame: `{ const f = window.__followFrom, k = Math.min(1, ms / ${FLY_MS}), e = k * k * (3 - 2 * k); __takipMap.jumpTo({ zoom: f.zoom + (${RIDE_BACK.zoom} - f.zoom) * e, pitch: f.pitch + (${RIDE_BACK.pitch} - f.pitch) * e }); }` }] : [outro]),
      ],
      sources: [...page.sources.map(s => s.name), 'TAKIP'],
      post: {
        title: (longLines ?? lines).title ?? page.title,
        description: `${page.description} Live at takip.dev/map/${page.slug}`,
        hashtags: ['#TAKIP', '#Maps', ...(SECTION_TAGS[page.section] ?? []), '#OpenData'],
      },
    };
  },
};

const PAN_MS = 2400;
const trailSaid = (t: TrailSpot) =>
  `the camera pans along the ${t.name}${t.itinerary.length ? ` (${t.itinerary.join(' to ')})` : ''} in ${t.label}, and its card opens: say the trail by name`;

/** Flies to a stretch of a trail, pans along it, then clicks where it ends, which opens that trail's card. */
function trailBeat(t: TrailSpot, key: string): Omit<Beat, 'id' | 'say'> {
  return {
    title: t.label,
    enter: `(() => { ${closeCards}; __takipMap.flyTo({ center: [${t.a[0]}, ${t.a[1]}], zoom: ${TRAIL_ZOOM}, duration: ${FLY_MS}, essential: true }); })()`,
    frame: `{ if (ms > ${FLY_MS}) { const k = Math.min(1, (ms - ${FLY_MS}) / ${PAN_MS}), e = k * k * (3 - 2 * k); ` +
      `__takipMap.jumpTo({ center: [${t.a[0]} + ${t.b[0] - t.a[0]} * e, ${t.a[1]} + ${t.b[1] - t.a[1]} * e] }); } ` +
      `if (ms >= ${FLY_MS + PAN_MS + 200} && !window.__picked?.['${key}']) { (window.__picked ??= {})['${key}'] = 1; const m = __takipMap, p = m.project(m.getCenter()); ` +
      `m.fire('click', { point: p, lngLat: m.getCenter(), originalEvent: new MouseEvent('click') }); } }`,
    minMs: FLY_MS + PAN_MS + 3600,
  };
}

/** Why a line is filler, or null. */
export function filler(lines: (string | undefined)[]) {
  const said = lines.map(l => l?.match(FILLER)?.[0]).find(Boolean);
  return said ? `"${said}" talks about the video, not the place: say one striking thing about the place from its facts` : null;
}
