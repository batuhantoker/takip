import { DEFAULT_LOCALE, type Locale } from '@/lib/core/i18n/locales';
import type { PlaceKind } from './places/place';

/*
 * What TAKIP puts forward for search. On 2026-10-29 Google demoted the whole site at once (no manual action) after it
 * had found ~1M templated pages in ten machine-translated languages. Search now gets pages with data of their own, in
 * English unless hand-written; the rest still render for visitors, with noindex, outside the sitemaps.
 * Widen a topic or family only once it shows it earns clicks. docs/architecture/public-pages.md, "Search scope".
 */

/** Place topics whose pages can be put forward; each page still has to pass its topic's own bar (TopicPage.index). */
export const SEARCH_TOPICS: ReadonlySet<string> = new Set(['cameras', 'transit', 'hazards']);

/** Place kinds whose overview can be put forward: a city's needs a searched page of its own (places/pages.ts). */
export const SEARCH_OVERVIEWS: ReadonlySet<PlaceKind> = new Set(['country', 'city']);

// Counties, states and towns had plate-reader pages only, now out, so their index pages would list nothing searched.
const OUT = /^\/(?:compare|event|mountains?|county|state|town)(?:\/|$)/;
const EVERY_LANGUAGE = /^\/map(?:\/|$)/;

/** Whether a reading page's family, in this language, can be put forward at all. `path` is the English path. */
export const searchScope = (path: string, locale: Locale = DEFAULT_LOCALE) =>
  !OUT.test(path) && (locale === DEFAULT_LOCALE || EVERY_LANGUAGE.test(path));

/** Whether a page's other languages are searched too, so its head and the sitemap name them as alternates. */
export const searchedInEveryLanguage = (path: string) => EVERY_LANGUAGE.test(path);
