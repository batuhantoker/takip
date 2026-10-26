import { createHmac, randomBytes } from 'node:crypto';
import { Hono } from 'hono';
import type { AppDb } from '../db/app-db';
import { noLocator, type IpLocator } from '../geoip/ip-location';
import type { Presence } from '../analytics/presence';
import { parseUserAgent } from '../analytics/user-agent';
import { activityBook, type ActionSubject, type NamePoint, type PlaceSubject } from './activity-book';
import { addressBlock } from './client-ip';
import { edgeCountry, parseActions, parseDevice, parseFeatures, parseVisitor, type ActionCounts, type DeviceFix, type VisitorTick } from './map-time-input';
import type { AccessEnv } from './middleware';
import type { Principal } from './principal';
import { DAY_MS, utcDay } from './usage';

// Two tabs ticking each minute still count one minute.
const MIN_TICK_GAP_MS = 50_000;

/** `limit` 0 means no limit. `resetsAt` is the next UTC midnight. */
export type MapTimeState = { limit: number; used: number; remaining: number; blocked: boolean; resetsAt: string };

type Row = { charged: number; lastTickAt: number; chargedAt: number };

/** What a tick reports besides itself: whether it opens the map, features in use, the browser's visitor id, actions since the
 * last tick, a location the person shared, Cloudflare's country. */
export type TickReport = { opening?: boolean; features?: readonly string[]; visitor?: VisitorTick | null; actions?: ActionCounts; device?: DeviceFix | null; edgeCountry?: string | null };

/**
 * Minutes of map a day against the plan's `map.minutes_per_day`, per account or per anonymous address block.
 * The web app ticks once a minute while a tab is visible and in use (use-map-time.ts) and walls the map once the minutes
 * run out; keys have quotas instead and are never counted. Unlimited plans are counted too, for the admin's analytics.
 *
 * Two counts, each with its own one-a-minute check: `charged` is the minutes against the limit, one per tick; `minutes`
 * is each minute begun on the map, for analytics. The tick that opens the map (`opening`, a few seconds in) begins a
 * minute but charges none, so a visit shorter than a minute still counts one and the limit is as it was. Each minute
 * begun is split by the features the tick reports (feature_time) and booked to its UTC hour (activity_hour). A tick
 * behind the wall books 'view:wall' instead. `salt` keys the daily anonymous hash: pass a stable secret, or a restart
 * hands every visitor a fresh day. Old days go with usage-prune.ts.
 *
 * A tick may also name the browser's visitor id. Signed out, its minutes are booked to that id as well, with their
 * own one-a-minute check, since several visitors can share an address block; signed in, the id is linked to the
 * account. The limit stays on the address block: an id the browser can clear can't buy more time. Each booked
 * minute also notes the address it came from (activity-book.ts), and actions are counted on every tick. Each tick
 * also tells `presence` who is on the map now and what they have open.
 */
