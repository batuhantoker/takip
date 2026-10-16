import { createHmac, randomBytes } from 'node:crypto';
import { Hono } from 'hono';
import type { AppDb } from '../db/app-db';
import { addressBlock } from './client-ip';
import type { AccessEnv } from './middleware';
import type { Principal } from './principal';
import { DAY_MS, utcDay } from './usage';

// Two tabs ticking each minute still count one minute.
const MIN_TICK_GAP_MS = 50_000;

/** `limit` 0 means no limit. `resetsAt` is the next UTC midnight. */
export type MapTimeState = { limit: number; used: number; remaining: number; blocked: boolean; resetsAt: string };

type Row = { minutes: number; lastTickAt: number };

/**
 * Minutes of map a day against the plan's `map.minutes_per_day`, per account or per anonymous address block.
 * The web app ticks once a minute while a tab is visible and walls the map once the minutes run out; keys
 * have quotas instead and are never counted. `salt` keys the daily anonymous hash: pass a stable secret,
 * or a restart hands every visitor a fresh day.
 */
export function createMapTime(db: AppDb, { now = () => Date.now(), salt = randomBytes(16) as Buffer | string } = {}) {
  const read = db.prepare('SELECT minutes, last_tick_at AS lastTickAt FROM map_time WHERE day = ? AND subject_type = ? AND subject_id = ?');
  const tick = db.prepare(`
    INSERT INTO map_time (day, subject_type, subject_id, minutes, last_tick_at) VALUES (?, ?, ?, 1, ?)
    ON CONFLICT (day, subject_type, subject_id) DO UPDATE SET minutes = minutes + 1, last_tick_at = excluded.last_tick_at`);
  const prune = db.prepare('DELETE FROM map_time WHERE day < ?');
  let prunedBefore = -1;

  const subjectOf = (p: Exclude<Principal, { kind: 'key' }>, day: number) =>
    p.kind === 'anon'
      ? { type: 'anon', id: createHmac('sha256', salt).update(`map-time|${day}|${addressBlock(p.ip)}`).digest('base64url').slice(0, 16) }
      : { type: 'user', id: p.userId };

  /** The caller's minutes today; with `count`, this call is a tick and adds a minute unless one was just added. */
  function state(principal: Principal, limit: number, { count = false } = {}): MapTimeState {
    const at = now();
    const day = utcDay(at);
    const resetsAt = new Date((day + 1) * DAY_MS).toISOString();
    if (principal.kind === 'key' || limit === 0) return { limit: 0, used: 0, remaining: 0, blocked: false, resetsAt };
    if (prunedBefore !== day) {
      prune.run(day);
      prunedBefore = day;
    }
    const subject = subjectOf(principal, day);
    const row = read.get(day, subject.type, subject.id) as Row | undefined;
    let used = row?.minutes ?? 0;
    if (count && used < limit && (!row || at - row.lastTickAt >= MIN_TICK_GAP_MS)) {
      tick.run(day, subject.type, subject.id, at);
      used += 1;
    }
    return { limit, used, remaining: Math.max(0, limit - used), blocked: used >= limit, resetsAt };
  }

  return { state };
}

export type MapTime = ReturnType<typeof createMapTime>;

/** Mounted at /api/v1: GET reads the caller's map time today, POST is the web app's once-a-minute tick. */
export function mapTimeRoutes(mapTime: MapTime) {
  const app = new Hono<AccessEnv>();
  const NO_STORE = { 'Cache-Control': 'private, no-store' };
  const limitOf = (c: { var: AccessEnv['Variables'] }) => c.var.access.entitlements['map.minutes_per_day'];
  app.get('/me/time', c => c.json(mapTime.state(c.var.principal, limitOf(c)), 200, NO_STORE));
  app.post('/me/time', c => c.json(mapTime.state(c.var.principal, limitOf(c), { count: true }), 200, NO_STORE));
  return app;
}
