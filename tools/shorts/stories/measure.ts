/**
 * A History measure through the years: countries coloured by it while the clock runs, past today into the
 * publisher's projection where there is one, and labelled as such. Every number the narrator says (rankings,
 * the biggest change, countries past a threshold, a world total) is computed here from the series.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { basename } from 'node:path';
import { backToStart, isLong, loopBeats, shortHold, shortPace } from '../loop';
import { askJson } from '../narrate/llm';
import { STYLE, TODAY } from '../narrate/style';
import type { Beat } from '../scene';
import type { Maker } from './context';
import { sampleYears, spokenNumber, valuesAt, type Ranked } from './facts';
import { MEASURE_PRESETS, type MeasurePreset } from './presets/measures';

/** Stretches and their length: the short loop (20–25 s), or `--length long`; a short's legs fill its body (loop.ts shortHold). */
const CUTS = { short: { legs: 4, legMs: 4000, words: 9, seconds: 22 }, long: { legs: 5, legMs: 6500, words: 14, seconds: 50 } };
/** Share of a leg spent travelling; the line describes where it arrives. */
const ARRIVE = 0.5;
const FLY_MS = 2500;
const ZOOM = 1.9;
const COUNTRIES = join(resolve(import.meta.dirname, '../../..'), 'public/data/boundaries/countries.json');

type Series = Record<string, [number, number][]>;
type Country = { name: string; at: [number, number] };

