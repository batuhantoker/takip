import { familyOf, GDELT_FAMILIES, type GdeltFamily } from './cameo';
import { GeoType, type GdeltEventRow, type GdeltMentionRow } from './parse';
import { outletOf, slugHeadline, slugWords, topicWords, urlWords } from './slug';

/**
 * TAKIP — turns GDELT exports and mentions into map markers, one per story.
 *
 * Folding by place alone mixed unrelated articles: GDELT pins "Texas" or "Washington" on anything it
 * reads there. So articles at a place join only when their slugs share two topic words, or when GDELT
 * matched them to the same event (the Mentions files) and their slugs agree on one. A story needs
 * two distinct headlines from two outlets, and takes its family from its own events. When none of a
 * story's URLs name the place GDELT gave it, it moves to one they do name: another of its own
 * places, or a place seen elsewhere in the input whose city and region or country they both name.
 */

export type GdeltPrecision = 'city' | 'region';

// Country centroids (type 1) and unplaced rows pile up in one spot per country, so they get no marker.
const PRECISION: Partial<Record<number, GdeltPrecision>> = {
  [GeoType.usCity]: 'city',
  [GeoType.worldCity]: 'city',
  [GeoType.usState]: 'region',
  [GeoType.worldState]: 'region',
};

export interface GdeltLink {
  url: string;
  outlet: string;
  /** From the URL's slug; null when it has none. */
  title: string | null;
}

export interface GdeltMarker {
  /** The headline event's GLOBALEVENTID. */
  id: string;
  family: GdeltFamily;
  precision: GdeltPrecision;
  lat: number;
  lng: number;
  place: string;
  country: string;
  /** Distinct headlines: syndicated copies count once. */
  reports: number;
  outlets: number;
  /** Article URLs, syndicated copies included. */
  articles: number;
  /** CAMEO rows behind the story. */
  events: number;
  /** The most widely reported row of the story. */
  headline: GdeltEventRow;
  /** One link per headline, originals first, at most six. */
  links: GdeltLink[];
  /** Other stories at this place and family, at most three. */
  others: (GdeltLink & { reports: number })[];
  firstSeen: number;
  lastSeen: number;
}

export interface ReduceOptions {
  families?: readonly GdeltFamily[];
  /** Mentions below this confidence (10–100) link nothing. */
  minConfidence?: number;
  /** Distinct headlines a story needs; 1 keeps single reports. */
  minReports?: number;
  limit?: number;
}

export interface GdeltReduction {
  markers: GdeltMarker[];
  stats: { rows: number; mentions: number; articles: number; stories: number; markers: number };
}

interface Article {
  url: string;
  outlet: string;
  topics: Set<string>;
  rows: GdeltEventRow[];
  seen: number;
}

interface Group {
  first: GdeltEventRow;
  articles: Map<string, Article>;
  edges: [string, string][];
}

interface Story {
  articles: Article[];
  family: GdeltFamily;
  /** The row whose place the story is shown at. */
  at: GdeltEventRow;
}

const headlineKey = (a: Article) => slugWords(a.url).join(' ') || a.url;
const reportsIn = (as: readonly Article[]) => new Set(as.map(headlineKey)).size;
const outletsIn = (as: readonly Article[]) => new Set(as.map(a => a.outlet)).size;

function article(g: Group, url: string, at: number): Article {
  let a = g.articles.get(url);
  if (!a) g.articles.set(url, (a = { url, outlet: outletOf(url), topics: topicWords(url, g.first.place), rows: [], seen: at }));
  else if (at < a.seen) a.seen = at;
  return a;
}

const shared = (a: Set<string>, b: Set<string>, enough: number) => {
  let n = 0;
  for (const w of a) if (b.has(w) && ++n === enough) return true;
  return false;
};

/** Union-find over one group's articles. */
function cluster(g: Group, generic: ReadonlySet<string>): Article[][] {
  const list = [...g.articles.values()];
  const index = new Map(list.map((a, i) => [a.url, i]));
  const parent = list.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const join = (i: number, j: number) => { parent[find(i)] = find(j); };

  const topics = list.map(a => new Set([...a.topics].filter(w => !generic.has(w))));
  // GDELT matches events by actors, verb and place, so "US consults US" ties together hundreds of
  // unrelated articles: a mention counts only when the two slugs agree on a word.
  for (const [a, b] of g.edges) {
    const i = index.get(a)!;
    const j = index.get(b)!;
    if (shared(topics[i], topics[j], 1)) join(i, j);
  }
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) if (shared(topics[i], topics[j], 2)) join(i, j);
  }

  const byRoot = new Map<number, Article[]>();
  list.forEach((a, i) => {
    const root = find(i);
    const c = byRoot.get(root);
    if (c) c.push(a);
    else byRoot.set(root, [a]);
  });
  return [...byRoot.values()];
}

