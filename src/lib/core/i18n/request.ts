import { cookies, headers } from 'next/headers';
import { loadCatalog } from './catalog';
import { LOCALE_COOKIE, isLocale, type Locale } from './locales';
import { edgeCountry, pickLocale } from './pick-locale';
import { createTranslator, type Translate } from './translator';

export type RequestLocale = {
  locale: Locale;
  /** The visitor's explicit pick, if they made one. */
  chosen: Locale | null;
  /** What their country and browser give without a pick. */
  automatic: Locale;
};

/** The language for this request. Reading cookies and headers makes the page dynamic. */
export async function requestLocale(): Promise<RequestLocale> {
  const [jar, h] = await Promise.all([cookies(), headers()]);
  const saved = jar.get(LOCALE_COOKIE)?.value;
  const automatic = pickLocale({ country: edgeCountry(h), acceptLanguage: h.get('accept-language') });
  const chosen = isLocale(saved) ? saved : null;
  return { locale: chosen ?? automatic, chosen, automatic };
}

/** A translator for server components and generateMetadata. */
export async function getT(): Promise<Translate> {
  const { locale } = await requestLocale();
  return createTranslator(locale, await loadCatalog(locale));
}