async function series(base: string, metric: string, source?: string): Promise<{ values: Series; last: number }> {
  const res = await fetch(`${base}/api/replay/history/series/${encodeURIComponent(metric)}${source ? `?source=${source}` : ''}`, {
    // the browser passes the API gate by Sec-Fetch-Site; so does this
    headers: { 'Sec-Fetch-Site': 'same-origin' }, signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`series ${metric}: ${res.status} ${await res.text()}`);
  const d = (await res.json()) as { values: Series; years: [number, number] };
  return { values: d.values, last: d.years[1] };
}

export function countries(): Record<string, Country> {
  const d = JSON.parse(readFileSync(COUNTRIES, 'utf8')) as { features: { properties: { id: string; name: string; label: [number, number] } }[] };
  return Object.fromEntries(d.features.map(f => [f.properties.id, { name: f.properties.name, at: f.properties.label }]));
}

/** Territories this small lead every "biggest change" by noise (Sint Maarten's CO₂, the Vatican's over-65s), so they aren't told. */
const MIN_PEOPLE = 250_000;

/**
 * Contested places, as borders shorts keep Tibet and Kosovo untold (takip-98, 2026-10-22): coloured like everywhere else,
 * counted in a line about countries, but never a line's, chip's or camera's subject.
 */
export const UNTOLD = new Set(['SAH', 'PSX', 'TWN', 'KOS', 'CYN', 'SOL', 'KAS', 'FLK']);

/** Why a line singles out a contested place, or null. */
export function contestedIn(lines: string[], names: Record<string, { name: string }>) {
  const key = lines.map(l => namedCountry(l, [...UNTOLD], names)).find(Boolean);
  return key ? `never single out ${names[key].name}, a contested place; tell another country or a count of countries` : null;
}

/** Each year's value as the mean of the `years` up to it, so a warm or cold year doesn't pass for a trend. */
export function smoothed(values: Series, years: number): Series {
  return Object.fromEntries(Object.entries(values).map(([k, points]) => [k, points.map(([y]) => {
    const window = points.filter(q => q[0] > y - years && q[0] <= y);
    return [y, window.reduce((sum, q) => sum + q[1], 0) / window.length] as [number, number];
  })]));
}

/** Short forms a narrator says for a country, beside its countries.json name ("People's Republic of China"). */
const SAID_AS: Record<string, string[]> = {
  USA: ['United States', 'US', 'U.S.', 'America'], GBR: ['UK', 'Britain'], CHN: ['China'], COD: ['DR Congo', 'Congo'],
  ARE: ['UAE', 'Emirates'], CZE: ['Czechia'], NLD: ['Holland'],
};
const escaped = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The country a line names first (the longer name where two start together, "Guinea-Bissau" over "Guinea"), among `keys`. */
export function namedCountry(line: string, keys: string[], names: Record<string, { name: string }>): string | null {
  let best: { key: string; at: number; length: number } | null = null;
  for (const key of keys) {
    for (const said of [names[key]?.name.replace(/^The /, ''), ...(SAID_AS[key] ?? [])]) {
      if (!said) continue;
      const m = new RegExp(`(?<![\\p{L}])${escaped(said)}(?![\\p{L}])`, 'u').exec(line);
      if (m && (!best || m.index < best.at || (m.index === best.at && said.length > best.length))) best = { key, at: m.index, length: said.length };
    }
  }
  return best?.key ?? null;
}

/** A preset's values by country, the publisher's projection joined after its last estimate, without the smallest territories. */
export async function measureSeries(base: string, p: MeasurePreset): Promise<{ values: Series; last: number }> {
  const [est, people] = await Promise.all([series(base, p.metric, p.source), series(base, 'wpp:TPopulation1July', 'wpp-2024')]);
  const values: Series = { ...est.values };
  if (p.projection) {
    const proj = await series(base, `${p.metric}.proj`, p.source);
    for (const [k, points] of Object.entries(proj.values)) values[k] = [...(values[k] ?? []), ...points.filter(q => q[0] > est.last)];
  }
  for (const k of Object.keys(values)) if ((people.values[k]?.at(-1)?.[1] ?? 0) < MIN_PEOPLE) delete values[k];
  return { values: p.smooth ? smoothed(values, p.smooth) : values, last: est.last };
}

const SYSTEM = `You write voiceover for short vertical videos where a world map colours each country by a measure while a
year counter runs. Use only the numbers and names in the facts; never add causes or numbers of your own, and every claim
carries its number ("the world reaches 10.2 billion", never "the world holds steady" alone). Years after the last estimate
are the publisher's projection: a line about them says so ("the UN projects…", "is projected to"), never in the past
tense. A crossing in the facts happens in the year it gives, so a line about it says that year ("In 2023, India passes
China"), not the stretch's end. ${STYLE}
Reply with JSON only.`;

/** A line's years, leaving out a price base ("in 2011 dollars"). */
const yearsIn = (line: string) => (line.replace(/\b\d{4} (prices|dollars)\b/gi, '').match(/\b\d{4}(?=s?\b)/g) ?? []).map(Number);

/**
 * The first stretch whose line names no year inside it, or null: without one a viewer can't tell when the change happened
 * (takip-98, 2026-10-22: "Then Qatar crashes…" could be any decade). A crossing's line names its own year, not the end's.
 */
export function undated(legs: { from: number; year: number }[], lines: Record<string, string>) {
  const l = legs.find(l => !yearsIn(lines[`y${l.year}`] ?? '').some(y => y >= l.from && y <= l.year));
  return l ? `"y${l.year}" must name the year it tells (${l.year}, or a crossing's year from ${l.from} on), like "By ${l.year}, …"` : null;
}

/**
 * Where the top three at a stretch's end changed order inside it, the year each pass happened: "by 2040, India overtakes
 * China" read as if it happened near 2040, when the UN puts it in 2023.
 */
export function crossings(values: Series, from: number, to: number, known: (key: string) => boolean = () => true): { ahead: string; behind: string; year: number }[] {
  const top = valuesAt(values, to).filter(r => known(r.key)).slice(0, 3).map(r => r.key);
  const at = (k: string, y: number) => values[k]?.find(q => q[0] === y)?.[1];
  const out: { ahead: string; behind: string; year: number }[] = [];
  for (const a of top) for (const b of top) {
    const [a0, b0] = [at(a, from), at(b, from)];
    if (a === b || a0 === undefined || b0 === undefined || a0 >= b0 || at(a, to)! <= at(b, to)!) continue;
    for (let y = from + 1; y <= to; y++) {
      const [ay, by] = [at(a, y), at(b, y)];
      if (ay !== undefined && by !== undefined && ay > by) { out.push({ ahead: a, behind: b, year: y }); break; }
    }
  }
  return out;
}

function facts(p: MeasurePreset, values: Series, last: number, names: Record<string, Country>, stretches: number) {
  const say = (v: number) => `${spokenNumber(v, p.digits ?? 1)} ${p.unit}`;
  const years = sampleYears(p.from, p.to, stretches + 1);
  const ranked = (y: number) => valuesAt(values, y).filter(r => names[r.key]);
  const top = (rs: Ranked[]) => rs.slice(0, 5).map(r => `${names[r.key].name} ${say(r.value)}`);
  const at = (y: number) => {
    const rs = ranked(y), shown = rs.filter(r => !UNTOLD.has(r.key));
    const passing = p.threshold ? rs.filter(r => (p.threshold!.below ? r.value < p.threshold!.value : r.value > p.threshold!.value)).length : null;
    return {
      year: y,
      projected: y > last,
      highest: top(shown),
      lowest: p.sum ? [] : top([...shown].reverse()),
      // the lists leave contested places out, so their first isn't always the world's
      ...(UNTOLD.has(rs[0]?.key) ? { note: 'a place left out of these lists ranks highest: never call the first of "highest" the world\'s highest' } : {}),
      ...(!p.sum && UNTOLD.has(rs.at(-1)?.key ?? '') ? { note: 'a place left out of these lists ranks lowest: never call the first of "lowest" the world\'s lowest' } : {}),
      ...(p.sum ? { world: say(rs.reduce((s, r) => s + r.value, 0)) } : {}),
      ...(passing !== null ? { passing: `${passing} of ${rs.length} countries ${p.threshold!.label}` } : {}),
    };
  };
  const legs = years.slice(1).map((y, i) => {
    const before = new Map(ranked(years[i]).map(r => [r.key, r.value]));
    const moved = ranked(y).filter(r => !UNTOLD.has(r.key)).flatMap(r => (before.has(r.key) ? [{ key: r.key, from: before.get(r.key)!, to: r.value }] : []))
      .sort((a, b) => Math.abs(b.to - b.from) - Math.abs(a.to - a.from))[0];
    return {
      ...at(y), from: years[i], biggestChange: moved ? `${names[moved.key].name}, from ${say(moved.from)} to ${say(moved.to)}` : null, focus: moved?.key ?? null,
      crossings: crossings(values, years[i], y, k => !!names[k] && !UNTOLD.has(k)).map(c => `${names[c.ahead].name} passes ${names[c.behind].name} in ${c.year}${c.year > last ? ' (projected)' : ''}`),
    };
  });
  return { years, start: at(years[0]), legs };
}

export const measure: Maker = {
  id: 'measure',
  kind: 'story',
  presets: Object.keys(MEASURE_PRESETS),
  about: `A History measure country by country, into the projections (--preset ${Object.keys(MEASURE_PRESETS).join('|')})`,
  async make(ctx) {
    const p = MEASURE_PRESETS[ctx.args.preset ?? ''];
    if (!p) throw new Error(`--preset must be one of ${Object.keys(MEASURE_PRESETS).join(', ')}`);
    const names = countries();
    const cut = CUTS[isLong(ctx.args) ? 'long' : 'short'];
    const f = await ctx.once('facts', async () => {
      const { values, last } = await measureSeries(ctx.base, p);
      return { ...facts(p, values, last, names, cut.legs), last };
    });
    const id = (y: number) => `y${y}`;

    const lines = await ctx.once('lines', () => askJson<{ today: string; lines: Record<string, string> }>(SYSTEM,
      `The video shows ${p.topic}. Estimates run to ${f.last}${p.projection ? `; later years are the ${p.projection.label}` : ''}.\n` +
      `Start, ${f.start.year}: ${JSON.stringify(f.start)}\n\nStretches, in order:\n` +
      f.legs.map(l => `[${id(l.year)}] ${l.from}–${l.year}: ${JSON.stringify({ ...l, focus: undefined })}`).join('\n') +
      // the hook comes before any "UN projection" title, so it can't lean on the label
      `\n\nWrite, every line short (the video is about ${cut.seconds} seconds):\n- ${TODAY}; it is said before any label, so a year after ${f.last} in it is said as projected;\n` +
      `- "lines": for each stretch, one sentence of at most ${cut.words} words, leading with the most striking change by its end year, naming that year ("By 2000, …"), with one number and no year ranges.${p.phrasing ? ` ${p.phrasing.rule}` : ''}\n` +
      `Return {"today": "...", "lines": {${f.legs.map(l => `"${id(l.year)}": "..."`).join(', ')}}}.`,
      { check: v => (!(v.today && f.legs.every(l => v.lines?.[id(l.year)]?.trim())) ? 'need "today" and a line for every year id'
        : (v.today.match(/\b\d{4}\b/g) ?? []).some(y => +y > f.last) && !/project/i.test(v.today) ? `"today" names a year after ${f.last} without saying projected`
          : f.legs.filter(l => l.projected && !/project/i.test(v.lines[id(l.year)])).map(l => `"${id(l.year)}" is about projected years: say it is a projection ("the UN projects", "is projected to")`)[0]
            ?? undated(f.legs, v.lines)
            ?? contestedIn([v.today, ...Object.values(v.lines)], names)
            ?? (p.phrasing?.wrong && [v.today, ...Object.values(v.lines)].some(l => p.phrasing!.wrong!.test(l)) ? p.phrasing.rule : null)
            ?? (p.phrasing?.once && ![v.today, ...Object.values(v.lines)].some(l => p.phrasing!.once!.test(l)) ? p.phrasing.rule : null)) }));
    const { hook, outro } = loopBeats(basename(ctx.dir), lines.today, { variant: ctx.args.variant });

    // the line is about the year a leg ends on, so the clock gets there by mid-leg and waits
    const seek = (y0: number, y1: number) =>
      `{ const k = Math.min(1, p / ${ARRIVE}); const d = new Date(0); d.setUTCFullYear(Math.round(${y0} + ${y1 - y0} * k), 6, 1); __takipHistory.clock.seek(d.getTime()); }`;
    // the chip and camera follow the country the line names, which needn't be the stretch's biggest change; a line about
    // a count of countries shows that count
    const told = await ctx.once('told', async () => {
      const { values } = await measureSeries(ctx.base, p);
      const n = (v: number) => `${spokenNumber(v, p.digits ?? 1)}${p.unit.startsWith('percent') ? '%' : ''}`;
      const at = (k: string, y: number) => values[k]?.find(q => q[0] === y)?.[1];
      return f.legs.map(l => {
        const line = lines.lines[id(l.year)];
        const chip = (key: string) => {
          const from = at(key, l.from), to = at(key, l.year)!;
          return { key, chip: `${SAID_AS[key]?.[0] ?? names[key].name} · ${p.legend}: ${from !== undefined ? `${n(from)} → ` : ''}${n(to)}` };
        };
        const key = namedCountry(line, Object.keys(values).filter(k => names[k] && !UNTOLD.has(k) && at(k, l.year) !== undefined), names);
        if (key) return chip(key);
        // a chip is read in a second: "170 of 182 countries below 2.1 births per woman", without the label's gloss
        if (/countr/i.test(line) && l.passing) return { key: null, chip: l.passing.replace(/ \(.*\)$/, '').split(',')[0] };
        return l.focus ? chip(l.focus) : { key: null, chip: null };
      });
    });
    const fly = (key: string | null) => {
      const c = key ? names[key]?.at : null;
      return c ? `__takipMap.flyTo({ center: [${c[0]}, ${c[1]}], zoom: ${ZOOM}, duration: ${FLY_MS}, essential: true })` : undefined;
    };
    const legs: Beat[] = f.legs.map((l, i) => ({
      id: id(l.year),
      say: lines.lines[id(l.year)],
      // the label comes up as the counter passes the last estimate, which a stretch can straddle
      ...(l.projected && p.projection ? { title: p.projection.label, titleAt: { p: Math.max(0, ARRIVE * (f.last + 0.5 - l.from) / (l.year - l.from)) } } : {}),
      ...(fly(told[i].key) ? { enter: fly(told[i].key) } : {}),
      frame: seek(l.from, l.year),
      ...(told[i].chip ? { chip: told[i].chip! } : {}),
      minMs: shortPace(ctx.args) ? shortHold(f.legs.length, CUTS.short.legMs) : cut.legMs,
    }));

    return {
      id: `measure-${ctx.args.preset}`,
      kind: 'story',
      path: `/?view=history&year=${p.from}&metric=${encodeURIComponent(p.metric)}${p.source ? `&source=${p.source}` : ''}&lat=20&lon=20&zoom=${ZOOM}`,
      chrome: 'map-only',
      waitOn: '/api/replay/',
      // the clock can't pass today until the projection has loaded and lifted History's ceiling
      ready: `window.__takipHistory && __takipHistory.countries.state().status === 'ready'`,
      // event pins would sit on the colours and say nothing about the measure
      setup: `(() => { const h = __takipHistory; h.clock.pause(); [...h.families()].forEach(f => h.setFamily(f, false)); const d = new Date(0); d.setUTCFullYear(${p.from}, 6, 1); h.clock.seek(d.getTime()); })()`,
      kicker: p.kicker,
      counter: { expr: 'new Date(__takipHistory.clock.time()).getUTCFullYear()', unit: '{n}', kind: 'year' },
      legend: { label: p.legend, expr: `(() => { const s = __takipHistory.countries.state(); return s.status === 'ready' ? { lo: s.scale.lo, hi: s.scale.hi } : null; })()` },
      beats: [
        hook,
        ...legs,
        // back to the first year and the opening view, so the loop's last frame meets its first
        { ...outro, enter: backToStart(`(() => { const d = new Date(0); d.setUTCFullYear(${p.from}, 6, 1); __takipHistory.clock.seek(d.getTime()); })()`) },
      ],
      sources: p.sources,
      post: {
        title: p.postTitle,
        description: `${p.postTitle}, on TAKIP's History map.${p.projection ? ` Years after ${f.last} are the ${p.projection.label}.` : ''} Explore every country at takip.dev.`,
        hashtags: p.hashtags,
      },
    };
  },
};
