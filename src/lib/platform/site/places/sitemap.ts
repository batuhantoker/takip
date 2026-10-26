import { LOCALES, type Locale } from '@/lib/core/i18n/locales';
import { compareSitemapPaths } from '../compare/sitemap';
import { indexedPages } from './pages';
import { placePath } from './paths';

/**
 * Every indexed page in every language, 50,000 entries a file (the limit), about 6 MB. The alternates are in each
 * page's head, not here: with them an entry is ten times the size.
 */
const PER_CHUNK = 50_000;

// The country comparisons (compare/) are chunked with them.
const paths = () => [...indexedPages().map(({ place, slug }) => placePath(place, slug)), ...compareSitemapPaths()];

/** One spare chunk: the camera pages are counted when the server runs, and may outgrow the build's count. */
export const placeSitemapIds = () => Array.from({ length: Math.ceil((paths().length * LOCALES.length) / PER_CHUNK) + 1 }, (_, id) => ({ id }));

/** A chunk's entries as [English path, the language to list it in]. */
export function placeSitemapChunk(id: number): { path: string; locale: Locale }[] {
  if (!Number.isInteger(id) || id < 0) return [];
  const all = paths();
  const out: { path: string; locale: Locale }[] = [];
  for (let k = id * PER_CHUNK; k < Math.min((id + 1) * PER_CHUNK, all.length * LOCALES.length); k++) {
    out.push({ path: all[Math.floor(k / LOCALES.length)], locale: LOCALES[k % LOCALES.length] });
  }
  return out;
}

/** For robots.txt. */
export const placeSitemapUrls = (origin: string) => placeSitemapIds().map(({ id }) => `${origin}/places/sitemap/${id}.xml`);
