import { haversine } from '../../../src/lib/core/geodesic';
import type { Hit, Point } from './geo-index';
import type { Hint } from './names';

/*
 * Gazetteer candidates for the names an event gives, grouped into places and weighed against what else is known
 * about the event. A name alone never decides between two far-apart places: the winner needs context that points
 * to it (its country, its war's other battles, its era), or to be the only place of that name and vouched for.
 */

export const km = (a: Point, b: Point) => haversine([a.lon, a.lat], [b.lon, b.lat]);

export type Context = {
  year?: number | null;
  /** ISO 3166-1 alpha-2 codes the event is known to be in. */
  countries?: string[];
  /** GeoNames first-level divisions the event is known to be in, as "CC.code". */
  admin1s?: string[];
  /** A country's representative point when only that is known (Wikidata's P17 coordinates). */
  countryPoint?: Point | null;
  /** Where related events happened: the other battles of its war. */
  related?: Point[];
  naval?: boolean;
};

/** A hit and which of the event's names produced it. */
export type Tagged = Hit & { match: number; hint: Hint; nameLang: string };

export type Cluster = Point & {
  hits: Tagged[];
  best: Tagged;
  kind: string;
  score: number;
  evidence: string[];
};

/** Places of one name closer than this are one place (a town's GeoNames point and its article's). */
const RADIUS: Record<string, number> = {
  settlement: 20, site: 15, fort: 15, pass: 25, cape: 25, mountain: 30, island: 40, lake: 40, admin3: 30, admin2: 80, bay: 120, terrain: 150,
  river: 250, admin1: 250, region: 300, sea: 600, country: 1000, unknown: 20,
};
const radius = (kind: string) => RADIUS[kind] ?? 20;
const POINTLIKE = new Set(['settlement', 'site', 'fort', 'unknown']);
const DISTRICT = new Set(['admin2', 'admin3']);
/**
 * A town merges with a river or region of its name only when close, but with a district named after it anywhere in
 * the district's reach (Lviv and Lviv raion); two large features merge at the larger reach.
 */
function reach(a: string, b: string) {
  if ((a === 'settlement' && DISTRICT.has(b)) || (b === 'settlement' && DISTRICT.has(a))) return Math.max(radius(a), radius(b));
  return POINTLIKE.has(a) || POINTLIKE.has(b) ? Math.min(radius(a), radius(b)) : Math.max(radius(a), radius(b));
}

/** Kinds from finest to coarsest; a group of hits is placed at its finest. */
const KIND_RANK = ['settlement', 'fort', 'site', 'pass', 'cape', 'mountain', 'island', 'admin3', 'lake', 'admin2', 'bay', 'terrain', 'river', 'admin1', 'region', 'sea', 'country', 'unknown'];
const rank = (kind: string) => {
  const i = KIND_RANK.indexOf(kind);
  return i < 0 ? KIND_RANK.length : i;
};

/** Better anchors first: a populated GeoNames place, then a primary-topic article, then the rest. */
function quality(h: Tagged) {
  return (h.source === 'geonames' && h.kind === 'settlement' ? 2 + Math.log10((h.population ?? 0) + 1) : 0) + (h.primary ? 2 : 0) + (h.qid ? 1 : 0) - rank(h.kind) * 0.05;
}

const HINT_KINDS: Record<Exclude<Hint, null>, string[]> = {
  river: ['river'], mountain: ['mountain'], cape: ['cape', 'settlement'], pass: ['pass'], island: ['island'], sea: ['sea', 'bay'], lake: ['lake'], bay: ['bay', 'sea'], fort: ['fort', 'site', 'settlement'],
};
const NAVAL_KINDS = new Set(['bay', 'sea', 'cape', 'island', 'settlement']);
export const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
export const middle = (ps: Point[]): Point => ({ lon: median(ps.map(p => p.lon)), lat: median(ps.map(p => p.lat)) });

/** Groups hits that are the same place: shared Wikidata item, or within the kind's radius of the group's anchor. */
export function cluster(hits: Tagged[]): Cluster[] {
  const groups: { hits: Tagged[]; best: Tagged; qids: Set<number> }[] = [];
  for (const h of [...hits].sort((a, b) => quality(b) - quality(a))) {
    const g = groups.find(c => (h.qid !== null && c.qids.has(h.qid)) || km(c.best, h) <= reach(c.best.kind, h.kind));
    if (g) {
      g.hits.push(h);
      if (h.qid !== null) g.qids.add(h.qid);
    } else groups.push({ hits: [h], best: h, qids: new Set(h.qid !== null ? [h.qid] : []) });
  }
  return groups.map(g => {
    // "Battle of the Magdalena River" is placed at the river, not at the department of that name beside it.
    const hint = g.hits.find(h => h.hint)?.hint;
    const hinted = hint ? g.hits.filter(h => HINT_KINDS[hint].includes(h.kind)).map(h => h.kind) : [];
    const kind = (hinted.length ? hinted : g.hits.map(h => h.kind)).filter(k => k !== 'unknown').sort((a, b) => rank(a) - rank(b))[0] ?? 'unknown';
    const anchor = g.hits.filter(h => h.kind === kind).sort((a, b) => quality(b) - quality(a))[0] ?? g.best;
    return { lon: anchor.lon, lat: anchor.lat, hits: g.hits, best: anchor, kind, score: 0, evidence: [] };
  });
}

/** Score weights; the benchmark (docs/architecture/geolocation.md) is what they were tuned against. */
export const W = {
  population: 0.6, primary: 2, language: 0.25, source: 0.75, item: 0.5, otherName: 1, capital: 0.5, notPlace: -3,
  country: 4, otherCountry: -4, admin1: 4, otherAdmin1: -1.5, relatedNear: 4, relatedClose: 2.5, relatedRegion: 1, relatedFar: -3,
  countryPoint: 2, countryPointFar: -2, era: 3, historic: 0.75, tooNew: -1, hint: 2.5, hintMiss: -1.5, naval: 0.5, navalMiss: -1,
};

