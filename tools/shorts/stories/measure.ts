/**
 * A History measure through the years: countries coloured by it while the clock runs, past today into the
 * publisher's projection where there is one, and labelled as such. Every number the narrator says (rankings,
 * the biggest change, countries past a threshold, a world total) is computed here from the series.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { askJson } from '../narrate/llm';
import type { Beat } from '../scene';
import type { Maker } from './context';
import { sampleYears, spokenNumber, valuesAt, type Ranked } from './facts';
import { MEASURE_PRESETS, type MeasurePreset } from './presets/measures';

const LEGS = 4;
const LEG_MS = 6500;
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

function countries(): Record<string, Country> {
  const d = JSON.parse(readFileSync(COUNTRIES, 'utf8')) as { features: { properties: { id: string; name: string; label: [number, number] } }[] };
  return Object.fromEntries(d.features.map(f => [f.properties.id, { name: f.properties.name, at: f.properties.label }]));
}

const SYSTEM = `You write voiceover for short vertical videos where a world map colours each country by a measure while a
year counter runs. A calm documentary narrator. Use only the numbers and names in the facts; never add causes or
numbers of your own, and say "projected" for years past the last estimate. Short sentences; no questions, no
exclamation marks. Reply with JSON only.`;

function facts(p: MeasurePreset, values: Series, last: number, names: Record<string, Country>) {
  const say = (v: number) => `${spokenNumber(v, p.digits ?? 1)} ${p.unit}`;
  const years = sampleYears(p.from, p.to, LEGS + 1);
  const ranked = (y: number) => valuesAt(values, y).filter(r => names[r.key]);
  const top = (rs: Ranked[]) => rs.slice(0, 5).map(r => `${names[r.key].name} ${say(r.value)}`);
  const at = (y: number) => {
    const rs = ranked(y);
    const passing = p.threshold ? rs.filter(r => (p.threshold!.below ? r.value < p.threshold!.value : r.value > p.threshold!.value)).length : null;
    return {
      year: y,
      projected: y > last,
      highest: top(rs),
      lowest: p.sum ? [] : top([...rs].reverse()),
      ...(p.sum ? { world: say(rs.reduce((s, r) => s + r.value, 0)) } : {}),
      ...(passing !== null ? { passing: `${passing} of ${rs.length} countries ${p.threshold!.label}` } : {}),
    };
  };
  const legs = years.slice(1).map((y, i) => {
    const before = new Map(ranked(years[i]).map(r => [r.key, r.value]));
    const moved = ranked(y).flatMap(r => (before.has(r.key) ? [{ key: r.key, from: before.get(r.key)!, to: r.value }] : []))
      .sort((a, b) => Math.abs(b.to - b.from) - Math.abs(a.to - a.from))[0];
    return { ...at(y), from: years[i], biggestChange: moved ? `${names[moved.key].name}, from ${say(moved.from)} to ${say(moved.to)}` : null, focus: moved?.key ?? null };
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
    const f = await ctx.once('facts', async () => {
      const est = await series(ctx.base, p.metric, p.source);
      const values: Series = { ...est.values };
      if (p.projection) {
        const proj = await series(ctx.base, `${p.metric}.proj`, p.source);
        for (const [k, points] of Object.entries(proj.values)) values[k] = [...(values[k] ?? []), ...points.filter(q => q[0] > est.last)];
      }
      return { ...facts(p, values, est.last, names), last: est.last };
    });
    const id = (y: number) => `y${y}`;

    const lines = await ctx.once('lines', () => askJson<{ hook: string; lines: Record<string, string>; outro: string }>(SYSTEM,
      `The video shows ${p.topic}. Estimates run to ${f.last}${p.projection ? `; later years are the ${p.projection.label}` : ''}.\n` +
      `Start, ${f.start.year}: ${JSON.stringify(f.start)}\n\nStretches, in order:\n` +
      f.legs.map(l => `[${id(l.year)}] ${l.from}–${l.year}: ${JSON.stringify({ ...l, focus: undefined })}`).join('\n') +
      `\n\nWrite:\n- "hook": at most 10 words that open the video and make people stay;\n` +
      `- "lines": for each stretch, one sentence of at most 18 words about what the map shows by its end year, with a number;\n` +
      `- "outro": at most 12 words inviting people to explore every country themselves on TAKIP.\n` +
      `Return {"hook": "...", "lines": {${f.legs.map(l => `"${id(l.year)}": "..."`).join(', ')}}, "outro": "..."}.`,
      { check: v => (v.hook && v.outro && f.legs.every(l => v.lines?.[id(l.year)]?.trim()) ? null : 'need the hook, the outro and a line for every year id') }));

    // the line is about the year a leg ends on, so the clock gets there by mid-leg and waits
    const seek = (y0: number, y1: number) =>
      `{ const k = Math.min(1, p / ${ARRIVE}); const d = new Date(0); d.setUTCFullYear(Math.round(${y0} + ${y1 - y0} * k), 6, 1); __takipHistory.clock.seek(d.getTime()); }`;
    const fly = (key: string | null) => {
      const c = key ? names[key]?.at : null;
      return c ? `__takipMap.flyTo({ center: [${c[0]}, ${c[1]}], zoom: ${ZOOM}, duration: ${FLY_MS}, essential: true })` : undefined;
    };
    const legs: Beat[] = f.legs.map(l => ({
      id: id(l.year),
      say: lines.lines[id(l.year)],
      ...(l.projected && p.projection ? { title: p.projection.label } : {}),
      ...(fly(l.focus) ? { enter: fly(l.focus) } : {}),
      frame: seek(l.from, l.year),
      minMs: LEG_MS,
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
        { id: 'hook', card: 'hook', say: lines.hook, minMs: 2600 },
        ...legs,
        { id: 'outro', card: 'end', say: lines.outro },
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
