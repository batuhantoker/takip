/**
 * A History page's tour: the phone's History sheet closed so the map fills the screen, the clock run across the page's
 * years with the year on the app's own time bar (an overlay counter beside it disagreed: the bar redraws on its own
 * throttle), and, on the page about country measures, the map coloured by one with a country's
 * value as a chip. Filmed with the sheet open, these tours showed a panel over a black sky (takip-98, 2026-10-21).
 */
import { wikiSummary } from '../../../src/lib/core/wikipedia/client';
import type { LayerPage } from '../../../src/lib/platform/site/catalog/types';
import type { Beat } from '../scene';
import { dayMs, yearAsWritten } from './chronicle';
import type { Context } from './context';
import { keepOutKinds } from './kept-out';
import { spokenNumber, valuesAt } from './facts';
import { countries, measureSeries, UNTOLD } from './measure';
import { CHRONICLES } from './presets/chronicles';
import { MEASURE_PRESETS } from './presets/measures';
import { spotlights, type Spotlight } from './spotlight';
import { KIND_FAMILY } from '../../../src/lib/history/kinds';

/** The page opens with no measure picked; its tour colours the map by this one (presets/measures.ts). */
const MEASURES: Record<string, string> = { 'country-data-over-time': 'life-expectancy' };
/**
 * A page with no years of its own runs through the dates of its subject's chronicle (presets/chronicles.ts), and a long
 * cut stops at each: a WWII map left at January 1939 showed nothing of a war the narrator called "a month every second".
 */
const CHRONICLED: Record<string, string> = { 'world-war-2-map': 'ww2-europe', 'world-map-1914': 'ww1', 'roman-empire-map': 'rome', 'ottoman-empire-map': 'ottoman-rise' };
const LEAD_MS = 60 * 86_400_000;
const FLY_MS = 2600;
/** Share of the beat the clock spends running; it then holds on the last year while the line ends. */
const RUN = 0.6;

/** Folds History's colour-key card, which covers the middle of a phone. */
const FOLD = `document.querySelectorAll('button[aria-label="Fold"][aria-expanded="true"]').forEach(b => b.click());`;

const seekMs = (t: number) => `__takipHistory.clock.seek(${t});`;
const seek = (y: number) => `{ const d = new Date(0); d.setUTCFullYear(${y}, 6, 1); __takipHistory.clock.seek(d.getTime()); }`;

export interface HistoryTour {
  /** The page as filmed: a measure picked, the clock at the first year. */
  page: LayerPage;
  /** Where the camera opens, when the page has no view of its own. */
  view?: { lat: number; lon: number; zoom: number };
  ready: string;
  setup: string;
  /** For the writer: what the one beat up close shows. */
  what: string;
  beat: Omit<Beat, 'id' | 'say'>;
  /** The page JavaScript that puts the clock back at the first year, for the loop. */
  back: string;
  /** A long cut's dated stops, in place of a page's spots, and the wow beat before them (the map at the first date). */
  places?: { label: string; note?: string; beat: Omit<Beat, 'id' | 'say'> }[];
  wow?: Omit<Beat, 'id' | 'say'>;
}

