import type { Locale } from '@/lib/core/i18n/locales';
import type { LayerPage, SectionId } from './catalog/types';

/**
 * The public pages' long copy in other languages, kept by page rather than in the UI catalogs, where the
 * English sentence is the key and editing one word would lose every translation. Anything missing stays English.
 */
export interface PageCopy {
  title?: string;
  description?: string;
  heading?: string;
  lede?: string;
  shows?: string[];
  /** Each source's detail, in the page's order; source names stay as they are. */
  sources?: string[];
  freshness?: string;
  limits?: string[];
  spots?: { label?: string; note?: string }[];
}

export interface SiteCopy {
  pages: Record<string, PageCopy>;
  sections?: Partial<Record<SectionId, { label: string; blurb: string }>>;
  /** Keyed as ABOUT in about-copy.ts. */
  about?: Record<string, string | string[]>;
  /** Source names that are words rather than names ("Road authorities", "USGS and EMSC"), keyed by the English. */
  sourceNames?: Record<string, string>;
}

// One module per language in ./translations, loaded only when a page in it renders.
const COPY: Record<Exclude<Locale, 'en'>, () => Promise<{ default: SiteCopy }>> = {
  tr: () => import('./translations/tr'),
  es: () => import('./translations/es'),
  pt: () => import('./translations/pt'),
  fr: () => import('./translations/fr'),
  de: () => import('./translations/de'),
  ru: () => import('./translations/ru'),
  ar: () => import('./translations/ar'),
  zh: () => import('./translations/zh'),
  ja: () => import('./translations/ja'),
};

export async function loadSiteCopy(locale: Locale): Promise<SiteCopy> {
  return locale === 'en' ? { pages: {} } : (await COPY[locale]()).default;
}

/** A list is used only if it has as many items as the English, so a bullet added since is never misread as translated. */
const list = (en: string[], other?: string[]) => (other && other.length === en.length ? other : en);

export function localisePage(page: LayerPage, copy: PageCopy | undefined, sourceNames: Record<string, string> = {}): LayerPage {
  if (!copy) return page;
  return {
    ...page,
    title: copy.title ?? page.title,
    description: copy.description ?? page.description,
    heading: copy.heading ?? page.heading,
    lede: copy.lede ?? page.lede,
    shows: list(page.shows, copy.shows),
    sources: page.sources.map((s, i) => ({
      name: sourceNames[s.name] ?? s.name,
      detail: copy.sources?.length === page.sources.length ? copy.sources[i] : s.detail,
    })),
    freshness: copy.freshness ?? page.freshness,
    limits: list(page.limits, copy.limits),
    spots: page.spots?.map((s, i) => ({ ...s, label: copy.spots?.[i]?.label ?? s.label, note: copy.spots?.[i]?.note ?? s.note })),
  };
}
