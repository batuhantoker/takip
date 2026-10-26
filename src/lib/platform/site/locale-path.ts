import { DEFAULT_LOCALE, LOCALES, isLocale, type Locale } from '@/lib/core/i18n/locales';

/**
 * The public reading pages have one URL per language, so search engines can index each: English at /map/…,
 * the others under a prefix, /tr/map/…. The map itself keeps one URL in every language.
 */
// /embed, the minimal live map the pages frame, takes the page's language too, though it isn't indexed.
const READING = /^\/(?:map|about|download|city|town|county|state|country|compare|embed|event|spacecraft|planet|ramadan|easter|jewish-holidays)(?:\/|$)/;

export const isReadingPath = (path: string) => READING.test(path);

/** `/tr/map/x` → tr and /map/x; `/map/x` → en. Null for anything that isn't a reading page in some language. */
export function splitLocalePath(pathname: string): { locale: Locale; path: string } | null {
  const m = /^\/([a-z]{2})(\/.*)?$/.exec(pathname);
  if (m && isLocale(m[1]) && m[1] !== DEFAULT_LOCALE) {
    const path = m[2] || '/';
    return isReadingPath(path) ? { locale: m[1], path } : null;
  }
  return isReadingPath(pathname) ? { locale: DEFAULT_LOCALE, path: pathname } : null;
}

/** A reading page's URL in one language; other paths (the map, docs) stay as they are. */
export function localePath(locale: Locale, path: string): string {
  if (locale === DEFAULT_LOCALE || !isReadingPath(path.split('#')[0])) return path;
  return `/${locale}${path}`;
}

/** Every language's URL for a reading page, plus x-default, for hreflang links and the sitemap. */
export function languageAlternates(path: string, origin = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const l of LOCALES) out[l] = `${origin}${localePath(l, path)}`;
  out['x-default'] = `${origin}${path}`;
  return out;
}
