import type { Translate } from '@/lib/core/i18n/translator';
import { hikingLevel, type HikingCounts, type HikingLevel, type HikingRoute, type HikingRow } from './hiking-data';

/**
 * What a place's hiking page says, worked out from its own row: whether long-distance trails or networks pass
 * through, which route has the most of its length there, how long the longest one runs, whether the local routes
 * are short walks, and who looks after them. A place on a pilgrim network, one crossed by an E-path and one with
 * only local loops get different sentences, not one paragraph with the name swapped.
 */

/**
 * When a hiking page is worth a search result; below it the page still renders, with noindex, and stays out of the
 * sitemap. Three routes with a name (not only a number) and ten kilometres of route between them inside the radius:
 * enough for a list worth reading, where one waymarked path past the edge of town is not.
 */
export const HIKING_INDEX = { minNamed: 3, minKm: 10 } as const;

/** Under this a local route is a short walk. */
export const SHORT_KM = 10;

const LEVELS: HikingLevel[] = ['int', 'nat', 'reg', 'loc'];
const sum = (c: HikingCounts) => c.int + c.nat + c.reg + c.loc;

export function hikingIndexable(row: HikingRow): boolean {
  return row.named >= HIKING_INDEX.minNamed && sum(row.kmIn) >= HIKING_INDEX.minKm;
}

/** A route the page names, with how much of it lies inside the radius. */
export interface ListedRoute extends HikingRoute { id: number; level: HikingLevel; kmIn: number }

export interface HikingFacts {
  /** The radius searched. */
  r: number;
  total: number;
  n: HikingCounts;
  named: number;
  /** Route-kilometres inside the radius, all levels. */
  kmIn: number;
  /** The level with the most route-kilometres inside the radius. */
  leading: HikingLevel;
  /** Waymarked's listing was full somewhere, so the counts are a floor. */
  capped: boolean;
  shortLocal: number;
  /** The routes with most length inside the radius, longest first. */
  routes: ListedRoute[];
  /** The longest single route (not a network) whose length is known. */
  longest?: ListedRoute;
  /** Operators named on the listed routes, most routes first. */
  operators: { name: string; routes: number }[];
}

export function hikingFacts(row: HikingRow, routes: Record<string, HikingRoute>): HikingFacts {
  // OpenStreetMap sometimes holds one route twice, or once per direction, under the same name.
  const seen = new Set<string>();
  const listed = row.top.flatMap(([id, kmIn]) => {
    const r = routes[id];
    const key = r && `${r.net}|${routeName(r, id)}`;
    if (!r || seen.has(key!)) return [];
    seen.add(key!);
    return [{ ...r, id, level: hikingLevel(r.net), kmIn }];
  });
  const longest = listed.filter(r => !r.stages && r.km).sort((a, b) => b.km! - a.km!)[0];
  const ops = new Map<string, number>();
  for (const r of listed) {
    for (const name of r.operator?.split(/\s*;\s*/) ?? []) if (name) ops.set(name, (ops.get(name) ?? 0) + 1);
  }
  return {
    r: row.r,
    total: sum(row.n),
    n: row.n,
    named: row.named,
    kmIn: Math.round(sum(row.kmIn)),
    leading: LEVELS.reduce((a, b) => (row.kmIn[b] > row.kmIn[a] ? b : a)),
    capped: !!row.capped,
    shortLocal: row.shortLocal,
    routes: listed,
    longest,
    operators: [...ops].map(([name, n]) => ({ name, routes: n })).sort((a, b) => b.routes - a.routes || a.name.localeCompare(b.name)),
  };
}

/** One sentence of the page: which one, and its raw values. renderHikingSentence puts it in the reader's language. */
export type HikingSentence =
  | { id: 'count'; r: number; total: number; n: HikingCounts; capped: boolean }
  | { id: 'long-distance'; r: number; n: number; routes: ListedRoute[] }
  | { id: 'no-long-distance'; r: number }
  | { id: 'network'; route: ListedRoute; r: number }
  | { id: 'most-inside'; route: ListedRoute; r: number }
  | { id: 'longest'; route: ListedRoute }
  | { id: 'local'; local: number; short: number; capped: boolean }
  | { id: 'leading'; level: Exclude<HikingLevel, 'loc'>; km: number; total: number; r: number }
  | { id: 'operator'; name: string; routes: number; listed: number }
  | { id: 'operators'; names: string[] };

