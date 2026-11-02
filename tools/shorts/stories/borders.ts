/**
 * Borders through time over one region: History's world borders run as a time-lapse while the year counts on.
 * The words are written from what the border data itself holds at a few sampled years: which states are in view,
 * which are new and which are gone. No sizes or rankings, which read as territorial claims, so the narration says
 * nothing the map doesn't show.
 */
import { backToStart, isLong, lengthProblem, saidAs, loopBeats, shortHold, shortPace, wordsFor } from '../loop';
import { askJson } from '../narrate/llm';
import { STYLE } from '../narrate/style';
import type { Beat } from '../scene';
import type { Maker } from './context';
import { keepOutKinds } from './kept-out';
import { viewBox } from './view';

/** Regions and spans worth a minute. Any other: --from, --to and --at lat,lon,zoom. `region` keeps a region's story to
 *  the states whose part on screen mostly lies in it, not the neighbours at the frame's edge. */
/**
 * States never told, because their comings and goings are contested: Cliopatria draws Tibet with gaps, so it "vanishes"
 * and "returns" (in 1950, the year of the PRC's takeover), and Kosovo "appears" by 2000, under UN administration.
 */
const UNTOLD = new Set(['Tibet', 'Kosovo']);

/** `short` and `long`: a cut's years, where evenly spaced ones would miss the changes (a short span with one busy year). */
const PRESETS: Record<string, { from: number; to: number; at: [number, number, number]; label: string; region?: Region; short?: number[]; long?: number[] }> = {
  // the data ends the Ottoman Empire and starts the Republic of Turkey between mid-1923 and 1924
  ottoman: { from: 1300, to: 1923, at: [38.5, 33, 3.3], label: 'the Ottoman lands', long: [1300, 1425, 1550, 1675, 1800, 1924] },
  rome: { from: -500, to: 480, at: [40, 15, 3.1], label: 'the Mediterranean' },
  'europe-20th': { from: 1900, to: 2000, at: [50, 15, 3.3], label: 'Europe', region: 'europe' },
  mongols: { from: 1180, to: 1400, at: [45, 85, 2.3], label: 'Asia' },
  americas: { from: 1450, to: 1900, at: [15, -80, 2.1], label: 'the Americas' },
  africa: { from: 1870, to: 1914, at: [3, 18, 2.4], label: 'Africa', region: 'africa' },
  balkans: { from: 1800, to: 2000, at: [43, 21, 4.6], label: 'the Balkans' },
  china: { from: -221, to: 1950, at: [35, 105, 2.8], label: 'China' },
  india: { from: 1500, to: 1950, at: [22, 79, 3.3], label: 'the Indian subcontinent' },
  'middle-east': { from: 1900, to: 1950, at: [30, 42, 3.4], label: 'the Middle East' },
  'soviet-union': { from: 1914, to: 1995, at: [55, 70, 2.2], label: 'the lands of the Soviet Union', region: 'north-eurasia' },
  // the data moves in 1990, 1991 and 1992, then Kosovo and Montenegro
  'central-europe-90s': { from: 1980, to: 2000, at: [50, 18, 4.4], label: 'Central and Eastern Europe', region: 'europe', long: [1980, 1990, 1991, 1992, 2000, 2006] },
  // no region: the Almoravids and Almohads ruled much of the peninsula from Morocco
  iberia: { from: 700, to: 1500, at: [40, -4, 4.6], label: 'the Iberian Peninsula' },
  // ends in 1991: on 1 July 1990 there were still two German states
  germany: { from: 1800, to: 1991, at: [51, 10.5, 4.6], label: 'Germany', region: 'europe' },
  'africa-independence': { from: 1950, to: 1980, at: [3, 18, 2.4], label: 'Africa', region: 'africa' },
  'latin-america-independence': { from: 1800, to: 1840, at: [-5, -70, 2.2], label: 'Latin America' },
  'southeast-asia': { from: 1800, to: 2000, at: [8, 112, 3.2], label: 'Southeast Asia', region: 'southeast-asia' },
  'east-asia': { from: 1850, to: 2000, at: [35, 122, 3], label: 'East Asia', region: 'east-asia' },
  scandinavia: { from: 1500, to: 1950, at: [63, 17, 3.3], label: 'Scandinavia' },
  // Cliopatria draws Bangladesh from about 1972, so the last sample waits for it
  'south-asia-partition': { from: 1940, to: 1975, at: [24, 80, 3.6], label: 'South Asia', region: 'south-asia' },
  'north-america': { from: 1750, to: 1900, at: [45, -100, 2.4], label: 'North America' },
  'early-caliphates': { from: 600, to: 1000, at: [30, 20, 2.4], label: 'the Middle East and North Africa', region: 'mena' },
  // the Warring States, the shoguns' peace, the empire
  japan: { from: 1450, to: 1890, at: [36, 136, 4.2], label: 'Japan', short: [1450, 1550, 1650, 1890], long: [1450, 1500, 1600, 1650, 1890] },
  // there, partitioned away, back
  poland: { from: 1500, to: 1925, at: [52, 20, 4.6], label: 'Poland', region: 'europe', short: [1500, 1700, 1800, 1925] },
  baltic: { from: 1550, to: 1995, at: [57.5, 24, 4.6], label: 'the Baltic' },
  caucasus: { from: 1500, to: 2000, at: [42, 44.5, 4.8], label: 'the Caucasus' },
  // the Achaemenids, the Sasanians, the Safavids, the Pahlavis
  persia: { from: -400, to: 1950, at: [32, 53, 3.6], label: 'Persia', region: 'iran', short: [-400, 400, 1600, 1950] },
  arabia: { from: 1900, to: 1975, at: [23, 46, 3.8], label: 'Arabia', region: 'arabia' },
  'ancient-greece': { from: -550, to: -100, at: [38.5, 23.5, 5], label: 'Greece', region: 'aegean' },
  mesoamerica: { from: 1300, to: 1600, at: [18, -95, 4], label: 'Mesoamerica' },
  andes: { from: 1400, to: 1600, at: [-12, -73, 3.8], label: 'the Andes', short: [1400, 1480, 1540, 1600] },
  'west-africa': { from: 700, to: 1600, at: [14, -5, 3.6], label: 'West Africa', region: 'west-africa' },
};
/** Sampled years and their length: the short loop (20–25 s), or `--length long`; a short's legs fill its body (loop.ts shortHold). */
const CUTS = { short: { samples: 5, legMs: 4000, seconds: 22 }, long: { samples: 6, legMs: 6500, seconds: 50 } };
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
/** Africa, roughly along its coasts (lon, lat): Sinai in, Arabia, Crete and Malta out. */
const AFRICA: Ring = [[-20, 36], [-5.6, 36], [-2, 35.4], [10, 37.6], [11.6, 37.2], [11.6, 33.6], [20, 32.4], [25, 32.4], [32, 31.6],
  [34.5, 31.6], [35, 29.4], [43.6, 12.6], [52, 12.2], [52, -36], [-20, -36]];
