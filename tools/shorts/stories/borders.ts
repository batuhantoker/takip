/**
 * Borders through time over one region: History's world borders run as a time-lapse while the year counts on.
 * The words are written from what the border data itself holds at a few sampled years (which states are in view,
 * largest first), so the narration says nothing the map doesn't show.
 */
import { askJson } from '../narrate/llm';
import type { Beat } from '../scene';
import type { Maker } from './context';
import { viewBox } from './view';

/** Regions and spans worth a minute. Any other: --from, --to and --at lat,lon,zoom. */
const PRESETS: Record<string, { from: number; to: number; at: [number, number, number]; label: string }> = {
  ottoman: { from: 1300, to: 1923, at: [38.5, 33, 3.3], label: 'the Ottoman lands' },
  rome: { from: -500, to: 480, at: [40, 15, 3.1], label: 'the Mediterranean' },
  'europe-20th': { from: 1900, to: 2000, at: [50, 15, 3.3], label: 'Europe' },
  mongols: { from: 1180, to: 1400, at: [45, 85, 2.3], label: 'Asia' },
  americas: { from: 1450, to: 1900, at: [15, -80, 2.1], label: 'the Americas' },
  africa: { from: 1870, to: 1914, at: [3, 18, 2.4], label: 'Africa' },
  balkans: { from: 1800, to: 2000, at: [43, 21, 4.6], label: 'the Balkans' },
  china: { from: -221, to: 1950, at: [35, 105, 2.8], label: 'China' },
  india: { from: 1500, to: 1950, at: [22, 79, 3.3], label: 'the Indian subcontinent' },
  'middle-east': { from: 1900, to: 1950, at: [30, 42, 3.4], label: 'the Middle East' },
};
const SAMPLES = 5;
const LEG_MS = 6500;
/** Share of a leg spent travelling; the line describes where it arrives. */
const ARRIVE = 0.45;

type Polity = { id: number; name: string };
type Ring = [number, number][];
type Geometry = { type: 'Polygon'; coordinates: Ring[] } | { type: 'MultiPolygon'; coordinates: Ring[][] };

function inRing(ring: Ring, x: number, y: number) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const inPolygon = (rings: Ring[], x: number, y: number) => inRing(rings[0], x, y) && !rings.slice(1).some(h => inRing(h, x, y));
const covers = (g: Geometry, x: number, y: number) =>
  g.type === 'Polygon' ? inPolygon(g.coordinates, x, y) : g.coordinates.some(rings => inPolygon(rings, x, y));

const yearMs = (y: number) => {
  const d = new Date(0);
  d.setUTCFullYear(y, 6, 1);
  return d.getTime();
};
const roundYear = (y: number, span: number) => {
  const step = span > 1500 ? 50 : span > 400 ? 25 : span > 150 ? 10 : 5;
  return Math.round(y / step) * step;
};
const yearText = (y: number) => (y < 1 ? `${1 - y} BCE` : String(y));

/** The states on screen in a year, by how much of the view they cover (a grid of points), not by their whole size. */
async function inView(base: string, box: [number, number, number, number], zoom: number, year: number): Promise<Polity[]> {
  const t = Math.floor(yearMs(year) / 1000);
  const bbox = box.map(v => v.toFixed(2)).join(',');
  // the browser passes the API gate by Sec-Fetch-Site; so does this
  const res = await fetch(`${base}/api/replay/history/features/world-borders?bbox=${bbox}&z=${Math.round(zoom)}&from=${t}&to=${t + 86400}`, {
    headers: { 'Sec-Fetch-Site': 'same-origin' }, signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`borders for ${year}: ${res.status} ${await res.text()}`);
  const { features } = (await res.json()) as { features: { properties: Polity & { label?: number }; geometry: Geometry | { type: string } }[] };
  const shapes = features.filter(f => f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon');
  const [w, s, e, n] = box;
  const cover = new Map<number, { name: string; n: number }>();
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 14; j++) {
      const x = w + ((i + 0.5) * (e - w)) / 8, y = s + ((j + 0.5) * (n - s)) / 14;
      const hit = shapes.find(f => covers(f.geometry as Geometry, x, y));
      if (!hit) continue;
      const c = cover.get(hit.properties.id) ?? { name: hit.properties.name, n: 0 };
      c.n++;
      cover.set(hit.properties.id, c);
    }
  }
  return [...cover.entries()].sort((a, b) => b[1].n - a[1].n).map(([id, c]) => ({ id, name: c.name }));
}

const SYSTEM = `You write voiceover for short vertical videos where a historical map's borders change while a year counter runs.
A calm documentary narrator. Use only the facts given: the states in view at each year, by how much of the screen they cover. Never add dates,
wars, rulers or causes that are not given. Short, vivid sentences; no questions, no exclamation marks. Reply with JSON only.`;