export function createMapTime(db: AppDb, { now = () => Date.now(), salt = randomBytes(16) as Buffer | string, locate = noLocator as IpLocator, name = undefined as NamePoint | undefined, presence = null as Presence | null } = {}) {
  const read = db.prepare('SELECT charged, last_tick_at AS lastTickAt, charged_at AS chargedAt FROM map_time WHERE day = ? AND subject_type = ? AND subject_id = ?');
  // Behind the wall it adds 0: the tick only keeps its minute for the one-a-minute check.
  const begin = db.prepare(`
    INSERT INTO map_time (day, subject_type, subject_id, minutes, last_tick_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (day, subject_type, subject_id) DO UPDATE SET minutes = minutes + excluded.minutes, last_tick_at = excluded.last_tick_at`);
  const charge = db.prepare('UPDATE map_time SET charged = charged + 1, charged_at = ? WHERE day = ? AND subject_type = ? AND subject_id = ?');
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
  const extra = activityBook(db, locate, name);

  const subjectOf = (p: Exclude<Principal, { kind: 'key' }>, day: number) =>
    p.kind === 'anon'
      ? { type: 'anon', id: createHmac('sha256', salt).update(`map-time|${day}|${addressBlock(p.ip)}`).digest('base64url').slice(0, 16) }
      : { type: 'user', id: p.userId };

  // A charge always follows a minute begun on a new row, so the row is there to charge.
  const book = db.transaction((day: number, at: number, subject: { type: string; id: string }, { begun, charged, walled, features }: { begun: boolean; charged: boolean; walled: boolean; features: readonly string[] }) => {
    if (begun) {
      begin.run(day, subject.type, subject.id, walled ? 0 : 1, at);
      if (!walled) {
        hour.run(day, new Date(at).getUTCHours(), subject.type);
        if (subject.type === 'user') userHour.run(subject.id, day, new Date(at).getUTCHours());
      }
      for (const name of walled ? ['view:wall'] : features) feature.run(day, subject.type, subject.id, name);
    }
    if (charged) charge.run(at, day, subject.type, subject.id);
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

  /** Shared locations belong to the account, else the browser's visitor id; without either there's no one to note them for. */
  const deviceSubject = (p: Exclude<Principal, { kind: 'key' }>, visitor: VisitorTick | null): PlaceSubject | null =>
    p.kind === 'user' ? { type: 'user', id: p.userId } : visitor ? { type: 'visitor', id: visitor.id } : null;

  const noteDevice = (p: Exclude<Principal, { kind: 'key' }>, visitor: VisitorTick | null, fix: DeviceFix | null | undefined, at: number) => {
    const subject = fix && deviceSubject(p, visitor);
    if (fix && subject) extra.device(subject, fix, at);
  };

  /** The caller's minutes today; with `count`, this call is a tick and adds a minute unless one was just added. */
  function state(principal: Principal, limit: number, { count = false, report = {} as TickReport } = {}): MapTimeState {
    const at = now();
    const day = utcDay(at);
    const resetsAt = new Date((day + 1) * DAY_MS).toISOString();
    if (principal.kind === 'key') return { limit: 0, used: 0, remaining: 0, blocked: false, resetsAt };
    const { opening = false, features = [], visitor = null, actions = [], device = null, edgeCountry: country = null } = report;
    const subject = subjectOf(principal, day);
    const row = read.get(day, subject.type, subject.id) as Row | undefined;
    let used = row?.charged ?? 0;
    const walled = limit > 0 && used >= limit;
    if (count) {
      if (visitor && bookVisitor(day, at, visitor, principal.kind === 'user' ? principal.userId : null, walled, features)) {
        extra.place({ type: 'visitor', id: visitor.id }, principal.ip, at, walled ? 0 : 1, country);
      }
      const begun = !row || at - row.lastTickAt >= MIN_TICK_GAP_MS;
      const charged = !walled && !opening && (!row || at - row.chargedAt >= MIN_TICK_GAP_MS);
      if (begun || charged) book(day, at, subject, { begun, charged, walled, features });
      if (begun && principal.kind === 'user') extra.place({ type: 'user', id: principal.userId }, principal.ip, at, walled ? 0 : 1, country);
      if (charged) used += 1;
      presence?.note({
        key: visitor?.id ?? `${subject.type}:${subject.id}`,
        kind: 'map',
        visitorId: visitor?.id ?? null,
        userId: principal.kind === 'user' ? principal.userId : null,
        path: '/',
        features: walled ? ['view:wall'] : features,
        actions: actions.map(([action]) => action),
        // The tick's referrer is the browser's first arrival ever; the map's opening view carries this visit's.
        referrer: null,
        place: locate(principal.ip),
        agent: visitor?.userAgent ? parseUserAgent(visitor.userAgent) : null,
        at,
      });
    }
    if (actions.length) extra.actions(actionSubject(principal, day, visitor), day, actions);
    // A second tab's tick still carries a fresh fix, so this isn't behind the minute's check.
    if (count) noteDevice(principal, visitor, device, at);
    if (limit === 0) return { limit: 0, used, remaining: 0, blocked: false, resetsAt };
    return { limit, used, remaining: Math.max(0, limit - used), blocked: used >= limit, resetsAt };
  }

  /** Actions (and a last shared location) alone, from the page's flush as it's hidden or closed. */
  function countActions(principal: Principal, visitor: VisitorTick | null, actions: ActionCounts, device: DeviceFix | null = null) {
    if (principal.kind === 'key') return;
    const at = now();
    const day = utcDay(at);
    if (actions.length) extra.actions(actionSubject(principal, day, visitor), day, actions);
    noteDevice(principal, visitor, device, at);
  }

  return { state, countActions };
}

export type MapTime = ReturnType<typeof createMapTime>;

type TickBody = { opening?: unknown; features?: unknown; visitor?: unknown; actions?: unknown; device?: unknown } | null;

/**
 * Mounted at /api/v1: GET /me/time reads the caller's map time today, POST is the web app's once-a-minute tick
 * ({ opening, features, visitor, actions, device } all optional), and POST /me/actions takes what a closing page still holds.
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
      opening: body?.opening === true,
      features: parseFeatures(body?.features),
      visitor: parseVisitor(body?.visitor, c.req.header('user-agent')),
      actions: parseActions(body?.actions),
      device: parseDevice(body?.device),
      edgeCountry: edgeCountry(c.req.header('cf-ipcountry'), cloudflare),
    };
    return c.json(mapTime.state(c.var.principal, limitOf(c), { count: true, report }), 200, NO_STORE);
  });
  app.post('/me/actions', async c => {
    const body = (await c.req.json().catch(() => null)) as TickBody;
    mapTime.countActions(c.var.principal, parseVisitor(body?.visitor, c.req.header('user-agent')), parseActions(body?.actions), parseDevice(body?.device));
    return c.body(null, 204);
  });
  return app;
}
