import type { Locale } from './locales';
import type { Catalog } from './translator';

// One file per language, keyed by the English source; `npm run i18n -- check` lists what each is missing.
const CATALOGS: Record<Exclude<Locale, 'en'>, () => Promise<{ default: Catalog }>> = {
  tr: () => import('./catalogs/tr.json'),
  es: () => import('./catalogs/es.json'),
  pt: () => import('./catalogs/pt.json'),
  fr: () => import('./catalogs/fr.json'),
  de: () => import('./catalogs/de.json'),
  ru: () => import('./catalogs/ru.json'),
  ar: () => import('./catalogs/ar.json'),
  zh: () => import('./catalogs/zh.json'),
  ja: () => import('./catalogs/ja.json'),
};

export async function loadCatalog(locale: Locale): Promise<Catalog> {
  return locale === 'en' ? {} : (await CATALOGS[locale]()).default;
}
