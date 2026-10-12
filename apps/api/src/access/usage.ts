import { createHmac, randomBytes } from 'node:crypto';
import type { Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import { matchedRoutes } from 'hono/route';
import type { Logger } from 'pino';
import type { AppDb } from '../db/app-db';
import { silentLogger } from '../obs/logger';
import { addressBlock } from './client-ip';
import type { AccessEnv } from './middleware';
import type { Principal } from './principal';

export const DAY_MS = 86_400_000;
export const utcDay = (ms: number) => Math.floor(ms / DAY_MS);
export const isoDay = (day: number) => new Date(day * DAY_MS).toISOString().slice(0, 10);

const V1 = '/api/v1/';

/** First segment of the matched /api/v1 route (`/api/v1/geo/search` → `geo`); 'other' when none matched, so probes can't mint groups. */
export function routeGroup(c: Context): string {
  const route = matchedRoutes(c).findLast(r => r.path.startsWith(V1) && !r.path.endsWith('*'));
  const segment = route?.path.slice(V1.length).split('/')[0];
  return segment && !segment.startsWith(':') ? segment : 'other';
}

export type Counts = { requests: number; bytes: number; denied: number };
type Row = Counts & { day: number; subjectType: 'anon' | 'user'; subjectId: string; keyId: string; group: string };

/**
 * Request counters per UTC day, subject, key and route group (backend.md §5.5), held in memory and added
 * to usage_counter by `flush`. Also keeps each user's API-key requests today for the daily quota.
 */
export function createUsage(db: AppDb, { now = () => Date.now(), salt = randomBytes(16), logger = silentLogger }: { now?: () => number; salt?: Buffer; logger?: Logger } = {}) {
  const upsert = db.prepare(`
    INSERT INTO usage_counter (day, subject_type, subject_id, key_id, route_group, requests, bytes, denied)
    VALUES (@day, @subjectType, @subjectId, @keyId, @group, @requests, @bytes, @denied)
    ON CONFLICT (day, subject_type, subject_id, key_id, route_group) DO UPDATE SET
      requests = requests + excluded.requests, bytes = bytes + excluded.bytes, denied = denied + excluded.denied`);
  const keyRequestsOn = db.prepare(`
    SELECT subject_id AS userId, SUM(requests) AS requests FROM usage_counter
    WHERE day = ? AND subject_type = 'user' AND key_id != '' GROUP BY subject_id`);
  const history = db.prepare(`
    SELECT day, route_group AS "group", SUM(requests) AS requests, SUM(bytes) AS bytes, SUM(denied) AS denied
    FROM usage_counter WHERE subject_type = 'user' AND subject_id = ? AND day >= ?
    GROUP BY day, route_group`);
  const writeAll = db.transaction((rows: Row[]) => {
    for (const row of rows) upsert.run(row);
  });

  const pending = new Map<string, Row>();
  const quota = new Map<string, number>();
  let quotaDay = utcDay(now());
  for (const r of keyRequestsOn.all(quotaDay) as { userId: string; requests: number }[]) quota.set(r.userId, r.requests);

  function today() {
    const day = utcDay(now());
    if (day !== quotaDay) {
      quotaDay = day;
      quota.clear();
    }
    return day;
  }

  // Anonymous callers are counted by a salted hash that changes daily, never by address.
  const anonId = (ip: string, day: number) => createHmac('sha256', salt).update(`${day}|${addressBlock(ip)}`).digest('base64url').slice(0, 16);

  function bump(p: Principal, group: string, field: keyof Counts, n: number) {
    const day = today();
    const [subjectType, subjectId] = p.kind === 'anon' ? ['anon' as const, anonId(p.ip, day)] : ['user' as const, p.userId];
    const keyId = p.kind === 'key' ? p.keyId : '';
    const id = `${day}\n${subjectType}\n${subjectId}\n${keyId}\n${group}`;
    let row = pending.get(id);
    if (!row) pending.set(id, (row = { day, subjectType, subjectId, keyId, group, requests: 0, bytes: 0, denied: 0 }));
    row[field] += n;
    if (field === 'requests' && keyId) quota.set(subjectId, (quota.get(subjectId) ?? 0) + n);
  }

  function flush() {
    if (!pending.size) return;
    writeAll([...pending.values()]);
    pending.clear();
  }

  /** A user's counts per day and group over the last `days` days, unflushed ones included. */
  function report(userId: string, days = 30) {
    const until = today();
    const byDay = new Map<number, Record<string, Counts>>();
    const add = (r: Counts & { day: number; group: string }) => {
      const groups = byDay.get(r.day) ?? {};
      byDay.set(r.day, groups);
      const sum = (groups[r.group] ??= { requests: 0, bytes: 0, denied: 0 });
      sum.requests += r.requests;
      sum.bytes += r.bytes;
      sum.denied += r.denied;
    };
    for (const r of history.all(userId, until - days + 1) as (Counts & { day: number; group: string })[]) add(r);
    for (const r of pending.values()) if (r.subjectType === 'user' && r.subjectId === userId && r.day > until - days) add(r);
    return {
      today: isoDay(until),
      days: [...byDay].sort(([a], [b]) => a - b).map(([day, groups]) => ({ day: isoDay(day), groups })),
    };
  }

  return {
    admit: (p: Principal, group: string) => bump(p, group, 'requests', 1),
    deny: (p: Principal, group: string) => bump(p, group, 'denied', 1),
    addBytes: (p: Principal, group: string, bytes: number) => bump(p, group, 'bytes', bytes),
    /** API-key requests the user made today (UTC). */
    quotaUsed(userId: string) {
      today();
      return quota.get(userId) ?? 0;
    },
    flush,
    report,
    /** Flushes every `everyMs`; the returned stop() flushes once more. */
    start(everyMs = 10_000) {
      const timer = setInterval(() => {
        try {
          flush();
        } catch (err) {
          logger.error({ err }, 'usage flush failed; retrying next tick');
        }
      }, everyMs);
      timer.unref();
      return () => {
        clearInterval(timer);
        flush();
      };
    },
  };
}

export type Usage = ReturnType<typeof createUsage>;

/** Books the response size after the handler, under `group` or else routeGroup's; the rate limiter books requests and refusals. */
export function meter(usage: Usage, group?: string) {
  return createMiddleware<AccessEnv>(async (c, next) => {
    await next();
    // Only a declared length: measuring a streamed body would cost a copy of it.
    const bytes = Number(c.res.headers.get('content-length'));
    if (bytes > 0) usage.addBytes(c.var.principal, group ?? routeGroup(c), bytes);
  });
}
