import { createHmac, randomBytes } from 'node:crypto';
import { Hono } from 'hono';
import type { AppDb } from '../db/app-db';
import { addressBlock } from './client-ip';
import type { AccessEnv } from './middleware';
import type { Principal } from './principal';
import { DAY_MS, utcDay } from './usage';

// Two tabs ticking each minute still count one minute.
const MIN_TICK_GAP_MS = 50_000;
const MAX_FEATURES = 48;

/** `limit` 0 means no limit. `resetsAt` is the next UTC midnight. */
export type MapTimeState = { limit: number; used: number; remaining: number; blocked: boolean; resetsAt: string };

type Row = { minutes: number; lastTickAt: number };

// What the web app may report with a tick. Layer keys are many and change with the app, so only their shape is checked.
const FEATURES: Record<string, ReadonlySet<string> | RegExp> = {
  view: new Set(['map', 'space', 'history', 'replay']),
  panel: new Set(['none', 'layers', 'ai', 'draw', 'alerts', 'history', 'recon', 'directions', 'space', 'arcgis', 'markets', 'intel', 'search']),
  window: new Set(['camera', 'feed', 'dossier', 'search']),
  device: new Set(['desktop', 'mobile']),
  layer: /^[a-z][a-z0-9_]{0,39}$/,
};

/** A browser's own id and how it first arrived, from the tick body; the user agent comes from the request. */
export type VisitorTick = { id: string; userAgent: string | null; referrer: string | null; landing: string | null };

const VISITOR_ID = /^[A-Za-z0-9_-]{16,64}$/;
const HOST = /^[a-z0-9.-]{1,200}$/i;
// Landing pages can carry one-time tokens (password reset links), so only campaign and share parameters stay.
const KEPT_PARAM = /^(utm_[a-z]+|ref|source|w)$/;

/** The `visitor` part of a tick body, or null when it has no usable id. */
export function parseVisitor(input: unknown, userAgent: string | null | undefined): VisitorTick | null {
  const v = input as { id?: unknown; referrer?: unknown; landing?: unknown } | null;
  if (!v || typeof v.id !== 'string' || !VISITOR_ID.test(v.id)) return null;
  const referrer = typeof v.referrer === 'string' && HOST.test(v.referrer) ? v.referrer.toLowerCase() : null;
  let landing: string | null = null;
  if (typeof v.landing === 'string' && v.landing.startsWith('/') && v.landing.length <= 2000) {
    const url = new URL(v.landing, 'http://local');
    const kept = [...url.searchParams].filter(([name]) => KEPT_PARAM.test(name)).slice(0, 8);
    landing = (url.pathname + (kept.length ? `?${new URLSearchParams(kept)}` : '')).slice(0, 300);
  }
  return { id: v.id, userAgent: userAgent?.slice(0, 400) || null, referrer, landing };
}

/** The known `kind:name` features in a tick body, deduplicated; anything else is dropped. */
export function parseFeatures(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out = new Set<string>();
  for (const item of input) {
    if (typeof item !== 'string' || out.size >= MAX_FEATURES) continue;
    const [kind, name, extra] = item.split(':');
    const allowed = FEATURES[kind];
    if (extra !== undefined || !name || !allowed) continue;
    if (allowed instanceof RegExp ? allowed.test(name) : allowed.has(name)) out.add(item);
  }
  return [...out];
}

/**
 * Minutes of map a day against the plan's `map.minutes_per_day`, per account or per anonymous address block.
 * The web app ticks once a minute while a tab is visible and walls the map once the minutes run out; keys
 * have quotas instead and are never counted. Unlimited plans are counted too, for the admin's analytics, and each
 * counted minute is split by the features the tick reports (feature_time) and booked to its UTC hour (activity_hour).
 * A tick behind the wall books 'view:wall' instead. `salt` keys the daily anonymous hash: pass a stable secret,
 * or a restart hands every visitor a fresh day. Old days go with usage-prune.ts.
 *
 * A tick may also name the browser's visitor id. Signed out, its minutes are booked to that id as well, with their
 * own one-a-minute check, since several visitors can share an address block; signed in, the id is linked to the
 * account. The limit stays on the address block: an id the browser can clear can't buy more time.
 */
