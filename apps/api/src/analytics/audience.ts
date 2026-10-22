import type { AccessResolver } from '../access/resolver';
import { isoDay } from '../access/usage';
import type { AppDb } from '../db/app-db';
import { HOUR_MS } from './map-minutes';
import { eachDay, isoToDay, minutesSince, notAdmin, round1, subjectNotAdmin, visitorNotAdmin, weekStart, type Range } from './range';
import { accountCountries } from './places';
import { parseUserAgent } from './user-agent';

const COHORT_WEEKS = 8;
const LIVE_STATUSES = "('active', 'trialing', 'past_due')";

/** Accounts, sign-ins and who spent time on the map (GET /api/admin/analytics/audience). */
export function audience(db: AppDb, access: AccessResolver, r: Range) {
  const all = <T>(sql: string, ...params: unknown[]) => db.prepare(sql).all(...params) as T[];
  const count = (sql: string, ...params: unknown[]) => (db.prepare(sql).pluck().get(...params) as number | null) ?? 0;
  // Better Auth's dates are ISO text, so a day's string sorts before every instant in it.
  const from = isoDay(r.first);
  const since = minutesSince(db);

  const days = eachDay(r, day => ({ day, signups: 0, activeUsers: 0, activeVisitors: 0, userMinutes: 0, visitorMinutes: 0, sessions: 0 }));
  const byDay = new Map(days.map(d => [d.day, d]));
  for (const row of all<{ day: string; n: number }>(`
    SELECT substr(createdAt, 1, 10) AS day, count(*) AS n FROM auth_user WHERE createdAt >= ? ${notAdmin(r, 'id')} GROUP BY 1`, from)) {
    const d = byDay.get(row.day);
    if (d) d.signups = row.n;
  }
  for (const row of all<{ day: string; n: number }>(`
    SELECT substr(createdAt, 1, 10) AS day, count(*) AS n FROM auth_session
    WHERE createdAt >= ? AND impersonatedBy IS NULL ${notAdmin(r, 'userId')} GROUP BY 1`, from)) {
    const d = byDay.get(row.day);
    if (d) d.sessions = row.n;
  }
  for (const row of all<{ day: number; type: 'anon' | 'user'; subjects: number; minutes: number }>(`
    SELECT day, subject_type AS type, count(*) AS subjects, sum(minutes) AS minutes FROM map_time
    WHERE day >= ? AND minutes > 0 ${subjectNotAdmin(r)} GROUP BY day, subject_type`, r.first)) {
    const d = days[row.day - r.first];
    if (!d) continue;
    if (row.type === 'user') [d.activeUsers, d.userMinutes] = [row.subjects, row.minutes];
    else [d.activeVisitors, d.visitorMinutes] = [row.subjects, row.minutes];
  }

  const activeSince = (day: number, type: 'anon' | 'user') => count(`
    SELECT count(DISTINCT subject_id) FROM map_time WHERE subject_type = ? AND minutes > 0 AND day >= ? ${subjectNotAdmin(r)}`, type, day);
  const users = (where = '1') => count(`SELECT count(*) FROM auth_user WHERE ${where} ${notAdmin(r, 'id')}`);
  const sum = (key: keyof (typeof days)[number]) => days.reduce((n, d) => n + (d[key] as number), 0);
  const average = (minutes: number, subjectDays: number) => (subjectDays ? round1(minutes / subjectDays) : 0);
  const totals = {
    users: users(),
    verified: users('emailVerified = 1'),
    twoFactor: users('twoFactorEnabled = 1'),
    banned: users('banned = 1'),
    dau: activeSince(r.today, 'user'),
    wau: activeSince(r.today - 6, 'user'),
    mau: activeSince(r.today - 29, 'user'),
    visitorsToday: activeSince(r.today, 'anon'),
    avgUserMinutes: average(sum('userMinutes'), sum('activeUsers')),
    avgVisitorMinutes: average(sum('visitorMinutes'), sum('activeVisitors')),
  };

  const providers = all<{ provider: string; users: number }>(`
    SELECT providerId AS provider, count(DISTINCT userId) AS users FROM auth_account WHERE 1 ${notAdmin(r, 'userId')}
    GROUP BY providerId ORDER BY users DESC, provider`);

  // The contract's range `days` (a count) gives way to the per-day rows here.
  return {
    today: isoDay(r.today), since, days, ...(r.hours ? { hours: hourly(r.hours) } : {}),
    totals, providers, plans: plans(), devices: devices(), cohorts: cohorts(), countries: accountCountries(db, r),
  };

  /**
   * A window of hours, hour by hour from the hourly tables: visitors here are browsers with a visitor id, where the
   * daily rows also count those that block storage by their address.
   */
  function hourly(hours: number) {
    const start = Math.floor(r.from / HOUR_MS);
    const rows = Array.from({ length: hours + 1 }, (_, i) => ({
      at: (start + i) * HOUR_MS, signups: 0, sessions: 0, activeUsers: 0, activeVisitors: 0, userMinutes: 0, visitorMinutes: 0,
    }));
    const slot = (h: number) => rows[h - start];
    const isoHour = `(CAST((julianday(createdAt) - 2440587.5) * 24 AS INTEGER))`;
    const fromIso = new Date(start * HOUR_MS).toISOString();
    for (const row of all<{ h: number; n: number }>(`
      SELECT ${isoHour} AS h, count(*) AS n FROM auth_user WHERE createdAt >= ? ${notAdmin(r, 'id')} GROUP BY 1`, fromIso)) {
      const s = slot(row.h);
      if (s) s.signups = row.n;
    }
    for (const row of all<{ h: number; n: number }>(`
      SELECT ${isoHour} AS h, count(*) AS n FROM auth_session WHERE createdAt >= ? AND impersonatedBy IS NULL ${notAdmin(r, 'userId')} GROUP BY 1`, fromIso)) {
      const s = slot(row.h);
      if (s) s.sessions = row.n;
    }
    for (const row of all<{ h: number; n: number; minutes: number }>(`
      SELECT day * 24 + hour AS h, count(*) AS n, sum(minutes) AS minutes FROM user_hour
      WHERE day >= ? AND day * 24 + hour >= ? AND minutes > 0 ${notAdmin(r, 'user_id')} GROUP BY 1`, r.first, start)) {
      const s = slot(row.h);
      if (s) [s.activeUsers, s.userMinutes] = [row.n, row.minutes];
    }
    for (const row of all<{ h: number; n: number; minutes: number }>(`
      SELECT d.day * 24 + d.hour AS h, count(*) AS n, sum(d.minutes) AS minutes FROM visitor_hour d LEFT JOIN visitor v ON v.visitor_id = d.visitor_id
      WHERE d.day >= ? AND d.day * 24 + d.hour >= ? AND d.minutes > 0 ${visitorNotAdmin(r)} GROUP BY 1`, r.first, start)) {
      const s = slot(row.h);
      if (s) [s.activeVisitors, s.visitorMinutes] = [row.n, row.minutes];
    }
    return rows;
  }

  /** Only accounts with a live subscription or grant can be on anything but free; resolving them all would be slow. */
  function plans() {
    const candidates = all<{ id: string }>(`
      SELECT DISTINCT subject_id AS id FROM bill_subscription
      WHERE subject_type = 'user' AND status IN ${LIVE_STATUSES} AND subject_id IN (SELECT id FROM auth_user) ${notAdmin(r, 'subject_id')}`);
    const counts = new Map<string, number>();
    for (const { id } of candidates) {
      const plan = access.resolve({ type: 'user', id }).plan.id;
      counts.set(plan, (counts.get(plan) ?? 0) + 1);
    }
    const paid = [...counts].filter(([plan]) => plan !== 'free').reduce((n, [, users]) => n + users, 0);
    counts.set('free', totals.users - paid);
    return [...counts].map(([plan, n]) => ({ plan, users: n })).sort((a, b) => b.users - a.users || a.plan.localeCompare(b.plan));
  }

  function devices() {
    const counts = new Map<string, { kind: 'browser' | 'os' | 'device'; name: string; sessions: number }>();
    const add = (kind: 'browser' | 'os' | 'device', name: string) => {
      const entry = counts.get(`${kind}\n${name}`) ?? { kind, name, sessions: 0 };
      entry.sessions += 1;
      counts.set(`${kind}\n${name}`, entry);
    };
    for (const { ua } of all<{ ua: string | null }>(`
      SELECT userAgent AS ua FROM auth_session WHERE createdAt >= ? AND impersonatedBy IS NULL ${notAdmin(r, 'userId')}`, from)) {
      const agent = parseUserAgent(ua);
      add('browser', agent.browser);
      add('os', agent.os);
      add('device', agent.device);
    }
    const order = { browser: 0, os: 1, device: 2 };
    return [...counts.values()].sort((a, b) => order[a.kind] - order[b.kind] || b.sessions - a.sessions || a.name.localeCompare(b.name));
  }

  /** Weeks before the minute tick existed have no activity to measure, so they read null like the future ones. */
  function cohorts() {
    const thisWeek = weekStart(r.today);
    const firstWeek = thisWeek - (COHORT_WEEKS - 1) * 7;
    const trackedFrom = since ? isoToDay(`${since}T00:00:00Z`) : Infinity;
    const members = new Map<number, string[]>();
    for (const { id, createdAt } of all<{ id: string; createdAt: string }>(`
      SELECT id, createdAt FROM auth_user WHERE createdAt >= ? ${notAdmin(r, 'id')}`, isoDay(firstWeek))) {
      const week = weekStart(isoToDay(createdAt));
      members.set(week, [...(members.get(week) ?? []), id]);
    }
    const activeWeeks = new Map<string, Set<number>>();
    for (const { id, day } of all<{ id: string; day: number }>(`
      SELECT DISTINCT subject_id AS id, day FROM map_time WHERE subject_type = 'user' AND minutes > 0 AND day >= ?`, firstWeek)) {
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
