import { createHmac, randomBytes } from 'node:crypto';
import { Hono } from 'hono';
import type { AppDb } from '../db/app-db';
import { noLocator, type IpLocator } from '../geoip/ip-location';
import { activityBook, type ActionSubject } from './activity-book';
import { addressBlock } from './client-ip';
import { edgeCountry, parseActions, parseFeatures, parseVisitor, type ActionCounts, type VisitorTick } from './map-time-input';
import type { AccessEnv } from './middleware';
import type { Principal } from './principal';
import { DAY_MS, utcDay } from './usage';

// Two tabs ticking each minute still count one minute.
const MIN_TICK_GAP_MS = 50_000;

/** `limit` 0 means no limit. `resetsAt` is the next UTC midnight. */
export type MapTimeState = { limit: number; used: number; remaining: number; blocked: boolean; resetsAt: string };

type Row = { minutes: number; lastTickAt: number };

/** What a tick reports besides itself: features in use, the browser's visitor id, actions since the last tick, Cloudflare's country. */
export type TickReport = { features?: readonly string[]; visitor?: VisitorTick | null; actions?: ActionCounts; edgeCountry?: string | null };

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
 * account. The limit stays on the address block: an id the browser can clear can't buy more time. Each booked
 * minute also notes the address it came from (activity-book.ts), and actions are counted on every tick.
 */
export function createMapTime(db: AppDb, { now = () => Date.now(), salt = randomBytes(16) as Buffer | string, locate = noLocator as IpLocator } = {}) {
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
  const extra = activityBook(db, locate);

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

  /** True when this tick booked the visitor's minute (or wall tick) rather than being a second tab's. */
  const bookVisitor = db.transaction((day: number, at: number, visitor: VisitorTick, userId: string | null, walled: boolean, features: readonly string[]) => {
    seen.run({ ...visitor, at, userId });
    if (userId) return false;
    const last = readVisitorDay.get(visitor.id, day) as number | undefined;
    if (last !== undefined && at - last < MIN_TICK_GAP_MS) return false;
    visitorTick.run({ id: visitor.id, day, add: walled ? 0 : 1, at });
    if (!walled) visitorHour.run(visitor.id, day, new Date(at).getUTCHours());
    for (const name of walled ? ['view:wall'] : features) visitorFeature.run(visitor.id, day, name);
    return true;
  });

  /** Who an action belongs to: the account, else the browser's visitor id, else the day's address-block hash. */
  const actionSubject = (p: Exclude<Principal, { kind: 'key' }>, day: number, visitor: VisitorTick | null): ActionSubject =>
    p.kind === 'user' ? { type: 'user', id: p.userId } : visitor ? { type: 'visitor', id: visitor.id } : (subjectOf(p, day) as ActionSubject);

  /** The caller's minutes today; with `count`, this call is a tick and adds a minute unless one was just added. */
  function state(principal: Principal, limit: number, { count = false, report = {} as TickReport } = {}): MapTimeState {
    const at = now();
    const day = utcDay(at);
    const resetsAt = new Date((day + 1) * DAY_MS).toISOString();
    if (principal.kind === 'key') return { limit: 0, used: 0, remaining: 0, blocked: false, resetsAt };
    const { features = [], visitor = null, actions = [], edgeCountry: country = null } = report;
    const subject = subjectOf(principal, day);
    const row = read.get(day, subject.type, subject.id) as Row | undefined;
    let used = row?.minutes ?? 0;
    const walled = limit > 0 && used >= limit;
    if (count) {
      if (visitor && bookVisitor(day, at, visitor, principal.kind === 'user' ? principal.userId : null, walled, features)) {
        extra.place({ type: 'visitor', id: visitor.id }, principal.ip, at, walled ? 0 : 1, country);
      }
      if (!row || at - row.lastTickAt >= MIN_TICK_GAP_MS) {
        book(day, at, subject, walled, features);
        if (principal.kind === 'user') extra.place({ type: 'user', id: principal.userId }, principal.ip, at, walled ? 0 : 1, country);
        if (!walled) used += 1;
      }
    }
    if (actions.length) extra.actions(actionSubject(principal, day, visitor), day, actions);
    if (limit === 0) return { limit: 0, used, remaining: 0, blocked: false, resetsAt };
    return { limit, used, remaining: Math.max(0, limit - used), blocked: used >= limit, resetsAt };
  }

  /** Actions alone, from the page's flush as it's hidden or closed. */
  function countActions(principal: Principal, visitor: VisitorTick | null, actions: ActionCounts) {
    if (principal.kind === 'key' || !actions.length) return;
    const day = utcDay(now());
    extra.actions(actionSubject(principal, day, visitor), day, actions);
  }

  return { state, countActions };
}

export type MapTime = ReturnType<typeof createMapTime>;

type TickBody = { features?: unknown; visitor?: unknown; actions?: unknown } | null;

/**
 * Mounted at /api/v1: GET /me/time reads the caller's map time today, POST is the web app's once-a-minute tick
 * ({ features, visitor, actions } all optional), and POST /me/actions takes the actions a closing page still holds.
 * `cloudflare`: Cloudflare is the trusted edge, so its CF-IPCountry header can place an address the database can't.
 */
export function mapTimeRoutes(mapTime: MapTime, { cloudflare = false } = {}) {
  const app = new Hono<AccessEnv>();
  const NO_STORE = { 'Cache-Control': 'private, no-store' };
  const limitOf = (c: { var: AccessEnv['Variables'] }) => c.var.access.entitlements['map.minutes_per_day'];
  app.get('/me/time', c => c.json(mapTime.state(c.var.principal, limitOf(c)), 200, NO_STORE));
  app.post('/me/time', async c => {
    const body = (await c.req.json().catch(() => null)) as TickBody;
    const report: TickReport = {
      features: parseFeatures(body?.features),
      visitor: parseVisitor(body?.visitor, c.req.header('user-agent')),
      actions: parseActions(body?.actions),
      edgeCountry: edgeCountry(c.req.header('cf-ipcountry'), cloudflare),
    };
    return c.json(mapTime.state(c.var.principal, limitOf(c), { count: true, report }), 200, NO_STORE);
  });
  app.post('/me/actions', async c => {
    const body = (await c.req.json().catch(() => null)) as TickBody;
    mapTime.countActions(c.var.principal, parseVisitor(body?.visitor, c.req.header('user-agent')), parseActions(body?.actions));
    return c.body(null, 204);
  });
  return app;
}