export function createMapTime(db: AppDb, { now = () => Date.now(), salt = randomBytes(16) as Buffer | string } = {}) {
  const read = db.prepare('SELECT minutes, last_tick_at AS lastTickAt FROM map_time WHERE day = ? AND subject_type = ? AND subject_id = ?');
  const tick = db.prepare(`
    INSERT INTO map_time (day, subject_type, subject_id, minutes, last_tick_at) VALUES (?, ?, ?, 1, ?)
    ON CONFLICT (day, subject_type, subject_id) DO UPDATE SET minutes = minutes + 1, last_tick_at = excluded.last_tick_at`);
  const touch = db.prepare('UPDATE map_time SET last_tick_at = ? WHERE day = ? AND subject_type = ? AND subject_id = ?');
  const feature = db.prepare(`
    INSERT INTO feature_time (day, subject_type, subject_id, feature, minutes) VALUES (?, ?, ?, ?, 1)
    ON CONFLICT (day, subject_type, subject_id, feature) DO UPDATE SET minutes = minutes + 1`);
  const hour = db.prepare(`
    INSERT INTO activity_hour (day, hour, subject_type, minutes) VALUES (?, ?, ?, 1)
    ON CONFLICT (day, hour, subject_type) DO UPDATE SET minutes = minutes + 1`);
  const userHour = db.prepare(`
    INSERT INTO user_hour (user_id, day, hour, minutes) VALUES (?, ?, ?, 1)
    ON CONFLICT (user_id, day, hour) DO UPDATE SET minutes = minutes + 1`);
  const seen = db.prepare(`
    INSERT INTO visitor (visitor_id, first_seen_at, last_seen_at, user_agent, referrer, landing, user_id, linked_at)
    VALUES (@id, @at, @at, @userAgent, @referrer, @landing, @userId, CASE WHEN @userId IS NULL THEN NULL ELSE @at END)
    ON CONFLICT (visitor_id) DO UPDATE SET
      last_seen_at = excluded.last_seen_at,
      user_agent = coalesce(excluded.user_agent, user_agent),
      linked_at = CASE WHEN excluded.user_id IS NOT NULL AND excluded.user_id IS NOT user_id THEN excluded.last_seen_at ELSE linked_at END,
      user_id = coalesce(excluded.user_id, user_id)`);
  const readVisitorDay = db.prepare('SELECT last_tick_at FROM visitor_day WHERE visitor_id = ? AND day = ?').pluck();
  const visitorTick = db.prepare(`
    INSERT INTO visitor_day (visitor_id, day, minutes, last_tick_at) VALUES (@id, @day, @add, @at)
    ON CONFLICT (visitor_id, day) DO UPDATE SET minutes = minutes + excluded.minutes, last_tick_at = excluded.last_tick_at`);
  const visitorFeature = db.prepare(`
    INSERT INTO visitor_feature (visitor_id, day, feature, minutes) VALUES (?, ?, ?, 1)
    ON CONFLICT (visitor_id, day, feature) DO UPDATE SET minutes = minutes + 1`);
  const visitorHour = db.prepare(`
    INSERT INTO visitor_hour (visitor_id, day, hour, minutes) VALUES (?, ?, ?, 1)
    ON CONFLICT (visitor_id, day, hour) DO UPDATE SET minutes = minutes + 1`);

  const subjectOf = (p: Exclude<Principal, { kind: 'key' }>, day: number) =>
    p.kind === 'anon'
      ? { type: 'anon', id: createHmac('sha256', salt).update(`map-time|${day}|${addressBlock(p.ip)}`).digest('base64url').slice(0, 16) }
      : { type: 'user', id: p.userId };

  const book = db.transaction((day: number, at: number, subject: { type: string; id: string }, walled: boolean, features: readonly string[]) => {
    if (walled) touch.run(at, day, subject.type, subject.id);
    else {
      tick.run(day, subject.type, subject.id, at);
      hour.run(day, new Date(at).getUTCHours(), subject.type);
      if (subject.type === 'user') userHour.run(subject.id, day, new Date(at).getUTCHours());
    }
    for (const name of walled ? ['view:wall'] : features) feature.run(day, subject.type, subject.id, name);
  });

  const bookVisitor = db.transaction((day: number, at: number, visitor: VisitorTick, userId: string | null, walled: boolean, features: readonly string[]) => {
    seen.run({ ...visitor, at, userId });
    if (userId) return;
    const last = readVisitorDay.get(visitor.id, day) as number | undefined;
    if (last !== undefined && at - last < MIN_TICK_GAP_MS) return;
    visitorTick.run({ id: visitor.id, day, add: walled ? 0 : 1, at });
    if (!walled) visitorHour.run(visitor.id, day, new Date(at).getUTCHours());
    for (const name of walled ? ['view:wall'] : features) visitorFeature.run(visitor.id, day, name);
  });

  /** The caller's minutes today; with `count`, this call is a tick and adds a minute unless one was just added. */
  function state(principal: Principal, limit: number, { count = false, features = [] as readonly string[], visitor = null as VisitorTick | null } = {}): MapTimeState {
    const at = now();
    const day = utcDay(at);
    const resetsAt = new Date((day + 1) * DAY_MS).toISOString();
    if (principal.kind === 'key') return { limit: 0, used: 0, remaining: 0, blocked: false, resetsAt };
    const subject = subjectOf(principal, day);
    const row = read.get(day, subject.type, subject.id) as Row | undefined;
    let used = row?.minutes ?? 0;
    const walled = limit > 0 && used >= limit;
    if (count && visitor) bookVisitor(day, at, visitor, principal.kind === 'user' ? principal.userId : null, walled, features);
    if (count && (!row || at - row.lastTickAt >= MIN_TICK_GAP_MS)) {
      book(day, at, subject, walled, features);
      if (!walled) used += 1;
    }
    if (limit === 0) return { limit: 0, used, remaining: 0, blocked: false, resetsAt };
    return { limit, used, remaining: Math.max(0, limit - used), blocked: used >= limit, resetsAt };
  }

  return { state };
}

export type MapTime = ReturnType<typeof createMapTime>;

/** Mounted at /api/v1: GET reads the caller's map time today, POST is the web app's once-a-minute tick ({ features, visitor } optional). */
export function mapTimeRoutes(mapTime: MapTime) {
  const app = new Hono<AccessEnv>();
  const NO_STORE = { 'Cache-Control': 'private, no-store' };
  const limitOf = (c: { var: AccessEnv['Variables'] }) => c.var.access.entitlements['map.minutes_per_day'];
  app.get('/me/time', c => c.json(mapTime.state(c.var.principal, limitOf(c)), 200, NO_STORE));
  app.post('/me/time', async c => {
    const body = (await c.req.json().catch(() => null)) as { features?: unknown; visitor?: unknown } | null;
    const features = parseFeatures(body?.features);
    const visitor = parseVisitor(body?.visitor, c.req.header('user-agent'));
    return c.json(mapTime.state(c.var.principal, limitOf(c), { count: true, features, visitor }), 200, NO_STORE);
  });
  return app;
}
