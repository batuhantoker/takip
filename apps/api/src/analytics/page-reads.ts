import { Hono } from 'hono';
import { clientIpOf } from '../access/client-ip';
import { edgeCountry, parseVisitor } from '../access/map-time-input';
import type { AccessEnv } from '../access/middleware';
import { DAY_MS, utcDay } from '../access/usage';
import type { AppDb } from '../db/app-db';
import { noLocator, type IpLocator } from '../geoip/ip-location';
import type { Presence } from './presence';
import { linkPathOf } from './sources';
import { parseUserAgent } from './user-agent';

/**
 * The public reading pages, by their English path: /map/<layer>, /city/<place>[/<topic>], /event/<slug>, /about and the
 * rest. Any lowercase path up to three deep, so a new section counts without a change here; the app's own areas don't.
 */
const PAGE = /^\/(?!(?:admin|docs|api|account|embed|w)(?:\/|$))[a-z][a-z0-9-]{0,40}(?:\/[a-z0-9-]{1,120}){0,2}$/;
/** The map itself: its opening goes in the view log, so a visit can be seen reaching it, but it isn't a page read. */
export const MAP_PATH = '/';
const LOCALES = new Set(['en', 'tr', 'es', 'pt', 'fr', 'de', 'ru', 'ar', 'zh', 'ja']);
// Crawlers rarely run the script that reports a view; these few that do aren't readers.
const BOT = /bot|crawl|spider|slurp|preview|headless|lighthouse/i;
/** A page reloaded over and over counts this many times a day at most. */
const MAX_VIEWS = 50;
/** Views logged one by one per browser a day; the daily counts go on past it. */
const MAX_LOGGED = 300;
// The same page again this soon is a reload or a double report, not another step.
const REPEAT_MS = 10_000;
const CAMPAIGN = /^[a-z0-9._-]{1,60}$/;
// A page's small map reports at most a minute a minute; a little less lets a late timer through.
const MAP_MINUTE_GAP_MS = 50_000;

export type PageRead = {
  visitorId: string; path: string; locale: string; referrer: string;
  /** The linking page on the referring site, when it shares more than its address (sources.ts linkPathOf). */
  referrerPath: string | null;
  /** The page this tab showed before, by English path ('/' for the map). */
  from: string | null;
  /** utm_source, ref or source on the address it opened with. */
  campaign: string | null;
  userAgent: string | null;
};

/** Where the request came from: its address (placed, then dropped), Cloudflare's country, the signed-in account. */
export type ReadContext = { ip: string; country: string | null; userId: string | null };

// The database places an address at its town's centre at best; two decimals (about a kilometre) is all it knows.
const round2 = (n: number | null | undefined) => (n == null ? null : Math.round(n * 100) / 100);

const isPage = (path: unknown): path is string => typeof path === 'string' && (path === MAP_PATH || PAGE.test(path));

function campaignOf(landing: string | null) {
  const query = landing?.split('?')[1];
  if (!query) return null;
  const params = new URLSearchParams(query);
  const source = (params.get('utm_source') ?? params.get('ref') ?? params.get('source'))?.toLowerCase();
  return source && CAMPAIGN.test(source) ? source : null;
}

/**
 * A view report's body ({ visitor: { id, referrer, landing }, path, locale, from, referrerPath }), or null when it isn't a
 * reader on a public page or the map.
 */
export function parsePageRead(body: unknown, userAgent: string | null | undefined): PageRead | null {
  if (userAgent && BOT.test(userAgent)) return null;
  const b = body as { visitor?: unknown; path?: unknown; locale?: unknown; from?: unknown; referrerPath?: unknown } | null;
  const visitor = parseVisitor(b?.visitor, userAgent);
  if (!visitor || !isPage(b?.path) || typeof b.locale !== 'string' || !LOCALES.has(b.locale)) return null;
  return {
    visitorId: visitor.id, path: b.path, locale: b.locale, referrer: visitor.referrer ?? '', referrerPath: linkPathOf(visitor.referrer, b.referrerPath),
    from: isPage(b.from) ? b.from : null, campaign: campaignOf(visitor.landing), userAgent: visitor.userAgent,
  };
}

export type MapMinute = { visitorId: string; path: string; userAgent: string | null };

/** A minute on a public page's small map ({ visitor: { id }, path, use: 'map' }), or null when it isn't one. */
export function parseMapMinute(body: unknown, userAgent: string | null | undefined): MapMinute | null {
  if (userAgent && BOT.test(userAgent)) return null;
  const b = body as { visitor?: unknown; path?: unknown; use?: unknown } | null;
  const visitor = parseVisitor(b?.visitor, userAgent);
  if (b?.use !== 'map' || !visitor || !isPage(b.path) || b.path === MAP_PATH) return null;
  return { visitorId: visitor.id, path: b.path, userAgent: visitor.userAgent };
}

/** On a page, the presence feature that says its small map is in use. */
export const SMALL_MAP_FEATURE = 'view:embed';