/** South Asia below the Himalaya, Afghanistan in, Burma out. */
const SOUTH_ASIA: Ring = [[60, 25], [61, 31], [61, 36], [67, 38], [74.5, 37.5], [75.5, 36], [78, 35.5], [79, 32.5], [81, 30.3], [88, 28],
  [92.4, 28], [92.4, 20], [89, 21], [82.5, 5], [72, 5], [66, 23]];
/** Iran and Afghanistan: Mesopotamia, Anatolia, the Caucasus and the Indus out. */
const IRAN: Ring = [[44.8, 39.5], [48, 38.5], [54, 37.8], [61, 37], [67, 37.5], [71, 36.5], [71.5, 34.5], [69.5, 33.5], [69, 31.5],
  [66.5, 29.8], [64, 29.4], [61, 29.6], [61.8, 27], [63.2, 25.3], [57, 25.5], [56, 27], [52, 27.3], [50, 29.5], [48.5, 30], [47.5, 31.2],
  [46, 33], [45.4, 34.5], [44.8, 37]];
/** The peninsula with Jordan, Syria and Iraq below the Zagros: the Levant coast, Sinai, Anatolia and Iran out. */
const ARABIA: Ring = [[36.2, 32.3], [36.8, 35.5], [37.5, 36.9], [42, 37.2], [44.8, 35.5], [46, 33.2], [47.7, 30.5], [50, 29], [56.5, 27],
  [60, 22.5], [52, 15], [43.4, 12.5], [40, 15.5], [36.5, 22], [34.8, 28.2], [35.6, 29.5]];
