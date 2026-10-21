import type { Translate } from '@/lib/core/i18n/translator';

// Slow to build, and a sitemap or index page names thousands of places: one per language and kind.
const formatters = new Map<string, unknown>();
export function formatter<T>(key: string, make: () => T): T {
  let f = formatters.get(key) as T | undefined;
  if (f === undefined) formatters.set(key, (f = make()));
  return f;
}

/** "a, b and c": English without the serial comma, like the rest of the site. */
export const listOf = (items: string[], t: Translate) => {
  const tag = t.locale === 'en' ? 'en-GB' : t.intl;
  return formatter(`list:${tag}`, () => new Intl.ListFormat(tag, { type: 'conjunction' })).format(items);
};
