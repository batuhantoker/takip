import { LOCALES, type Locale } from '@/lib/core/i18n/locales';
import { countryOf } from './copy';
import { mountainPath } from './mountain-page';
import { countrySummaries, indexedCount, indexedSlugs, mountainsStamp } from './store';

/**
 * The indexed mountain pages for /mountain/sitemap/<n>.xml, every page in every language, 50,000 entries a file as
 * the event and place sitemaps have; numbered in the index (mountain.seq), so a chunk is one range read.
 */
const PER_CHUNK = 50_000;
const PER_FILE = PER_CHUNK / LOCALES.length;

/** /mountains, or a country's list: /mountains/turkey. */
export const mountainsPath = (cc?: string) => {
  const slug = cc && countryOf(cc)?.slug;
  return slug ? `/mountains/${slug}` : '/mountains';
};

/** A country's list is worth a search result once it names this many peaks whose own pages are indexed. */
export const COUNTRY_INDEX_MIN = 5;

/** The lists for the main sitemap: /mountains and each country's that is indexed; none before the index is built. */
export function mountainListPaths(): string[] {
  if (!indexedCount()) return [];
  return [mountainsPath(), ...countrySummaries().filter(c => c.indexed >= COUNTRY_INDEX_MIN).map(c => mountainsPath(c.cc)).filter(p => p !== mountainsPath())];
}

/** A mountain page's share card, drawn by /og in its language. */
export const mountainImage = (slug: string, locale: Locale) => `/og?mountain=${encodeURIComponent(slug)}&lang=${locale}`;

/** A list's card: the world's (`cc` left out) or a country's. */
export const mountainsImage = (cc: string | null, locale: Locale) => `/og?mountains=${cc ?? 'world'}&lang=${locale}`;

export const mountainSitemapIds = () => Array.from({ length: Math.ceil(indexedCount() / PER_FILE) }, (_, id) => ({ id }));

let held: { stamp: string | null; id: number; rows: { path: string; locale: Locale }[] } | null = null;

export function mountainSitemapChunk(id: number): { path: string; locale: Locale }[] {
  if (!Number.isInteger(id) || id < 0) return [];
  const stamp = mountainsStamp();
  if (held && held.stamp === stamp && held.id === id) return held.rows;
  const rows = indexedSlugs(id * PER_FILE, (id + 1) * PER_FILE).flatMap(slug => LOCALES.map(locale => ({ path: mountainPath(slug), locale })));
  held = { stamp, id, rows };
  return rows;
}

/** For robots.txt and the sitemap index. */
export const mountainSitemapUrls = (origin: string) => mountainSitemapIds().map(({ id }) => `${origin}/mountain/sitemap/${id}.xml`);
