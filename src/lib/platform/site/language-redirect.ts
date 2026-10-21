import { DEFAULT_LOCALE } from '@/lib/core/i18n/locales';
import { edgeCountry, pickLocale } from '@/lib/core/i18n/pick-locale';
import { localePath } from './locale-path';

/** Crawlers and link previews read the address they asked for, so each language stays indexed at its own. */
const AUTOMATED = /bot|crawl|spider|slurp|mediapartners|google-|facebookexternalhit|embedly|preview|whatsapp|telegram|discord|slack|pinterest|vkshare|quora|lighthouse|headless|curl|wget|python|okhttp|go-http|java\//i;

/**
 * Where an English (unprefixed) reading page sends a person arriving from outside: the same page in their
 * language, by their pick or else their country and browser (pick-locale.ts), so Spain and Mexico read
 * Spanish while the Netherlands, with no Dutch to offer, stays in English. Null to stay put: a crawler, a
 * prefetch or fetch, a click within the site (the language links must lead where they say), or English.
 */
export function languageRedirect(path: string, search: string, h: Pick<Headers, 'get'>, saved: string | undefined): string | null {
  // Embeds take the language of the page that frames them.
  if (path === '/embed' || path.startsWith('/embed/')) return null;
  const agent = h.get('user-agent');
  if (!agent || AUTOMATED.test(agent)) return null;
  const dest = h.get('sec-fetch-dest');
  if ((dest && dest !== 'document') || h.get('rsc') || h.get('next-router-prefetch') || /prefetch/.test(h.get('sec-purpose') ?? h.get('purpose') ?? '')) return null;
  if (h.get('sec-fetch-site') === 'same-origin' || sameHost(h)) return null;
  const locale = pickLocale({ saved, country: edgeCountry(h), acceptLanguage: h.get('accept-language') });
  return locale === DEFAULT_LOCALE ? null : `${localePath(locale, path)}${search}`;
}

function sameHost(h: Pick<Headers, 'get'>): boolean {
  const referer = h.get('referer');
  const host = h.get('x-forwarded-host') ?? h.get('host');
  if (!referer || !host) return false;
  try {
    return new URL(referer).host === host;
  } catch {
    return false;
  }
}