export async function historyTour(page: LayerPage, ctx: Context, long = false): Promise<HistoryTour | null> {
  const mode = page.mode?.view === 'history' ? page.mode : null;
  if (!mode) return null;
  const preset = MEASURES[page.slug] ? MEASURE_PRESETS[MEASURES[page.slug]] : undefined;
  const chronicle = !mode.range && !preset ? CHRONICLES[CHRONICLED[page.slug]] : undefined;
  if (chronicle) return chronicled(page, ctx, chronicle, long);
  // a page at one year (the danger list in 2021) still has events to open
  const range = preset ? { from: preset.from, to: preset.to } : mode.range ?? (mode.year != null && !mode.layer ? { from: mode.year, to: mode.year + 1 } : undefined);
  const filmed: LayerPage = {
    ...page,
    mode: { ...mode, ...(range ? { year: range.from } : {}), ...(preset ? { metric: preset.metric, source: preset.source } : {}) },
  };
  // a History link opens its sheet on a phone, over the map the tour is about; its key card folds to its title, and on a
  // measure, event dots would sit on the colours and say nothing about it
  const setup = `(() => { window.__takipPanel?.(null); const h = __takipHistory; h.clock.pause(); ${range ? seek(range.from) : ''} ` +
    `${preset ? '[...h.families()].forEach(f => h.setFamily(f, false));' : keepOut(page)} ${FOLD} })()`;
  // the card can come up after setup, once its layer or measure has loaded
  const fold = `(() => { ${FOLD} })()`;
  const back = range ? seek(range.from) : '';
  if (!range) {
    return { page: filmed, ready: '!!window.__takipHistory', setup, back, what: `the map itself: ${page.shows.join(' ')}`, beat: { enter: fold, minMs: 4200 } };
  }
  const run = `__takipHistory.clock.seek((() => { const d = new Date(0); d.setUTCFullYear(Math.round(${range.from} + ${range.to - range.from} * Math.min(1, p / ${RUN})), 6, 1); return d.getTime(); })())`;
  if (!preset) {
    const kinds = page.eventKinds?.length ? page.eventKinds : Object.keys(KIND_FAMILY).filter(k => (mode.families ?? ['conflict']).some(f => f === KIND_FAMILY[k]));
    const picks = spotlights(page.slug, kinds, msOf(range.from), msOf(range.to), long ? 3 : 1);
    const base = { page: filmed, ready: '!!window.__takipHistory', setup, back };
    if (!picks.length) {
      return { ...base, what: `the map's clock running from ${range.from} to ${range.to} in a few seconds, its events appearing as they happen: ${page.shows.join(' ')}`, beat: { enter: fold, frame: run, minMs: 5200 } };
    }
    // the lead gives each place one striking thing to say; a name and a year alone made filler ("Chan Chan is next")
    const leads = await ctx.once('leads', async () => Object.fromEntries(await Promise.all(picks.map(async s => {
      const [, lang, title] = s.wiki?.match(/^(?:([a-z]{2,3}):)?(.+)$/) ?? [];
      const lead = title ? await wikiSummary(title, lang ?? 'en').catch(() => null) : null;
      return [s.id, lead?.extract?.slice(0, 400) ?? ''];
    }))));
    const said = (s: Spotlight) => `${s.name} (${yearText(s.t)}${s.measure ? `, ${s.measure}` : ''}), its card open on screen${leads[s.id] ? `; from its article: ${leads[s.id]}` : ''}`;
    if (!long) {
      return {
        ...base,
        what: `the clock runs from ${range.from} and the camera flies to ${said(picks[0])}; the line names it${picks[0].measure ? ` with its ${picks[0].measure}` : ''}. ${page.shows.join(' ')}`,
        beat: spotBeat(picks[0], msOf(range.from), 'detail'),
      };
    }
    const dated = [...picks].sort((a, b) => a.t - b.t);
    return {
      ...base,
      what: `the map at ${range.from}, before the events it flies to: ${page.shows.join(' ')}`,
      beat: { enter: fold, minMs: 4500 }, wow: { enter: fold, minMs: 4500 },
      places: dated.map((s, i) => ({ label: s.name, note: said(s), beat: spotBeat(s, i ? dated[i - 1].t : msOf(range.from), `spot-${i}`) })),
    };
  }

  const names = countries();
  const f = await ctx.once('measure', async () => {
    const { values, last } = await measureSeries(ctx.base, preset);
    const say = (v: number) => `${spokenNumber(v, preset.digits ?? 1)} ${preset.unit}`;
    const top = (y: number) => valuesAt(values, y).filter(r => names[r.key] && !UNTOLD.has(r.key)).slice(0, 3).map(r => ({ name: names[r.key].name, value: say(r.value) }));
    const bottom = (y: number) => valuesAt(values, y).filter(r => names[r.key] && !UNTOLD.has(r.key)).reverse().slice(0, 3).map(r => ({ name: names[r.key].name, value: say(r.value) }));
    return { last, start: { highest: top(range.from), lowest: bottom(range.from) }, latest: { highest: top(last), lowest: bottom(last) }, end: { highest: top(range.to), lowest: bottom(range.to) } };
  });
  const lead = f.end.highest[0];
  return {
    page: filmed,
    view: { lat: 20, lon: 20, zoom: 1.9 },
    ready: `window.__takipHistory && __takipHistory.countries.state().status === 'ready'`,
    setup, back,
    what: `countries coloured by ${preset.legend.toLowerCase()} as the clock runs from ${range.from} to ${range.to}; after ${f.last} the ` +
      `map shows the ${preset.projection?.label ?? 'projection'}, labelled. In ${range.from}: ${JSON.stringify(f.start)}. In ${f.last}: ` +
      `${JSON.stringify(f.latest)}. In ${range.to} (projected): ${JSON.stringify(f.end)}. The chip on screen shows ${lead.name}, ${lead.value} in ${range.to}. ` +
      `The line is said while the clock runs, so it tells how far the numbers move and ends where the chip does.${preset.phrasing ? ` ${preset.phrasing.rule}` : ''}`,
    beat: {
      enter: fold, frame: run, minMs: 6000,
      ...(preset.projection ? { title: preset.projection.label, titleAt: { p: (RUN * (f.last + 0.5 - range.from)) / (range.to - range.from) } } : {}),
      chip: `${preset.projection ? `${preset.projection.label}, ` : ''}${range.to}: ${lead.name}, ${lead.value}`,
      chipAt: RUN,
    },
  };
}

/** Page JavaScript that draws the page's event kinds without the kept-out ones. */
function keepOut(page: LayerPage) {
  const mode = page.mode?.view === 'history' ? page.mode : null;
  return keepOutKinds({ kinds: page.eventKinds, families: mode?.families });
}