export function createPageReads(db: AppDb, { now = () => Date.now(), locate = noLocator as IpLocator, presence = null as Presence | null } = {}) {
  const add = db.prepare(`
    INSERT INTO page_read (visitor_id, day, path, locale, referrer, views) VALUES (@visitorId, @day, @path, @locale, @referrer, 1)
    ON CONFLICT (visitor_id, day, path, locale, referrer) DO UPDATE SET views = min(views + 1, ${MAX_VIEWS})`);
  const logged = db.prepare(`
    SELECT count(*) AS views, coalesce(max(path = @path AND at > @at - ${REPEAT_MS}), 0) AS repeat
    FROM page_view WHERE visitor_id = @visitorId AND at >= @dayStart`);
  const log = db.prepare(`
    INSERT INTO page_view (visitor_id, at, day, path, locale, referrer, referrer_path, from_path, campaign, country, region, city, latitude, longitude, browser, os, device)
    VALUES (@visitorId, @at, @day, @path, @locale, @referrer, @referrerPath, @from, @campaign, @country, @region, @city, @latitude, @longitude, @browser, @os, @device)`);
  const minute = db.prepare(`
    INSERT INTO page_map_minute (visitor_id, day, hour, path, minutes, last_at) VALUES (@visitorId, @day, @hour, @path, 1, @at)
    ON CONFLICT (visitor_id, day, hour, path) DO UPDATE SET minutes = minutes + 1, last_at = excluded.last_at
    WHERE excluded.last_at - last_at >= ${MAP_MINUTE_GAP_MS} AND minutes < 60`);

  const placeOf = (ip: string, country: string | null) => locate(ip) ?? (country ? { country, region: null, city: null, latitude: null, longitude: null } : null);

  function record(read: PageRead, { ip, country, userId }: ReadContext) {
    const at = now();
    const day = utcDay(at);
    if (read.path !== MAP_PATH) add.run({ visitorId: read.visitorId, day, path: read.path, locale: read.locale, referrer: read.referrer });
    const place = placeOf(ip, country);
    const agent = parseUserAgent(read.userAgent);
    presence?.note({
      key: read.visitorId, kind: read.path === MAP_PATH ? 'map' : 'page', visitorId: read.visitorId, userId, path: read.path,
      features: [], referrer: read.referrer || null, place, agent, at,
    });
    const seen = logged.get({ visitorId: read.visitorId, path: read.path, at, dayStart: day * DAY_MS }) as { views: number; repeat: number };
    if (seen.views >= MAX_LOGGED || seen.repeat) return;
    log.run({
      visitorId: read.visitorId, at, day, path: read.path, locale: read.locale, referrer: read.referrer, referrerPath: read.referrerPath,
      from: read.from, campaign: read.campaign, country: place?.country ?? null, region: place?.region ?? null, city: place?.city ?? null,
      latitude: round2(place?.latitude), longitude: round2(place?.longitude),
      browser: agent.browser, os: agent.os, device: agent.device,
    });
  }

  function recordMapMinute({ visitorId, path, userAgent }: MapMinute, { ip, country, userId }: ReadContext) {
    const at = now();
    minute.run({ visitorId, path, day: utcDay(at), hour: new Date(at).getUTCHours(), at });
    // Keeps the reader on Live while they use the map, past the page view's five minutes.
    presence?.note({
      key: visitorId, kind: 'page', visitorId, userId, path, features: [SMALL_MAP_FEATURE], referrer: null,
      place: placeOf(ip, country), agent: parseUserAgent(userAgent), at,
    });
  }

  return { record, recordMapMinute };
}

export type PageReads = ReturnType<typeof createPageReads>;

/**
 * Mounted at /api/v1: POST /page-view is what a public page sends once as it opens, the map as it loads, and a page's
 * small map for each minute the reader moves it (`use: 'map'`). It counts toward nobody's map time. Anything that isn't one of those is accepted and dropped, so a page never learns why.
 * `cloudflare`: Cloudflare is the trusted edge, so its CF-IPCountry header can place an address the database can't.
 */
export function pageReadRoutes(reads: PageReads, { cloudflare = false } = {}) {
  const app = new Hono<AccessEnv>();
  app.post('/page-view', async c => {
    const body: unknown = await c.req.json().catch(() => null);
    const principal = c.var.principal;
    const context = (): ReadContext => ({
      ip: clientIpOf(c),
      country: edgeCountry(c.req.header('cf-ipcountry'), cloudflare),
      userId: principal?.kind === 'user' ? principal.userId : null,
    });
    const use = parseMapMinute(body, c.req.header('user-agent'));
    if (use) {
      reads.recordMapMinute(use, context());
      return c.body(null, 204);
    }
    const read = parsePageRead(body, c.req.header('user-agent'));
    if (read) reads.record(read, context());
    return c.body(null, 204);
  });
  return app;
}
