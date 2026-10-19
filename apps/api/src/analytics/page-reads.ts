import { Hono } from 'hono';
import { parseVisitor } from '../access/map-time-input';
import type { AccessEnv } from '../access/middleware';
import { utcDay } from '../access/usage';
import type { AppDb } from '../db/app-db';

/** The public reading pages, by their English path: /map/<layer>, /city/<place>[/<topic>], /guides/<guide>, /about. */
const PAGE = /^\/(?:map|about|city|country|guides)(?:\/[a-z0-9-]{1,80}){0,2}$/;
const LOCALES = new Set(['en', 'tr', 'es', 'pt', 'fr', 'de', 'ru', 'ar', 'zh', 'ja']);
// Crawlers rarely run the script that reports a view; these few that do aren't readers.
const BOT = /bot|crawl|spider|slurp|preview|headless|lighthouse/i;
/** A page reloaded over and over counts this many times a day at most. */
const MAX_VIEWS = 50;

export type PageRead = { visitorId: string; path: string; locale: string; referrer: string };

/** A view report's body ({ visitor: { id, referrer }, path, locale }), or null when it isn't a reader on a public page. */
export function parsePageRead(body: unknown, userAgent: string | null | undefined): PageRead | null {
  if (userAgent && BOT.test(userAgent)) return null;
  const b = body as { visitor?: unknown; path?: unknown; locale?: unknown } | null;
  const visitor = parseVisitor(b?.visitor, userAgent);
  if (!visitor || typeof b?.path !== 'string' || !PAGE.test(b.path) || typeof b.locale !== 'string' || !LOCALES.has(b.locale)) return null;
  return { visitorId: visitor.id, path: b.path, locale: b.locale, referrer: visitor.referrer ?? '' };
}

export function createPageReads(db: AppDb, now = () => Date.now()) {
  const add = db.prepare(`
    INSERT INTO page_read (visitor_id, day, path, locale, referrer, views) VALUES (@visitorId, @day, @path, @locale, @referrer, 1)
    ON CONFLICT (visitor_id, day, path, locale, referrer) DO UPDATE SET views = min(views + 1, ${MAX_VIEWS})`);
  return { record: (read: PageRead) => void add.run({ ...read, day: utcDay(now()) }) };
}

export type PageReads = ReturnType<typeof createPageReads>;

/**
 * Mounted at /api/v1: POST /page-view is what a public page sends once as it opens. It counts toward nobody's map
 * time. Anything that isn't a view of a public page is accepted and dropped, so a page never learns why.
 */
export function pageReadRoutes(reads: PageReads) {
  const app = new Hono<AccessEnv>();
  app.post('/page-view', async c => {
    const read = parsePageRead(await c.req.json().catch(() => null), c.req.header('user-agent'));
    if (read) reads.record(read);
    return c.body(null, 204);
  });
  return app;
}