export const borders: Maker = {
  id: 'borders',
  kind: 'story',
  presets: Object.keys(PRESETS),
  about: `Borders changing over a region (--preset ${Object.keys(PRESETS).join('|')}, or --from 1300 --to 1923 --at lat,lon,zoom)`,
  async make(ctx) {
    const preset = PRESETS[ctx.args.preset ?? ''];
    if (ctx.args.preset && !preset) throw new Error(`--preset must be one of ${Object.keys(PRESETS).join(', ')}`);
    const from = Number(ctx.args.from ?? preset?.from);
    const to = Number(ctx.args.to ?? preset?.to);
    const [lat, lon, zoom] = ctx.args.at?.split(',').map(Number) ?? preset?.at ?? [];
    if (![from, to, lat, lon, zoom].every(Number.isFinite) || to <= from) throw new Error('need --preset, or --from, --to and --at lat,lon,zoom');
    const region = ctx.args.label ?? preset?.label ?? 'this region';
    const years = Array.from({ length: SAMPLES }, (_, i) => (i === 0 ? from : i === SAMPLES - 1 ? to : roundYear(from + ((to - from) * i) / (SAMPLES - 1), to - from)));

    const states = await ctx.once('states', async () => {
      const box = viewBox(lat, lon, zoom);
      const out: Record<string, string[]> = {};
      for (const y of years) out[y] = (await inView(ctx.base, box, zoom, y)).slice(0, 6).map(p => p.name);
      return out;
    });
    const id = (y: number) => `y${y}`;
    const facts = years.map(y => `${yearText(y)}: ${states[y].join(', ') || 'no mapped states'}`).join('\n');

    const lines = await ctx.once('lines', () => askJson<{ hook: string; lines: Record<string, string>; outro: string }>(SYSTEM,
      `The map shows ${region} from ${yearText(from)} to ${yearText(to)}, a span of ${to - from} years. States in view, the most of the screen first:\n${facts}\n\n` +
      `Write:\n- "hook": at most 12 words that open the video and make people stay;\n` +
      `- "lines": for each year after the first, one or two sentences (at most 24 words) on what the map shows then, compared with the year before;\n` +
      `- "outro": at most 12 words inviting people to scrub through history themselves on TAKIP.\n` +
      `Return {"hook": "...", "lines": {${years.slice(1).map(y => `"${id(y)}": "..."`).join(', ')}}, "outro": "..."}.`,
      { check: v => (v.hook && v.outro && years.slice(1).every(y => v.lines?.[id(y)]?.trim()) ? null : 'need the hook, the outro and a line for every year id') }));

    // each leg eases the clock to its year in the first part, then holds there while the line about that year ends
    const seek = (y0: number, y1: number) =>
      `{ const k = Math.min(1, p / ${ARRIVE}); const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2; const d = new Date(0); d.setUTCFullYear(Math.round(${y0} + (${y1 - y0}) * e), 6, 1); __takipHistory.clock.seek(d.getTime()); }`;
    const legs: Beat[] = years.slice(1).map((y, i) => ({ id: id(y), say: lines.lines[id(y)], minMs: LEG_MS, frame: seek(years[i], y) }));

    return {
      id: `borders-${ctx.args.preset ?? `${from}-${to}`}`,
      kind: 'story',
      path: `/?view=history&year=${Math.max(-3000, from)}&layer=world-borders&lat=${lat}&lon=${lon}&zoom=${zoom}`,
      chrome: 'map-only',
      ready: 'window.__takipHistory && !__takipHistory.deep()',
      waitOn: '/api/replay/',
      setup: `(() => { __takipHistory.clock.pause(); const d = new Date(0); d.setUTCFullYear(${from}, 6, 1); __takipHistory.clock.seek(d.getTime()); __takipMap.jumpTo({ center: [${lon}, ${lat}], zoom: ${zoom} }); })()`,
      kicker: 'History',
      counter: { expr: 'new Date(__takipHistory.clock.time()).getUTCFullYear()', unit: '{n}', kind: 'year' },
      beats: [
        { id: 'hook', card: 'hook', say: lines.hook, minMs: 2500 },
        ...legs,
        { id: 'outro', card: 'end', say: lines.outro },
      ],
      sources: ['Borders: Cliopatria, Seshat Global History Databank (CC BY 4.0)', 'TAKIP'],
      post: {
        title: `${region[0].toUpperCase()}${region.slice(1)}, ${yearText(from)} to ${yearText(to)}, in under a minute`,
        description: `Every border in ${region} from ${yearText(from)} to ${yearText(to)}, from the Cliopatria dataset, on TAKIP's History map. Explore it yourself at takip.dev.`,
        hashtags: ['#TAKIP', '#History', '#HistoryMaps', '#Maps', '#Empires'],
      },
    };
  },
};
