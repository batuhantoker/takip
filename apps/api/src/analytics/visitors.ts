import { DAY_MS, isoDay } from '../access/usage';
import type { AppDb } from '../db/app-db';
import { visitorPlaces } from './places';
import { dayStartMs, eachDay, round1, visitorNotAdmin, weekStart, type Range } from './range';
import { campaignOf, originOf, sourceOfTag } from './sources';
import { parseUserAgent } from './user-agent';

const COHORT_WEEKS = 8;
const TOP = 25;

type Totals = { visitors: number; new: number; returning: number; signedIn: number; minutes: number | null; activeDays: number | null; hitWall: number };

/** Browsers over the range (GET /api/admin/analytics/visitors): who came, who came back, from where, on what. */
export function visitors(db: AppDb, r: Range) {
  const all = <T>(sql: string, ...params: unknown[]) => db.prepare(sql).all(...params) as T[];
  const notAdmin = visitorNotAdmin(r);
  const params = { first: r.first, from: dayStartMs(r.first) };
  const firstSeen = db.prepare('SELECT min(first_seen_at) FROM visitor').pluck().get() as number | null;

  // A day a browser only met the wall still counts as a visit, with no minutes.
  const daily = eachDay(r, day => ({ day, visitors: 0, new: 0, returning: 0, minutes: 0, signedIn: 0 }));
  for (const row of all<{ day: number; visitors: number; new: number; returning: number; minutes: number; signedIn: number }>(`
    SELECT d.day, count(*) AS visitors,
           sum(v.first_seen_at / ${DAY_MS} = d.day) AS "new", sum(v.first_seen_at / ${DAY_MS} < d.day) AS "returning",
           sum(d.minutes) AS minutes, sum(v.user_id IS NOT NULL) AS signedIn
    FROM visitor_day d JOIN visitor v ON v.visitor_id = d.visitor_id
    WHERE d.day >= @first ${notAdmin} GROUP BY d.day`, params)) {
    const entry = daily[row.day - r.first];
    if (entry) Object.assign(entry, { ...row, day: entry.day });
  }

  const t = db.prepare(`
    SELECT count(*) AS visitors, coalesce(sum(firstSeenAt >= @from), 0) AS "new", coalesce(sum(firstSeenAt < @from), 0) AS "returning",
           coalesce(sum(linked), 0) AS signedIn, sum(minutes) AS minutes, sum(activeDays) AS activeDays,
           (SELECT count(DISTINCT f.visitor_id) FROM visitor_feature f JOIN visitor v ON v.visitor_id = f.visitor_id
            WHERE f.day >= @first AND f.feature = 'view:wall' ${notAdmin}) AS hitWall
    FROM (SELECT v.visitor_id, v.first_seen_at AS firstSeenAt, v.user_id IS NOT NULL AS linked, count(*) AS days,
                 sum(d.minutes) AS minutes, count(CASE WHEN d.minutes > 0 THEN 1 END) AS activeDays
          FROM visitor_day d JOIN visitor v ON v.visitor_id = d.visitor_id
          WHERE d.day >= @first ${notAdmin} GROUP BY v.visitor_id)`).get(params) as Totals;
  const minutes = t.minutes ?? 0;
  const totals = {
    visitors: t.visitors,
    new: t.new,
    returning: t.returning,
    signedIn: t.signedIn,
    minutes,
    avgMinutesPerVisitorDay: t.activeDays ? round1(minutes / t.activeDays) : 0,
    hitWall: t.hitWall,
  };

  // First-visit attribution belongs to the visitors whose first visit fell in the range; a tag naming a site counts as that site.
  const arrivals = all<{ referrer: string | null; landing: string | null; linked: number }>(`
    SELECT v.referrer, v.landing, v.user_id IS NOT NULL AS linked FROM visitor v WHERE v.first_seen_at >= @from ${notAdmin}`, params)
    .map(a => ({ ...a, tag: campaignOf(a.landing) }));
  const referrers = ranked(arrivals, a => originOf(a.referrer, a.tag), (referrer, rows) => ({ referrer, visitors: rows.length, signedIn: rows.filter(a => a.linked).length }));
  const landings = ranked(arrivals.filter(a => a.landing), a => a.landing!, (landing, rows) => ({ landing, visitors: rows.length }));
  const campaigns = ranked(arrivals.filter(a => a.tag && !sourceOfTag(a.tag)), a => a.tag!, (source, rows) => ({
    source, visitors: rows.length, signedIn: rows.filter(a => a.linked).length,
  }));

  return { today: isoDay(r.today), since: firstSeen == null ? null : isoDay(Math.floor(firstSeen / DAY_MS)), daily, totals, referrers, landings, campaigns, devices: devices(), cohorts: cohorts(), ...visitorPlaces(db, r) };

  /** One per browser active in the range. */
  function devices() {
    const counts = new Map<string, { kind: 'browser' | 'os' | 'device'; name: string; visitors: number }>();
    for (const { ua } of all<{ ua: string | null }>(`
      SELECT v.user_agent AS ua FROM visitor v
      WHERE v.visitor_id IN (SELECT visitor_id FROM visitor_day WHERE day >= @first) ${notAdmin}`, params)) {
      const agent = parseUserAgent(ua);
      for (const [kind, name] of [['browser', agent.browser], ['os', agent.os], ['device', agent.device]] as const) {
        const entry = counts.get(`${kind}\n${name}`) ?? { kind, name, visitors: 0 };
        entry.visitors += 1;
        counts.set(`${kind}\n${name}`, entry);
      }
    }
    const order = { browser: 0, os: 1, device: 2 };
    return [...counts.values()].sort((a, b) => order[a.kind] - order[b.kind] || b.visitors - a.visitors || a.name.localeCompare(b.name));
  }

  /** Weeks that ended before the first visitor id was seen weren't measured, so they read null like the future ones. */
  function cohorts() {
    const thisWeek = weekStart(r.today);
    const firstWeek = thisWeek - (COHORT_WEEKS - 1) * 7;
    const trackedFrom = firstSeen == null ? Infinity : Math.floor(firstSeen / DAY_MS);
    const members = new Map<number, string[]>();
    for (const { id, at } of all<{ id: string; at: number }>(`
      SELECT v.visitor_id AS id, v.first_seen_at AS at FROM visitor v WHERE v.first_seen_at >= ? ${notAdmin}`, dayStartMs(firstWeek))) {
      const week = weekStart(Math.floor(at / DAY_MS));
      members.set(week, [...(members.get(week) ?? []), id]);
    }
    const activeWeeks = new Map<string, Set<number>>();
    for (const { id, day } of all<{ id: string; day: number }>(
      'SELECT visitor_id AS id, day FROM visitor_day WHERE minutes > 0 AND day >= ?', firstWeek)) {
      const weeks = activeWeeks.get(id) ?? new Set<number>();
      weeks.add(weekStart(day));
      activeWeeks.set(id, weeks);
    }
    return Array.from({ length: COHORT_WEEKS }, (_, i) => {
      const week = firstWeek + i * 7;
      const ids = members.get(week) ?? [];
      const retained = Array.from({ length: COHORT_WEEKS }, (_, offset) => {
        const at = week + offset * 7;
        if (at > thisWeek || at + 6 < trackedFrom) return null;
        if (!ids.length) return 0;
        return Math.round((ids.filter(id => activeWeeks.get(id)?.has(at)).length / ids.length) * 1000) / 1000;
      });
      return { week: isoDay(week), size: ids.length, retained };
    });
  }
}

/** Groups rows by `key`, biggest group first (ties by key), the top 25. */
function ranked<R, K extends string | null, T>(rows: R[], key: (row: R) => K, make: (key: K, rows: R[]) => T) {
  const groups = new Map<K, R[]>();
  for (const row of rows) groups.set(key(row), [...(groups.get(key(row)) ?? []), row]);
  return [...groups]
    .sort(([a, x], [b, y]) => y.length - x.length || String(a ?? '').localeCompare(String(b ?? '')))
    .slice(0, TOP)
    .map(([k, group]) => make(k, group));
}
