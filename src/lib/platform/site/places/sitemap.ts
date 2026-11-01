import { LOCALES, type Locale } from '@/lib/core/i18n/locales';
import { compareSitemapPaths } from '../compare/sitemap';
import { searchScope } from '../search-scope';
import { indexedPages } from './pages';
import { placePath } from './paths';

/**
 * Every indexed page in each language search's scope takes it in, 50,000 entries a file (the limit), about 6 MB. The
 * alternates are in each page's head, not here: with them an entry is ten times the size.
 */
const PER_CHUNK = 50_000;

// The country comparisons (compare/) are chunked with them.
const entries = (): { path: string; locale: Locale }[] =>
  [...indexedPages().map(({ place, slug }) => placePath(place, slug)), ...compareSitemapPaths()]
    .flatMap(path => LOCALES.filter(locale => searchScope(path, locale)).map(locale => ({ path, locale })));

/** One spare chunk: the camera pages are counted when the server runs, and may outgrow the build's count. */
export const placeSitemapIds = () => Array.from({ length: Math.ceil(entries().length / PER_CHUNK) + 1 }, (_, id) => ({ id }));

/** A chunk's entries as [English path, the language to list it in]. */
export function placeSitemapChunk(id: number): { path: string; locale: Locale }[] {
  if (!Number.isInteger(id) || id < 0) return [];
  return entries().slice(id * PER_CHUNK, (id + 1) * PER_CHUNK);
}

/** For robots.txt. */
export const placeSitemapUrls = (origin: string) => placeSitemapIds().map(({ id }) => `${origin}/places/sitemap/${id}.xml`);
