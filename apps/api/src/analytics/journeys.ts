import { DAY_MS, isoDay } from '../access/usage';
import type { AppDb } from '../db/app-db';
import { HOUR_MS, mapMinutes, pageMapUse, type MapMinutes } from './map-minutes';
import { MAP_PATH } from './page-reads';
import type { Next, Visit } from './page-visits';
import { localDayStarts, type Range } from './range';

const TOP = 40;

export const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

function tally<K extends string>(keys: Iterable<K>) {
  const counts = new Map<K, number>();
  for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
}

/** Each time a visit was on `path`: where it came from (the step before, or its origin), where it went, how long it stayed. */
function stays(visits: Visit[], path?: string) {
  return visits.flatMap(v => v.steps.flatMap((s, i) => (path !== undefined && s.path !== path ? [] : [{
    visit: v, path: s.path, landing: i === 0,
    before: i ? v.steps[i - 1].path : null,
    after: v.steps[i + 1]?.path ?? null,
    ms: v.steps[i + 1] ? v.steps[i + 1].at - s.at : null,
  }])));
}

/** Per page: visits through it, visits that began and ended on it, and the median time before the next step. */
function pageStats(visits: Visit[]) {
  const by = new Map<string, { path: string; visits: Set<Visit>; landings: number; exits: number; times: number[] }>();
  for (const s of stays(visits)) {
    const row = by.get(s.path) ?? { path: s.path, visits: new Set(), landings: 0, exits: 0, times: [] };
    row.visits.add(s.visit);
    if (s.landing) row.landings += 1;
    if (s.after === null) row.exits += 1;
    if (s.ms !== null) row.times.push(s.ms);
    by.set(s.path, row);
  }
  return [...by.values()]
    .map(r => ({ path: r.path, visits: r.visits.size, landings: r.landings, exits: r.exits, medianMs: median(r.times) }))
    .sort((a, b) => b.visits - a.visits || a.path.localeCompare(b.path))
    .slice(0, TOP);
}

/** The browsers behind `visits` (oldest first): all of them, those new to the site, those that read a page, opened the map, did both, or have an account. */
function people(visits: Visit[]) {
  const all = new Set<string>();
  const fresh = new Set<string>();
  const readers = new Set<string>();
  const map = new Set<string>();
  const signedIn = new Set<string>();
  for (const v of visits) {
    if (!all.has(v.visitorId) && !v.returning) fresh.add(v.visitorId);
    all.add(v.visitorId);
    if (v.steps.some(s => s.path !== MAP_PATH)) readers.add(v.visitorId);
    if (v.steps.some(s => s.path === MAP_PATH)) map.add(v.visitorId);
    if (v.user) signedIn.add(v.visitorId);
  }
  return { visitors: all.size, new: fresh.size, readers: readers.size, mapUsers: map.size, both: [...readers].filter(id => map.has(id)).length, signedIn: signedIn.size };
}

/**
 * People, visits and map minutes per hour for a range of hours, else per local day in the range's zone; a visit counts
 * where it began, minutes in the hour they were booked. `at` is each bucket's start.
 */
function series(visits: Visit[], used: MapMinutes, r: Range) {
  const hourStart = Math.floor(r.from / HOUR_MS) * HOUR_MS;
  const starts = r.hours ? Array.from({ length: r.hours + 1 }, (_, i) => hourStart + i * HOUR_MS) : localDayStarts(r).slice(0, -1);
  const n = starts.length;
  const slot = (at: number) => {
    let i = n - 1;
    while (i > 0 && at < starts[i]) i--;
    return at < starts[0] ? -1 : i;
  };
  const buckets: Visit[][] = Array.from({ length: n }, () => []);
  for (const v of visits) buckets[slot(v.start)]?.push(v);
  const minutes = new Array<number>(n).fill(0);
  const pageMapMinutes = new Array<number>(n).fill(0);
  // An hour books to the day it began in; in a zone a half hour off UTC, the range's first hour began just before it.
  for (const row of used.full) minutes[Math.max(0, slot(row.h * HOUR_MS))] += row.minutes;
  for (const row of used.pages) pageMapMinutes[Math.max(0, slot(row.h * HOUR_MS))] += row.minutes;
  return buckets.map((group, i) => {
    const { visitors, readers, mapUsers } = people(group);
    return { at: starts[i], visitors, readers, mapUsers, visits: group.length, minutes: minutes[i], pageMapMinutes: pageMapMinutes[i] };
  });
}

/**
 * Where visits came from and where they went: each origin → the page it landed on → what it did next, the steps
 * from page to page, each page's time and exits, and when and from where people read.
 */