type Region = 'africa' | 'europe' | 'north-eurasia' | 'southeast-asia' | 'east-asia' | 'south-asia' | 'iran' | 'arabia' | 'west-africa' | 'mena' | 'aegean';
const REGIONS: Record<Region, (x: number, y: number) => boolean> = {
  africa: (x, y) => inRing(AFRICA, x, y),
  europe: (x, y) => y > 34 && !inRing(AFRICA, x, y),
  // the Soviet lands without the Middle East and South Asia at the frame's southern edge
  'north-eurasia': (x, y) => y >= 40 && x >= 20,
  // below South China and Taiwan, above Australia
  'southeast-asia': (x, y) => x >= 92 && x <= 141 && y >= -11 && y <= 23,
  // below Siberia, above Indochina and the Philippines
  'east-asia': (x, y) => x >= 73 && y >= 21.5 && y <= 50,
  'south-asia': (x, y) => inRing(SOUTH_ASIA, x, y),
  iran: (x, y) => inRing(IRAN, x, y),
  arabia: (x, y) => inRing(ARABIA, x, y),
  // the Sahel and the coast, without the Maghreb
  'west-africa': (x, y) => inRing(AFRICA, x, y) && y <= 24,
  // the caliphates' lands with al-Andalus, Sicily and Crete; not Christian Iberia, Italy, the Balkans or the steppe
  mena: (x, y) => y >= 18 && y <= 43.5 && (x >= 26 || inRing(AFRICA, x, y) || y <= (x < 4 ? 40.5 : 38.5)),
  // Greece and the Aegean down to Crete, without Egypt and Cyrenaica at the frame's foot
  aegean: (x, y) => y >= 34.5,
};

/** Where a shape mostly lies: its outer rings' centroid, weighted by area. */
function centroid(g: Geometry): [number, number] | null {
  let a = 0, cx = 0, cy = 0;
  for (const rings of g.type === 'Polygon' ? [g.coordinates] : g.coordinates) {
    const ring = rings[0];
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const cross = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
      a += cross;
      cx += (ring[j][0] + ring[i][0]) * cross;
      cy += (ring[j][1] + ring[i][1]) * cross;
    }
  }
  return a ? [cx / (3 * a), cy / (3 * a)] : null;
}

/** Whether a shape mostly lies in a region, judged by its centroid. */
export function regionOf(region: Region, g: Geometry) {
  const c = centroid(g);
  return !!c && REGIONS[region](c[0], c[1]);
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
  // a short span in five-year steps can round two samples onto one year
  const step = span > 1500 ? 50 : span > 400 ? 25 : span > 150 ? 10 : span > 40 ? 5 : 2;
  return Math.round(y / step) * step;
};
const yearText = (y: number) => (y < 1 ? `${1 - y} BCE` : String(y));

/** The view is sampled on a grid; a state is named when it covers at least 5% of it, and smaller ones are only counted. */
const GRID: [number, number] = [24, 42];
const NOTABLE = 0.05;
/** A state gone and a new one covering much the same ground, at a similar size, are one state under a new name. */
const RENAMED = 0.6;

/** The states on screen in a year: every one the view holds, and those covering a notable part of it, alphabetical. */
type Presence = { all: string[]; notable: string[]; cells: Record<string, number[]> };