const placeKey = (r: GdeltEventRow) => `${r.country}:${r.featureId}`;

const PLACE_FILLER = new Set(
  'city general united states kingdom republic state province county district region misto oblast gorod estado north south east west central new san saint'.split(' '),
);

const nameWords = (part: string) => part.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(w => w.length > 2 && !PLACE_FILLER.has(w));

/** How many of the articles name the place in their URL. */
function support(r: GdeltEventRow, words: readonly Set<string>[]): number {
  const names = nameWords(r.place);
  return words.filter(ws => names.some(n => ws.has(n))).length;
}

/**
 * Support for a place named in full: every word of its city and a word of its region or country.
 * More parts named ranks first, so Guadalajara, Jalisco, Mexico beats a village called Jalisco.
 */
function fullSupport(r: GdeltEventRow, words: readonly Set<string>[], all: ReadonlySet<string>): number {
  const [city = '', ...rest] = r.place.split(', ');
  const cityWords = nameWords(city);
  if (!cityWords.length || !cityWords.every(w => all.has(w))) return 0;
  const parts = rest.filter(part => nameWords(part).some(w => all.has(w))).length;
  if (!parts) return 0;
  return parts * 1000 + words.filter(ws => cityWords.some(w => ws.has(w))).length;
}

/** GDELT's translated feed can put a Jalisco protest in London: trust the place only if a URL names it. */
function placeOf(
  as: readonly Article[],
  current: GdeltEventRow,
  rowsByUrl: ReadonlyMap<string, GdeltEventRow[]>,
  places: Iterable<GdeltEventRow>,
): GdeltEventRow {
  const words = as.map(a => urlWords(a.url));
  if (support(current, words) > 0) return current;
  // One URL naming a place is not enough: US stories rarely name their state, and a passing mention would win.
  let best = current;
  let bestSupport = 1;
  for (const r of as.flatMap(a => rowsByUrl.get(a.url) ?? [])) {
    const s = support(r, words);
    if (s > bestSupport) [best, bestSupport] = [r, s];
  }
  if (best !== current) return best;
  const all = new Set(words.flatMap(ws => [...ws]));
  bestSupport = 0;
  for (const r of places) {
    const s = fullSupport(r, words, all);
    if (s % 1000 >= 2 && s > bestSupport) [best, bestSupport] = [r, s];
  }
  return best;
}

const SEVERITY: GdeltFamily[] = ['violence', 'protest', 'tension'];

/** The most severe family with a quarter of the story's events, else the most common one. */
function familyOfStory(rows: readonly GdeltEventRow[]): GdeltFamily {
  const counts = new Map<GdeltFamily, number>();
  for (const r of rows) counts.set(familyOf(r.rootCode), (counts.get(familyOf(r.rootCode)) ?? 0) + 1);
  const severe = SEVERITY.find(f => (counts.get(f) ?? 0) >= rows.length / 4);
  return severe ?? [...counts].sort((a, b) => b[1] - a[1])[0][0];
}

function links(as: readonly Article[], max: number): GdeltLink[] {
  const seen = new Set<string>();
  const out: GdeltLink[] = [];
  // GDELT's own source article first, then whoever reported it next.
  for (const a of [...as].sort((x, y) => Number(y.rows.length > 0) - Number(x.rows.length > 0) || x.seen - y.seen)) {
    const key = headlineKey(a);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ url: a.url, outlet: a.outlet, title: slugHeadline(a.url) });
    if (out.length === max) break;
  }
  return out;
}