/** Scores each place; `evidence` names what in the event's context points to it. */
export function score(clusters: Cluster[], ctx: Context): Cluster[] {
  const rel = ctx.related?.length ? middle(ctx.related) : null;
  for (const c of clusters) {
    const ev: string[] = [];
    let s = 0;
    const add = (n: number, tag?: string) => {
      s += n;
      if (tag) ev.push(tag);
    };
    const has = (f: (h: Tagged) => boolean) => c.hits.some(f);
    add(Math.log10(Math.max(0, ...c.hits.map(h => h.population ?? 0)) + 1) * W.population);
    if (has(h => h.primary)) add(W.primary, 'primary');
    add(Math.min(new Set(c.hits.filter(h => h.lang).map(h => h.lang)).size, 8) * W.language);
    add((new Set(c.hits.map(h => h.source)).size - 1) * W.source);
    if (has(h => h.qid !== null)) add(W.item);
    const matches = new Set(c.hits.map(h => h.match)).size;
    if (matches > 1) add(matches * W.otherName, 'names');
    if (has(h => h.fcode === 'PPLC' || h.fcode === 'PPLA')) add(W.capital);
    if (c.kind === 'event' || c.kind === 'unknown') add(W.notPlace);

    if (ctx.countries?.length) {
      if (has(h => !!h.country && ctx.countries!.includes(h.country))) add(W.country, 'country');
      else if (has(h => !!h.country)) add(W.otherCountry);
    }
    if (ctx.admin1s?.length) {
      if (has(h => !!h.country && !!h.admin1 && ctx.admin1s!.includes(`${h.country}.${h.admin1}`))) add(W.admin1, 'admin1');
      else if (has(h => !!h.admin1)) add(W.otherAdmin1);
    }
    if (rel) {
      const d = Math.min(km(c, rel), ...ctx.related!.map(p => km(c, p)));
      if (d < 150) add(W.relatedNear, 'related');
      else if (d < 400) add(W.relatedClose, 'related');
      else if (d < 1000) add(W.relatedRegion);
      else if (d > 2500) add(W.relatedFar);
    }
    if (ctx.countryPoint) {
      const d = km(c, ctx.countryPoint);
      if (d < 600) add(W.countryPoint, 'country-point');
      else if (d > 2500) add(W.countryPointFar);
    }
    if (ctx.year !== null && ctx.year !== undefined) {
      const y = ctx.year;
      if (y < 800 && has(h => h.source === 'pleiades' && (h.validFrom ?? -5000) <= y + 50 && (h.validTo ?? 3000) >= y - 50)) add(W.era, 'era');
      else if (y < 1950 && has(h => h.historic)) add(W.historic);
      if (has(h => h.validFrom !== null && h.validFrom > y + 200)) add(W.tooNew);
    }
    const hint = c.hits.find(h => h.hint)?.hint;
    if (hint) {
      if (has(h => HINT_KINDS[hint].includes(h.kind))) add(W.hint, 'hint');
      else add(W.hintMiss);
    }
    if (ctx.naval) add(NAVAL_KINDS.has(c.kind) ? W.naval : W.navalMiss);
    c.score = s;
    c.evidence = ev;
  }
  return clusters.sort((a, b) => b.score - a.score);
}

/** Context evidence: things beyond the name itself that point at this place. */
const CONTEXT = new Set(['country', 'admin1', 'related', 'country-point', 'era', 'names']);

export type Decision = { cluster: Cluster; margin: number; contexted: boolean; alone: boolean; features: Features };

/** What the benchmark records about a decision, to set the acceptance rules from. */
export type Features = { margin: number; clusters: number; sources: number; langs: number; pop: number; primary: boolean; notable: boolean };

function features(top: Cluster, margin: number, clusters: number): Features {
  return {
    margin, clusters,
    sources: new Set(top.hits.map(h => h.source)).size,
    langs: new Set(top.hits.map(h => h.lang).filter(Boolean)).size,
    pop: Math.max(0, ...top.hits.map(h => h.population ?? 0)),
    primary: top.hits.some(h => h.primary),
    notable: top.hits.some(h => h.qid !== null || h.primary || h.source === 'pleiades' || (h.population ?? 0) >= 1000) || new Set(top.hits.map(h => h.lang)).size >= 2,
  };
}

/**
 * The best place if the evidence is enough: the only place of that name that two sources or a primary-topic article
 * vouch for, or one that context picks out and that beats the next by `margin`. Otherwise null — a guess between two
 * Lexingtons is worse than none.
 * `permissive` returns the top place regardless, for the benchmark to measure what each rule would let through.
 */
export function decide(clusters: Cluster[], margin = 2, permissive = false): Decision | null {
  const places = clusters.filter(c => c.kind !== 'event' && c.kind !== 'unknown');
  if (!places.length) return null;
  const [top, next] = places;
  const contexted = top.evidence.some(e => CONTEXT.has(e));
  const gap = next ? top.score - next.score : Infinity;
  const f = features(top, gap, places.length);
  const d = { cluster: top, margin: gap, contexted, alone: !next, features: f };
  if (permissive) return d;
  // The benchmark's rule (geolocation.md §3): a lone place needs a second source, a primary-topic article or
  // context; among several, context must pick it out by `margin`.
  if (!next) return f.sources >= 2 || f.primary || contexted ? d : null;
  return contexted && gap >= margin ? d : null;
}