export function journeys(db: AppDb, visits: Visit[], r: Range) {
  const used = mapMinutes(db, r);
  const pageMaps = pageMapUse(used.pages);
  const since = db.prepare('SELECT min(day) FROM page_view').pluck().get() as number | null;
  const flow = new Map<string, { origin: string | null; landing: string; next: Next; visits: number }>();
  for (const v of visits) {
    const key = `${v.source ?? ''} ${v.steps[0].path} ${v.next}`;
    const row = flow.get(key) ?? { origin: v.source, landing: v.steps[0].path, next: v.next, visits: 0 };
    row.visits += 1;
    flow.set(key, row);
  }
  const pairs = visits.flatMap(v => v.steps.slice(1).map((s, i) => `${v.steps[i].path} ${s.path}`));
  const walks = visits.filter(v => v.steps.length > 1);
  const hours = new Map<string, number>();
  for (const v of visits) {
    const key = `${(Math.floor(v.start / DAY_MS) + 4) % 7}:${new Date(v.start).getUTCHours()}`;
    hours.set(key, (hours.get(key) ?? 0) + 1);
  }
  const placed = visits.filter(v => v.place?.latitude != null && v.place.longitude != null);
  const hostsOf = new Map<string, Set<string>>();
  for (const v of visits) if (v.source && v.origin) (hostsOf.get(v.source) ?? hostsOf.set(v.source, new Set()).get(v.source)!).add(v.origin);

  return {
    since: since == null ? null : isoDay(since),
    totals: {
      ...people(visits),
      /** Minutes on the full map, everyone's, and on the pages' small maps, with how many browsers used one. */
      minutes: used.full.reduce((n, row) => n + row.minutes, 0),
      pageMapMinutes: used.pages.reduce((n, row) => n + row.minutes, 0),
      pageMapUsers: new Set(used.pages.map(row => row.visitorId)).size,
      visits: visits.length,
      views: visits.reduce((n, v) => n + v.views, 0),
      left: visits.filter(v => v.next === 'left').length,
      readOn: visits.filter(v => v.next === 'page').length,
      toMap: visits.filter(v => v.steps[0].path !== MAP_PATH && v.steps.some(s => s.path === MAP_PATH)).length,
      landedOnMap: visits.filter(v => v.steps[0].path === MAP_PATH).length,
      returning: visits.filter(v => v.returning).length,
      avgSteps: visits.length ? visits.reduce((n, v) => n + v.steps.length, 0) / visits.length : 0,
      /** Of visits with more than one step; a single view has no length to measure. */
      medianMs: median(walks.map(v => v.end - v.start)),
    },
    series: series(visits, used, r),
    flow: [...flow.values()].sort((a, b) => b.visits - a.visits),
    channels: tally(visits.map(v => v.channel)).map(([channel, n]) => ({ channel, visits: n })),
    sources: tally(visits.flatMap(v => (v.source ? [v.source] : []))).map(([source, n]) => ({
      source, channel: visits.find(v => v.source === source)!.channel, hosts: [...(hostsOf.get(source) ?? [])].sort(), visits: n,
    })),
    links: tally(visits.flatMap(v => (v.origin && v.originPath ? [`${v.origin}${v.originPath}`] : []))).slice(0, TOP)
      .map(([url, n]) => ({ url, visits: n })),
    steps: tally(pairs).slice(0, TOP).map(([pair, n]) => {
      const [from, to] = pair.split(' ');
      return { from, to, visits: n };
    }),
    pages: pageStats(visits).map(p => ({ ...p, mapMinutes: pageMaps.get(p.path)?.minutes ?? 0, mapUsers: pageMaps.get(p.path)?.visitors.size ?? 0 })),
    hours: [...hours].map(([key, n]) => {
      const [dow, hour] = key.split(':').map(Number);
      return { dow, hour, visits: n };
    }),
    countries: tally(visits.map(v => v.place?.country ?? '')).map(([country, n]) => ({ country: country || null, visits: n })),
    cities: tally(visits.flatMap(v => (v.place?.city ? [`${v.place.country ?? ''}|${v.place.region ?? ''}|${v.place.city}`] : []))).slice(0, TOP)
      .map(([key, n]) => {
        const [country, region, city] = key.split('|');
        return { country: country || null, region: region || null, city, visits: n };
      }),
    points: tally(placed.map(v => `${v.place!.latitude},${v.place!.longitude}`)).map(([key, n]) => {
      const [latitude, longitude] = key.split(',').map(Number);
      const { city, country } = placed.find(v => v.place!.latitude === latitude && v.place!.longitude === longitude)!.place!;
      return { latitude, longitude, city, country, visits: n };
    }),
    devices: tally(visits.map(v => v.agent.device)).map(([device, n]) => ({ device, visits: n })),
    browsers: tally(visits.map(v => v.agent.browser)).map(([browser, n]) => ({ browser, visits: n })),
    oses: tally(visits.map(v => v.agent.os)).map(([os, n]) => ({ os, visits: n })),
    campaigns: tally(visits.flatMap(v => (v.campaign ? [v.campaign] : []))).map(([campaign, n]) => ({ campaign, visits: n })),
  };
}

/** GET /api/admin/analytics/pages/page?path=: one page across the visits in the range. */
export function pageDetail(visits: Visit[], path: string) {
  const here = stays(visits, path);
  const through = new Set(here.map(s => s.visit));
  return {
    path,
    visits: through.size,
    landings: here.filter(s => s.landing).length,
    exits: here.filter(s => s.after === null).length,
    medianMs: median(here.flatMap(s => (s.ms === null ? [] : [s.ms]))),
    /** The step before: a page, or for a visit that began here its origin ('origin:Google', 'origin:' for direct). */
    cameFrom: tally(here.map(s => (s.landing ? `origin:${s.visit.source ?? ''}` : s.before!))).map(([from, n]) => ({ from, visits: n })),
    /** The step after; '' when the visit ended here. */
    wentTo: tally(here.map(s => s.after ?? '')).map(([to, n]) => ({ to, visits: n })),
    countries: tally([...through].map(v => v.place?.country ?? '')).map(([country, n]) => ({ country: country || null, visits: n })),
    devices: tally([...through].map(v => v.agent.device)).map(([device, n]) => ({ device, visits: n })),
  };
}