export async function inView(base: string, box: [number, number, number, number], zoom: number, year: number, region?: Region): Promise<Presence> {
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
  const [gx, gy] = GRID;
  const cells: Record<string, number[]> = {};
  const shown: Record<string, [number, number][]> = {};
  for (let i = 0; i < gx; i++) {
    for (let j = 0; j < gy; j++) {
      const x = w + ((i + 0.5) * (e - w)) / gx, y = s + ((j + 0.5) * (n - s)) / gy;
      const hit = shapes.find(f => covers(f.geometry as Geometry, x, y));
      if (hit) {
        (cells[hit.properties.name] ??= []).push(i * gy + j);
        (shown[hit.properties.name] ??= []).push([x, y]);
      }
    }
  }
  // the query returns whole tiles, which reach past the frame (Tokugawa Japan in a Southeast Asia story): a state counts
  // where it shows, by its part on screen; one too small for the grid, by its centre
  const belongs = (f: (typeof shapes)[number]) => {
    const pts = shown[f.properties.name];
    if (!pts) {
      const c = centroid(f.geometry as Geometry);
      return !!c && c[0] >= w && c[0] <= e && c[1] >= s && c[1] <= n && (!region || REGIONS[region](c[0], c[1]));
    }
    return !region || pts.filter(([x, y]) => REGIONS[region](x, y)).length * 2 > pts.length;
  };
  const kept = new Set(shapes.filter(belongs).map(f => f.properties.name));
  for (const name of Object.keys(cells)) if (!kept.has(name)) delete cells[name];
  const abc = (names: string[]) => [...new Set(names)].sort((a, b) => a.localeCompare(b));
  const notable = Object.entries(cells).filter(([, c]) => c.length >= NOTABLE * gx * gy).map(([name]) => name);
  return { all: abc([...kept]), notable: abc(notable), cells };
}

/**
 * Every state on the map anywhere in a year: one that only left the frame still exists, so it isn't told as gone (the
 * Ottoman Empire left the Balkans by 1920 but lasted to 1922).
 */
