import { LOCALES, type Locale } from '@/lib/core/i18n/locales';
import { stmt } from '@/lib/core/read-db';
import { buildStamp, pagesDb } from './store';

/**
 * The indexed event pages for /event/sitemap/<n>.xml: every page in every language, 50,000 entries a file as the
 * place sitemaps have. Indexed pages are numbered in the index (event.seq), so a chunk is one range read.
 */
const PER_CHUNK = 50_000;
const EVENTS_PER_CHUNK = PER_CHUNK / LOCALES.length;

export const eventPath = (slug: string) => `/event/${slug}`;

function indexedCount(): number {
  const db = pagesDb();
  const v = db && (stmt(db, "SELECT v FROM meta WHERE k = 'indexed'").pluck().get() as string | undefined);
  return Number(v ?? 0);
}

export const eventSitemapIds = () => Array.from({ length: Math.ceil(indexedCount() / EVENTS_PER_CHUNK) }, (_, id) => ({ id }));

let held: { stamp: string; id: number; rows: { path: string; locale: Locale }[] } | null = null;

/** A chunk's entries as [English path, the language to list it in]. */
export function eventSitemapChunk(id: number): { path: string; locale: Locale }[] {
  const db = pagesDb();
  if (!db || !Number.isInteger(id) || id < 0) return [];
  const stamp = buildStamp();
  if (held?.stamp === stamp && held.id === id) return held.rows;
  const slugs = stmt(db, 'SELECT slug FROM event WHERE seq >= ? AND seq < ? ORDER BY seq').pluck()
    .all(id * EVENTS_PER_CHUNK, (id + 1) * EVENTS_PER_CHUNK) as string[];
  const rows = slugs.flatMap(slug => LOCALES.map(locale => ({ path: eventPath(slug), locale })));
  held = { stamp, id, rows };
  return rows;
}

/** For robots.txt and the sitemap index. */
export const eventSitemapUrls = (origin: string) => eventSitemapIds().map(({ id }) => `${origin}/event/sitemap/${id}.xml`);