export interface HikingStory { facts: HikingFacts; sentences: HikingSentence[]; index: boolean }

export function hikingStory(row: HikingRow, routes: Record<string, HikingRoute>): HikingStory {
  const f = hikingFacts(row, routes);
  const out: HikingSentence[] = [{ id: 'count', r: f.r, total: f.total, n: f.n, capped: f.capped }];
  const told = new Set<number>();
  const tell = (r: ListedRoute) => told.add(r.id);

  const long = f.routes.filter(r => (r.level === 'int' || r.level === 'nat') && !r.stages).slice(0, 3);
  if (f.n.int + f.n.nat) {
    if (long.length) out.push({ id: 'long-distance', r: f.r, n: f.n.int + f.n.nat, routes: long });
    long.forEach(tell);
  } else if (f.n.reg && f.n.loc) {
    out.push({ id: 'no-long-distance', r: f.r });
  }
  for (const route of f.routes.filter(r => r.stages && r.km).slice(0, 2)) {
    out.push({ id: 'network', route, r: f.r });
    tell(route);
  }
  // A full listing drops local routes alphabetically, so "more than any other" and shares can't be known there.
  const most = f.routes[0];
  if (most && !told.has(most.id) && f.routes.length > 1 && !f.capped) {
    out.push({ id: 'most-inside', route: most, r: f.r });
    tell(most);
  }
  if (f.longest && !told.has(f.longest.id) && f.longest.km! >= 2 * SHORT_KM) out.push({ id: 'longest', route: f.longest });
  if (f.leading !== 'loc' && f.kmIn && !f.capped) out.push({ id: 'leading', level: f.leading, km: Math.round(row.kmIn[f.leading]), total: f.kmIn, r: f.r });
  if (f.n.loc >= 3 && f.shortLocal) out.push({ id: 'local', local: f.n.loc, short: f.shortLocal, capped: f.capped });
  const [first, second] = f.operators;
  if (first && first.routes >= 2 && first.routes > (second?.routes ?? 0)) {
    out.push({ id: 'operator', name: first.name, routes: first.routes, listed: f.routes.length });
  } else if (f.operators.length >= 2) {
    out.push({ id: 'operators', names: f.operators.slice(0, 3).map(o => o.name) });
  }
  return { facts: f, sentences: out, index: hikingIndexable(row) };
}

/** The route as a page names it: its name, else its number, else where it runs. */
export function routeName(r: Pick<HikingRoute, 'name' | 'ref' | 'from' | 'to'>, id: number): string {
  return r.name || r.ref || (r.from && r.to ? `${r.from} – ${r.to}` : `#${id}`);
}

const list = (items: string[], t: Translate) =>
  new Intl.ListFormat(t.locale === 'en' ? 'en-GB' : t.intl, { type: 'conjunction' }).format(items);
const num = (n: number, t: Translate) => new Intl.NumberFormat(t.intl).format(n);

/** The route's length as written: "537 km", "about 23 km" where it was measured on simplified lines. */
export function kmText(r: Pick<HikingRoute, 'km' | 'approx'>, t: Translate): string {
  return r.approx ? t('about {km} km', { km: num(r.km!, t) }) : t('{km} km', { km: num(r.km!, t) });
}

/** "2 international, 9 regional and 117 local". */
function breakdown(n: HikingCounts, t: Translate): string {
  return list([
    n.int ? t('{n} international', { n: n.int }) : '',
    n.nat ? t('{n} national', { n: n.nat }) : '',
    n.reg ? t('{n} regional', { n: n.reg }) : '',
    n.loc ? t('{n} local', { n: n.loc }) : '',
  ].filter(Boolean), t);
}