export async function worldNames(base: string, year: number): Promise<string[]> {
  const t = Math.floor(yearMs(year) / 1000);
  const res = await fetch(`${base}/api/replay/history/features/world-borders?bbox=-180,-85,180,85&z=1&from=${t}&to=${t + 86400}`, {
    headers: { 'Sec-Fetch-Site': 'same-origin' }, signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`world borders for ${year}: ${res.status} ${await res.text()}`);
  const { features } = (await res.json()) as { features: { properties: Polity }[] };
  return [...new Set(features.map(f => f.properties.name))].sort();
}

/** Words that say what kind of state it is, not which: two names sharing only these are not one state renamed. */
const KINDS = new Set(['kingdom', 'empire', 'republic', 'republics', 'dynasty', 'state', 'states', 'sultanate', 'caliphate', 'federal',
  'socialist', 'people', 'peoples', 'union', 'democratic', 'united', 'islamic', 'colonial', 'khanate', 'principality', 'grand', 'duchy',
  'first', 'second', 'third', 'fourth', 'fifth', 'great', 'imperial', 'emirate', 'imamate', 'protectorate', 'mandate', 'territory',
  'colony', 'confederation', 'commonwealth', 'federation', 'free', 'city', 'international', 'zone', 'western', 'eastern', 'northern', 'southern']);
/** A part's qualifier ("Eastern Roman Empire"): kept when asking whether a new name adds a word, so a split isn't a rename. */
const SIDES = new Set(['western', 'eastern', 'northern', 'southern']);
const sided = (name: string) => new Set(name.toLowerCase().normalize('NFD').replace(/[^a-z\s]/g, ' ').split(/\s+/)
  .filter(w => w.length >= 5 && (SIDES.has(w) || !KINDS.has(w))).map(w => w.slice(0, 5)));
const stems = (name: string) => new Set(name.toLowerCase().normalize('NFD').replace(/[^a-z\s]/g, ' ').split(/\s+/)
  .filter(w => w.length >= 5 && !KINDS.has(w)).map(w => w.slice(0, 5)));

/**
 * Pairs of a state gone and a new one that cover much the same cells at a similar size and share a name's root
 * (Kingdom of Portugal, Portuguese Republic): a rename, not an ending. Ground alone would call a successor a rename,
 * since the sampled years are decades or centuries apart.
 */
export function renames(before: Presence, after: Presence, gone: string[], added: string[]): [string, string][] {
  const out: [string, string][] = [];
  const taken = new Set<string>();
  for (const g of gone) {
    const a = new Set(before.cells[g] ?? []);
    if (a.size < 3) continue;
    const root = stems(g);
    const old = sided(g);
    const best = added.filter(n => !taken.has(n) && [...stems(n)].some(w => root.has(w))).map(n => {
      const b = after.cells[n] ?? [];
      const both = b.filter(c => a.has(c)).length;
      // a state that grew or shrank as it changed its name (the Roman Republic, the Tsardom of Russia) overlaps the larger
      // footprint too little; it still counts when the new name adds no word of its own, so the Eastern Roman Empire stays new
      const same = [...sided(n)].every(w => old.has(w));
      return { n, share: Math.max(both / Math.max(a.size, b.length), same ? both / Math.max(1, Math.min(a.size, b.length)) : 0) };
    }).sort((x, y) => y.share - x.share)[0];
    if (best && best.share >= RENAMED) {
      out.push([g, best.n]);
      taken.add(best.n);
    }
  }
  return out;
}

/** Words that rank states or talk about the screen: they read as territorial claims, or say what the map doesn't. */
/** Counting states: the frame never holds a whole continent, so a count is a claim about the region it can't back. */
const COUNTED = /\b(\d+|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\w+teen|twenty|thirty|forty|fifty|dozens?)(-\w+)?\s+(\w+\s+)?(states|countries|kingdoms|empires|nations)\b/i;
const RANKING = /\b(cover(s|ed|ing)?|dominat\w*|lead(s|ing)?|the lead|larg\w*|bigg\w*|small\w*|more of|most of|grow\w*|shrink\w*|swell\w*|rise[sn]?|rising|behind it|screen|frame|in view|join\w*|absorb\w*|annex\w*|conquer\w*|swallow\w*|seiz\w*|take[sn]? over|took over)\b/i;
const GONE = /\b(gone|no longer|disappear\w*|vanish\w*|leaves?|left|exits?)\b/i;

/** Why a line set breaks the rules, or null: no rankings, each line names its year, and a state is gone only if the data says so. */
/** Words that tell a state as new: "appears", "arrives", "is new", "emerges". */
const APPEARS = /\b(appear\w*|arriv\w*|new|emerg\w*|born|founded|shows? up)\b/i;

export function bordersProblem(v: { hook: string; lines: Record<string, string>; outro: string }, legs: { id: string; year: string; gone: string[]; left?: string[]; entered?: string[] }[]) {
  for (const [what, text] of [['hook', v.hook], ['outro', v.outro], ...legs.map(l => [l.id, v.lines[l.id] ?? ''])]) {
    const counted = text.match(COUNTED);
    if (counted) return `"${what}" says "${counted[0]}": don't count states, the frame doesn't hold the whole region`;
    const bad = text.match(RANKING);
    if (bad) return `"${what}" says "${bad[0]}": say only which states are on the map, new or gone, never sizes, rankings, the screen, or one state joining or taking another`;
  }
  for (const l of legs) {
    const line = v.lines[l.id];
    if (!line.includes(l.year)) return `"${l.id}" must name its year, ${l.year}`;
    // by a name's root, so "the Soviet Union" counts for the data's "Union of Soviet Socialist Republics"
    const said = stems(line);
    const names = (n: string) => line.includes(n) || [...stems(n)].some(w => said.has(w));
    if (GONE.test(line) && !l.gone.some(names)) return `"${l.id}" says a state is gone, but only ${l.gone.join(', ') || 'none'} are gone in ${l.year}`;
    const out = GONE.test(line) && !/\bout of\b/i.test(line) && (l.left ?? []).find(names);
    if (out) return `"${l.id}" calls ${out} gone, but it still exists elsewhere in ${l.year}: say it is out of the region, or leave it out`;
    // by the whole name: a root would take "New France" for the Kingdom of France
    const came = APPEARS.test(line) && !/\breach\w*/i.test(line) && (l.entered ?? []).find(n => line.toLowerCase().includes(n.toLowerCase()));
    if (came) return `"${l.id}" tells ${came} as new, but it existed elsewhere before: say it reaches the region, or leave it out`;
  }
  return null;
}

const SYSTEM = `You write voiceover for short vertical videos where a historical map's borders change while a year counter runs.
A calm documentary narrator. Use only the facts given: which states are on the map at each year, which are new and which are gone.
Never compare states' sizes or territory, never rank them, never count them, never say one joins, absorbs or takes another, and never
mention the screen or the frame. A renamed state is the same state under a new name: say it is now called that, never that it is gone.
A state listed as out of the region still exists elsewhere: never call it gone; say it is out of the region, or leave it out.
A state listed as reaching the region existed elsewhere before: never say it appears or is new; say it reaches the region, or
leave it out. Never add dates, wars, rulers or causes that are not given. ${STYLE}
Reply with JSON only.`;

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
    const cut = CUTS[isLong(ctx.args) ? 'long' : 'short'];
    const sampled = (isLong(ctx.args) ? preset?.long : preset?.short)
      ?? [...new Set(Array.from({ length: cut.samples }, (_, i) => (i === 0 ? from : i === cut.samples - 1 ? to : roundYear(from + ((to - from) * i) / (cut.samples - 1), to - from))))];
    // a folder written before the cut's sampling changed keeps the years its lines tell
    const written = ctx.peek<{ lines: Record<string, string> }>('lines');
    const years = written ? [sampled[0], ...Object.keys(written.lines).map(k => Number(k.slice(1)))] : sampled;
    const end = years[years.length - 1];

    const area = preset?.region;
    // "frame": states by their part on screen (cache.cells* counted every tile the query returned)
    const box = viewBox(lat, lon, zoom);
    const frameKey = area ? `frame-${area}` : 'frame';
    const states = await ctx.once(frameKey, async () => {
      const out: Record<string, Presence> = {};
      for (const y of years) out[y] = await inView(ctx.base, box, zoom, y, area);
      return out;
    });
    const world = await ctx.once('world', async () => {
      const out: Record<string, string[]> = {};
      for (const y of years) out[y] = await worldNames(ctx.base, y);
      return out;
    });
    // a cache made for other years gets the ones this cut tells
    const missing = years.filter(y => !states[y] || !world[y]);
    for (const y of missing) {
      states[y] ??= await inView(ctx.base, box, zoom, y, area);
      world[y] ??= await worldNames(ctx.base, y);
    }
    if (missing.length) {
      ctx.keep(frameKey, states);
      ctx.keep('world', world);
    }
    const id = (y: number) => `y${y}`;
    // new and gone from everything in view, so a state that only got smaller is never called gone, and gone only where it
    // ended everywhere: one that only left the frame is out of the region
    const legs = years.slice(1).map((y, i) => {
      const before = new Set(states[years[i]].all), now = new Set(states[y].all);
      const added = states[y].all.filter(n => !before.has(n) && !UNTOLD.has(n)), lost = states[years[i]].all.filter(n => !now.has(n) && !UNTOLD.has(n));
      const elsewhere = new Set(world[y]);
      const gone = lost.filter(n => !elsewhere.has(n)), left = lost.filter(n => elsewhere.has(n));
      // the mirror: a state that only came into the frame (the Russian Empire into a Japan story) already existed
      const existed = new Set(world[years[i]]);
      const born = added.filter(n => !existed.has(n)), entered = added.filter(n => existed.has(n));
      const renamed = renames(states[years[i]], states[y], gone, born);
      return {
        id: id(y), year: yearText(y), since: yearText(years[i]), renamed, left, entered,
        new: born.filter(n => !renamed.some(r => r[1] === n)), gone: gone.filter(g => !renamed.some(r => r[0] === g)),
      };
    });
    const named = (y: number) => {
      const all = states[y].all.filter(n => !UNTOLD.has(n)), notable = states[y].notable.filter(n => !UNTOLD.has(n));
      return `${notable.join(', ') || 'no mapped states'}${all.length > notable.length ? ` (and ${all.length - notable.length} more)` : ''}`;
    };
    const facts = [`${yearText(years[0])}: on the map: ${named(years[0])}`, ...legs.map((l, i) =>
      `${l.year}: on the map: ${named(years[i + 1])}; new since ${l.since}: ${l.new.join(', ') || 'none'}; gone since ${l.since}: ${l.gone.join(', ') || 'none'}` +
      (l.left.length ? `; out of ${region} since ${l.since} but still on the map elsewhere: ${l.left.join(', ')}` : '') +
      (l.entered.length ? `; reaching ${region} since ${l.since}, on the map elsewhere before: ${l.entered.join(', ')}` : '') +
      (l.renamed.length ? `; renamed since ${l.since} (the same state under a new name): ${l.renamed.map(([a, b]) => `${a} is now ${b}`).join(', ')}` : ''))].join('\n');

    const legMs = shortPace(ctx.args) ? shortHold(years.length - 1, CUTS.short.legMs) : cut.legMs;
    const words = wordsFor(legMs);
    const lines = await ctx.once('lines', () => askJson<{ lines: Record<string, string> }>(SYSTEM,
      `The map shows ${region} from ${yearText(from)} to ${yearText(to)}, a span of ${to - from} years. States on the map, alphabetical:\n${facts}\n\n` +
      `Write (the video is about ${cut.seconds} seconds):\n` +
      `- "lines": for each year after the first, one or two short sentences of ${saidAs(words)}, naming that year and leading with its ` +
      `most striking change, which states are new or gone; call a state gone only if it is listed as gone.\n` +
      `Return {"lines": {${years.slice(1).map(y => `"${id(y)}": "..."`).join(', ')}}}.`,
      { check: v => (legs.every(l => v.lines?.[l.id]?.trim()) ? bordersProblem({ hook: '', lines: v.lines, outro: '' }, legs) ?? lengthProblem(v.lines, words) : 'need a line for every year id') }));
    const { hook, outro } = await loopBeats(ctx, { topic: `the borders of ${region} from ${yearText(from)} to ${yearText(to)}`, lines: years.slice(1).map(y => lines.lines[id(y)]),
      check: e => bordersProblem({ hook: e.hook, lines: {}, outro: e.outro }, []) });

    // each leg eases the clock to its year in the first part, then holds there while the line about that year ends
    const seek = (y0: number, y1: number) =>
      `{ const k = Math.min(1, p / ${ARRIVE}); const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2; const d = new Date(0); d.setUTCFullYear(Math.round(${y0} + (${y1 - y0}) * e), 6, 1); __takipHistory.clock.seek(d.getTime()); }`;
    const beats: Beat[] = years.slice(1).map((y, i) => ({ id: id(y), say: lines.lines[id(y)], minMs: legMs, frame: seek(years[i], y) }));

    return {
      id: `borders-${ctx.args.preset ?? `${from}-${to}`}`,
      kind: 'story',
      path: `/?view=history&year=${Math.max(-3000, from)}&layer=world-borders&lat=${lat}&lon=${lon}&zoom=${zoom}`,
      chrome: 'map-only',
      ready: 'window.__takipHistory && !__takipHistory.deep()',
      waitOn: '/api/replay/',
      // the default conflict events would include massacres, which no short draws
      setup: `(() => { __takipHistory.clock.pause(); const d = new Date(0); d.setUTCFullYear(${from}, 6, 1); __takipHistory.clock.seek(d.getTime()); ${keepOutKinds()} __takipMap.jumpTo({ center: [${lon}, ${lat}], zoom: ${zoom} }); })()`,
      kicker: 'History',
      counter: { expr: 'new Date(__takipHistory.clock.time()).getUTCFullYear()', unit: '{n}', kind: 'year' },
      beats: [
        hook,
        ...beats,
        // back to the first year, so the loop's last frame meets its first
        { ...outro, enter: backToStart(`(() => { const d = new Date(0); d.setUTCFullYear(${from}, 6, 1); __takipHistory.clock.seek(d.getTime()); })()`) },
      ],
      sources: ['Borders: Cliopatria, Seshat Global History Databank (CC BY 4.0)', 'TAKIP'],
      post: {
        title: `${region[0].toUpperCase()}${region.slice(1)}, ${yearText(from)} to ${yearText(end)}, in under a minute`,
        description: `Every border in ${region} from ${yearText(from)} to ${yearText(end)}, from the Cliopatria dataset, on TAKIP's History map. Explore it yourself at takip.dev.`,
        hashtags: ['#TAKIP', '#History', '#HistoryMaps', '#Maps', '#Empires'],
      },
    };
  },
};