export function reduceEvents(
  input: { events: readonly GdeltEventRow[]; mentions?: readonly GdeltMentionRow[] },
  opts: ReduceOptions = {},
): GdeltReduction {
  const families = new Set(opts.families ?? GDELT_FAMILIES);
  const minConfidence = opts.minConfidence ?? 50;
  const minReports = opts.minReports ?? 2;
  const mentions = input.mentions ?? [];

  const groups = new Map<string, Group>();
  const eventAt = new Map<string, { group: Group; url: string }>();
  const rowsByUrl = new Map<string, GdeltEventRow[]>();
  for (const r of input.events) {
    if (!PRECISION[r.geoType] || !r.url || !Number.isFinite(r.lat) || !Number.isFinite(r.lng) || (r.lat === 0 && r.lng === 0)) continue;
    const key = placeKey(r);
    let g = groups.get(key);
    if (!g) groups.set(key, (g = { first: r, articles: new Map(), edges: [] }));
    article(g, r.url, r.added).rows.push(r);
    eventAt.set(r.id, { group: g, url: r.url });
    const byUrl = rowsByUrl.get(r.url);
    if (byUrl) byUrl.push(r);
    else rowsByUrl.set(r.url, [r]);
  }

  for (const m of mentions) {
    // Type 1 is the open web; the rest are citations and archives.
    if (m.type !== 1 || m.confidence < minConfidence) continue;
    const e = eventAt.get(m.eventId);
    if (!e || m.url === e.url) continue;
    article(e.group, m.url, m.at);
    e.group.edges.push([e.url, m.url]);
  }

  // Words found at many places ("trump", "police", "man") say nothing about which story an article tells.
  const spread = new Map<string, number>();
  for (const g of groups.values()) {
    const words = new Set<string>();
    for (const a of g.articles.values()) for (const w of a.topics) words.add(w);
    for (const w of words) spread.set(w, (spread.get(w) ?? 0) + 1);
  }
  const genericAt = Math.max(20, groups.size * 0.03);
  const generic = new Set([...spread].filter(([, n]) => n > genericAt).map(([w]) => w));

  const candidates: { group: Group; articles: Article[] }[] = [];
  for (const group of groups.values()) for (const articles of cluster(group, generic)) candidates.push({ group, articles });
  candidates.sort((a, b) => reportsIn(b.articles) - reportsIn(a.articles) || b.articles.length - a.articles.length);

  const places = [...groups.values()].map(g => g.first);

  // An article geocoded to several places stays with its biggest story.
  const claimed = new Set<string>();
  const kept = new Map<string, Story[]>();
  let stories = 0;
  for (const c of candidates) {
    const free = c.articles.filter(a => !claimed.has(a.url));
    if (!free.some(a => a.rows.length) || reportsIn(free) < minReports || outletsIn(free) < Math.min(2, minReports)) continue;
    for (const a of free) claimed.add(a.url);
    // Claimed before the family filter: a story stays one story whichever families are asked for.
    const family = familyOfStory(free.flatMap(a => a.rows));
    if (!families.has(family)) continue;
    const at = placeOf(free, c.group.first, rowsByUrl, places);
    const list = kept.get(placeKey(at));
    if (list) list.push({ articles: free, family, at });
    else kept.set(placeKey(at), [{ articles: free, family, at }]);
    stories++;
  }

  const markers: GdeltMarker[] = [];
  for (const [lead, ...rest] of kept.values()) {
    const rows = lead.articles.flatMap(a => a.rows);
    // The headline's verb has to match the story's colour: a missile strike should not read "Threatened".
    const own = rows.filter(r => familyOf(r.rootCode) === lead.family);
    const head = (own.length ? own : rows).reduce((h, r) => (r.articles > h.articles || (r.articles === h.articles && r.goldstein < h.goldstein) ? r : h));
    const seen = lead.articles.map(a => a.seen).filter(Number.isFinite);
    markers.push({
      id: head.id,
      family: lead.family,
      precision: PRECISION[lead.at.geoType]!,
      lat: lead.at.lat,
      lng: lead.at.lng,
      place: lead.at.place,
      country: lead.at.country,
      reports: reportsIn(lead.articles),
      outlets: outletsIn(lead.articles),
      articles: lead.articles.length,
      events: rows.length,
      headline: head,
      links: links(lead.articles, 6),
      others: rest.slice(0, 3).map(s => ({ ...links(s.articles, 1)[0], reports: reportsIn(s.articles) })),
      firstSeen: seen.length ? Math.min(...seen) : head.added,
      lastSeen: seen.length ? Math.max(...seen) : head.added,
    });
  }
  markers.sort((a, b) => b.reports - a.reports || b.outlets - a.outlets || b.articles - a.articles);

  let articles = 0;
  for (const g of groups.values()) articles += g.articles.size;
  return {
    markers: opts.limit === undefined ? markers : markers.slice(0, opts.limit),
    stats: { rows: input.events.length, mentions: mentions.length, articles, stories, markers: markers.length },
  };
}
