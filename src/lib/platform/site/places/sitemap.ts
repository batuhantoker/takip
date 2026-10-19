import { LOCALES, type Locale } from '@/lib/core/i18n/locales';
import { indexedPages } from './pages';
import { placePath } from './paths';

/**
 * Every indexed page in every language, each entry naming its ten alternates. An entry is about 1.5 KB with its
 * alternates, so 5,000 keep a file near 8 MB, far under the 50 MB and 50,000-entry limits.
 */
const PER_CHUNK = 5_000;

const paths = () => indexedPages().map(({ place, slug }) => placePath(place, slug));

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