/** A tour through a chronicle's dates: the clock runs across them, and a long cut flies to each stop at its date. */
async function chronicled(page: LayerPage, ctx: Context, chronicle: (typeof CHRONICLES)[string], long: boolean): Promise<HistoryTour> {
  const stops = chronicle.stops;
  const mode = page.mode as Extract<LayerPage['mode'], { view: 'history' }>;
  const start = dayMs(stops[0].date) - LEAD_MS;
  const filmed: LayerPage = { ...page, mode: { ...mode, year: new Date(start).getUTCFullYear() } };
  const fold = `(() => { ${FOLD} })()`;
  const setup = `(() => { window.__takipPanel?.(null); const h = __takipHistory; h.clock.pause(); ${seekMs(start)} ${keepOut(page)} ${FOLD} })()`;
  // a day shown for a stop known only by its year would be a precision the sources don't have
  const base = { page: filmed, ready: '!!window.__takipHistory', setup, back: seekMs(start) };
  const dates = (s: { date: string }) => yearAsWritten(s.date).replace(/ BC$/, ' BCE');
  const leads = await ctx.once('stops', async () => Object.fromEntries(await Promise.all(stops.map(async s => [s.id, (await wikiSummary(s.wiki))?.extract ?? '']))));
  const stopBeat = (s: (typeof stops)[number], from: number) => ({
    title: s.title, titleAt: { ms: FLY_MS }, minMs: FLY_MS + 2400,
    enter: `__takipMap.flyTo({ center: [${s.at[1]}, ${s.at[0]}], zoom: ${s.at[2]}, duration: ${FLY_MS}, essential: true })`,
    frame: `{ const k = Math.min(1, ms / ${FLY_MS}); const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2; __takipHistory.clock.seek(${from} + ${dayMs(s.date) - from} * e); }`,
  });
  if (!long) {
    // one stop, the middle of the chronicle's short telling, so the short shows something by name
    const stop = stops.find(s => s.id === chronicle.short?.[1]) ?? stops[Math.floor(stops.length / 2)];
    return {
      ...base,
      what: `the clock runs from ${dates(stops[0])} and the camera flies to ${stop.title}, ${stop.date}, its name on screen: ${leads[stop.id].slice(0, 500)}`,
      beat: { ...stopBeat(stop, start), enter: `(() => { ${FOLD} ${stopBeat(stop, start).enter}; })()` },
    };
  }
  return {
    ...base,
    what: `the map at ${dates(stops[0])}, before the first stop: ${page.shows.join(' ')}`,
    beat: { enter: fold, minMs: 4500 },
    wow: { enter: fold, minMs: 4500 },
    places: stops.map((s, i) => ({ label: s.title, note: `${s.date}: ${leads[s.id].slice(0, 500)}`, beat: stopBeat(s, i ? dayMs(stops[i - 1].date) : start) })),
  };
}

const msOf = (y: number) => { const d = new Date(0); d.setUTCFullYear(y, 0, 1); return d.getTime(); };
const yearText = (t: number) => { const y = new Date(t).getUTCFullYear(); return y < 1 ? `${1 - y} BCE` : String(y); };
const SPOT_ZOOM = 4.2;

/**
 * Keeps an open card to its name, date and measures: its death and injury rows go (tragedies stay plain, and a card is read
 * in a second), with its photo and article, which would cover the captions. Run every frame, since the card redraws as
 * its article and related events load.
 */
const TRIM_CARD = `document.querySelectorAll('.maplibregl-popup dt').forEach(dt => { if (/death|killed|injur|missing|casualt|victim|wounded/i.test(dt.textContent)) { dt.nextElementSibling?.remove(); dt.remove(); } }); ` +
  `document.querySelectorAll('.maplibregl-popup :is(.tk-pop-media, .tk-pop-wiki, .tk-pop-text, .tk-pop-more, .tk-pop-related-list, .tk-pop-note, .tk-pop-label)').forEach(n => n.remove());`;

/**
 * A beat that flies to an event while the clock runs to its date, then opens its card as a tap would (a dev handle, since
 * an event can sit inside one of the map's clusters). The event sits below the middle, so its card opens above it over the
 * map, and the captions take the band under the app's bar.
 */
function spotBeat(s: Spotlight, from: number, key: string): Omit<Beat, 'id' | 'say'> {
  return {
    enter: `(() => { document.querySelectorAll('.maplibregl-popup').forEach(p => p.remove()); ${FOLD} ` +
      `__takipMap.flyTo({ center: [${s.lon}, ${s.lat}], zoom: ${SPOT_ZOOM}, offset: [0, 90], duration: ${FLY_MS}, essential: true }); })()`,
    frame: `{ const k = Math.min(1, ms / ${FLY_MS}); const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2; __takipHistory.clock.seek(${from} + ${s.t - from} * e); ` +
      `if (ms >= ${FLY_MS + 300} && !window.__picked?.['${key}']) { (window.__picked ??= {})['${key}'] = 1; window.__takipOpenEvent?.(${s.id}); } ${TRIM_CARD} }`,
    // time to read the card once it opens, so a long cut's three stops reach about 40 s
    captionAt: 'header', minMs: FLY_MS + 4400,
  };
}
