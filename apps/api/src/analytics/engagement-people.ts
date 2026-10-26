import type { AppDb } from '../db/app-db';
import { notAdmin, visitorNotAdmin, type Range } from './range';

/*
 * The map's minutes per person rather than per address block: browsers by their visitor id (signed out) and accounts
 * (signed in). A browser someone signed in on counts as that account, so one person isn't two.
 */

type Source = 'v' | 'u';

/** 'u:<account id>' or 'v:<browser id>'. */
export const personOf = (src: Source, id: string, userId: string | null) => (src === 'u' ? `u:${id}` : userId ? `u:${userId}` : `v:${id}`);

export const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/** Minutes begun over the range, labelled by the time they stand for: n begun is at least n − 1 whole minutes. */
const LENGTHS: [bucket: string, upTo: number][] = [
  ['Under 1 min', 1], ['1–2 min', 2], ['2–5 min', 5], ['5–15 min', 15], ['15–60 min', 60], ['Over 1 h', Infinity],
];
/** Minutes begun that mean two whole minutes or more on the map. */
export const STAYED_MINUTES = 3;

type DayRow = { src: Source; id: string; userId: string | null; day: number; minutes: number };

/** Each person's map minutes by UTC day (the wall's ticks book none), and how many browsers and accounts that is. */
export function mapDays(db: AppDb, r: Range) {
  const rows = db.prepare(`
    SELECT 'v' AS src, d.visitor_id AS id, v.user_id AS userId, d.day, d.minutes
    FROM visitor_day d LEFT JOIN visitor v ON v.visitor_id = d.visitor_id
    WHERE d.day >= @first AND d.minutes > 0 ${visitorNotAdmin(r)}
    UNION ALL
    SELECT 'u', subject_id, subject_id, day, minutes FROM map_time
    WHERE subject_type = 'user' AND day >= @first AND minutes > 0 ${notAdmin(r, 'subject_id')}`).all({ first: r.first }) as DayRow[];
  const people = new Map<string, Map<number, number>>();
  const visitors = new Set<string>();
  const accounts = new Set<string>();
  for (const row of rows) {
    (row.src === 'u' ? accounts : visitors).add(row.id);
    const key = personOf(row.src, row.id, row.userId);
    const days = people.get(key) ?? people.set(key, new Map()).get(key)!;
    days.set(row.day, (days.get(row.day) ?? 0) + row.minutes);
  }
  return { people, visitors: visitors.size, accounts: accounts.size };
}

export type MapDays = ReturnType<typeof mapDays>;

/** Each person's minutes over the range. */
export const totalsOf = (people: MapDays['people']) => new Map([...people].map(([key, days]) => [key, [...days.values()].reduce((a, b) => a + b, 0)]));

/** How long people stayed and whether they came back, from their minutes per day. */
export function stayStats(people: MapDays['people']) {
  const totals = [...totalsOf(people).values()];
  return {
    minutes: totals.reduce((a, b) => a + b, 0),
    medianMinutes: median(totals),
    leftWithinMinute: totals.filter(n => n === 1).length,
    stayed: totals.filter(n => n >= STAYED_MINUTES).length,
    cameBack: [...people.values()].filter(days => days.size >= 2).length,
    length: LENGTHS.map(([bucket, upTo], i) => ({
      bucket, people: totals.filter(n => n <= upTo && (i === 0 || n > LENGTHS[i - 1][1])).length,
    })),
  };
}

type FeatureRow = { src: Source; id: string; userId: string | null; feature: string; minutes: number; switched: number };

/**
 * Every feature with the people who had it (view:, panel:, window:, section:, layer:, device:), each person's minutes
 * with it on and their median. Every feature on during a tick gets its whole minute, so only one-per-tick kinds (view,
 * panel, device) add up to the map's time. A layer's `arrivedOn` counts people who switched no layer on on any day they
 * had it: it came on with a link or their saved map, not by choice.
 */
export function featureUse(db: AppDb, r: Range) {
  // Before actions were counted no day can tell a choice from a link, so those days count as a choice.
  const actionsSince = (db.prepare('SELECT min(day) FROM action_count').pluck().get() as number | null) ?? Number.MAX_SAFE_INTEGER;
  const switched = (type: string, id: string, day: string) =>
    `max(feature LIKE 'layer:%' AND (${day} < @actionsSince OR EXISTS (SELECT 1 FROM action_count a WHERE a.day = ${day} AND a.subject_type = '${type}' AND a.subject_id = ${id} AND a.action = 'layer.on')))`;
  const rows = db.prepare(`
    SELECT 'v' AS src, f.visitor_id AS id, v.user_id AS userId, f.feature, sum(f.minutes) AS minutes, ${switched('visitor', 'f.visitor_id', 'f.day')} AS switched
    FROM visitor_feature f LEFT JOIN visitor v ON v.visitor_id = f.visitor_id
    WHERE f.day >= @first AND f.minutes > 0 ${visitorNotAdmin(r)} GROUP BY f.visitor_id, f.feature
    UNION ALL
    SELECT 'u', subject_id, subject_id, feature, sum(minutes), ${switched('user', 'feature_time.subject_id', 'feature_time.day')}
    FROM feature_time WHERE subject_type = 'user' AND day >= @first AND minutes > 0 ${notAdmin(r, 'subject_id')} GROUP BY subject_id, feature`)
    .all({ first: r.first, actionsSince }) as FeatureRow[];

  const by = new Map<string, { minutes: number; visitors: Set<string>; users: Set<string>; people: Map<string, number>; chose: Set<string> }>();
  for (const row of rows) {
    const f = by.get(row.feature) ?? by.set(row.feature, { minutes: 0, visitors: new Set(), users: new Set(), people: new Map(), chose: new Set() }).get(row.feature)!;
    const person = personOf(row.src, row.id, row.userId);
    f.minutes += row.minutes;
    (row.src === 'u' ? f.users : f.visitors).add(row.id);
    f.people.set(person, (f.people.get(person) ?? 0) + row.minutes);
    if (row.switched) f.chose.add(person);
  }
  return [...by].map(([feature, f]) => ({
    feature,
    minutes: f.minutes,
    users: f.users.size,
    visitors: f.visitors.size,
    people: f.people.size,
    medianMinutes: median([...f.people.values()]),
    ...(feature.startsWith('layer:') ? { arrivedOn: f.people.size - f.chose.size } : {}),
  })).sort((a, b) => b.people - a.people || b.minutes - a.minutes || a.feature.localeCompare(b.feature));
}

/** Map minutes by UTC weekday (day 0 was a Thursday) and hour: browsers signed out and accounts, admins left out when asked. */
export function weekHours(db: AppDb, r: Range) {
  return db.prepare(`
    SELECT (day + 4) % 7 AS dow, hour, sum(minutes) AS minutes FROM (
      SELECT h.day, h.hour, h.minutes FROM visitor_hour h LEFT JOIN visitor v ON v.visitor_id = h.visitor_id WHERE h.day >= @first ${visitorNotAdmin(r)}
      UNION ALL
      SELECT day, hour, minutes FROM user_hour WHERE day >= @first ${notAdmin(r, 'user_id')}
    ) GROUP BY 1, 2 HAVING sum(minutes) > 0 ORDER BY 1, 2`).all({ first: r.first }) as { dow: number; hour: number; minutes: number }[];
}