export function renderHikingSentence(s: HikingSentence, place: string, t: Translate): string {
  switch (s.id) {
    case 'count': {
      const only = LEVELS.filter(l => s.n[l]);
      const v = { total: s.total, count: num(s.total, t), r: s.r, place, breakdown: breakdown(s.n, t), level: only[0] };
      if (s.capped) return t('At least {count} waymarked hiking routes run within {r} km of {place}: {breakdown}. Parts of the area hold more than Waymarked Trails lists at once.', v);
      return only.length === 1
        ? t('{total, plural, one {One waymarked hiking route runs within {r} km of {place}, a {level, select, int {international} nat {national} reg {regional} other {local}} one.} other {{count} waymarked hiking routes run within {r} km of {place}, all of them {level, select, int {international} nat {national} reg {regional} other {local}}.}}', v)
        : t('{total, plural, one {One waymarked hiking route runs} other {{count} waymarked hiking routes run}} within {r} km of {place}: {breakdown}.', v);
    }
    case 'long-distance': {
      const routes = list(s.routes.map(r => (r.km ? t('{route} ({km})', { route: routeName(r, r.id), km: kmText(r, t) }) : routeName(r, r.id))), t);
      return s.n === s.routes.length
        ? t('{n, plural, one {One long-distance trail passes through: {routes}.} other {# long-distance trails pass through: {routes}.}}', { n: s.n, routes })
        : t('{n} national and international routes pass within {r} km, among them {routes}.', { n: s.n, r: s.r, routes });
    }
    case 'no-long-distance':
      return t('No national or international trail comes within {r} km; the longest-distance routes here are regional.', { r: s.r });
    case 'network': {
      const v = { place, route: routeName(s.route, s.route.id), stages: s.route.stages!, km: kmText(s.route, t), kmIn: num(s.route.kmIn, t), r: s.r };
      // The mapped length follows the main line; the lines inside the circle also hold its branches and variants.
      return s.route.kmIn >= 0.9 * s.route.km!
        ? t('{route} passes through {place}: {stages} sections with {km} mapped in all, nearly all of it within {r} km.', v)
        : t('{route} passes through {place}: {stages} sections with {km} mapped in all, {kmIn} km of them within {r} km.', v);
    }
    case 'most-inside': {
      const v = { route: routeName(s.route, s.route.id), kmIn: num(s.route.kmIn, t), r: s.r };
      if (!s.route.km || s.route.km <= s.route.kmIn * 1.1) return t('{route} has more of its length here than any other route: {kmIn} km within {r} km.', v);
      return s.route.from && s.route.to
        ? t('{route} has more of its length here than any other route: {kmIn} km within {r} km, of {km} from {from} to {to}.', { ...v, km: kmText(s.route, t), from: s.route.from, to: s.route.to })
        : t('{route} has more of its length here than any other route: {kmIn} km within {r} km, of {km} in all.', { ...v, km: kmText(s.route, t) });
    }
    case 'longest':
      return s.route.from && s.route.to
        ? t('Of the routes listed here, the longest is {route}, {km} from {from} to {to}.', { route: routeName(s.route, s.route.id), km: kmText(s.route, t), from: s.route.from, to: s.route.to })
        : t('Of the routes listed here, the longest is {route}, {km} long.', { route: routeName(s.route, s.route.id), km: kmText(s.route, t) });
    case 'leading':
      return t('{level, select, int {International} nat {National} other {Regional}} routes account for the largest share: {km} of the {total} km of waymarked route within {r} km.', {
        level: s.level, km: num(s.km, t), total: num(s.total, t), r: s.r,
      });
    case 'local':
      if (s.capped) return t('At least {short} local routes here are under 10 km.', { short: num(s.short, t) });
      return s.short * 2 >= s.local
        ? t('Most of the {local} local routes are short walks: {short} of them are under 10 km.', { local: num(s.local, t), short: num(s.short, t) })
        : t('{short, plural, one {# of the {local} local routes is under 10 km} other {# of the {local} local routes are under 10 km}}; the rest run longer or leave the area.', { local: num(s.local, t), short: s.short });
    case 'operator':
      return t('{name} looks after {routes} of the {listed} routes listed here.', { name: s.name, routes: s.routes, listed: s.listed });
    case 'operators':
      return t('Operators named on the routes listed here include {names}.', { names: list(s.names, t) });
  }
}

export const renderHikingStory = (story: HikingStory, place: string, t: Translate) =>
  story.sentences.map(s => renderHikingSentence(s, place, t));
