import { loadCatalog } from '@/lib/core/i18n/catalog';
import type { Locale } from '@/lib/core/i18n/locales';
import { createTranslator, type Translate } from '@/lib/core/i18n/translator';
import { localisePage, loadSiteCopy, type SiteCopy } from './copy';
import { sectionOf, type LayerPage, type SectionId } from './layer-pages';

/** Everything a public page needs to speak one language: the UI translator and the page copy. */
export interface SiteText { locale: Locale; t: Translate; copy: SiteCopy }

export async function siteText(locale: Locale): Promise<SiteText> {
  const [catalog, copy] = await Promise.all([loadCatalog(locale), loadSiteCopy(locale)]);
  return { locale, t: createTranslator(locale, catalog), copy };
}

export const pageIn = (text: SiteText, page: LayerPage) => localisePage(page, text.copy.pages[page.slug], text.copy.sourceNames);

export function sectionIn(text: SiteText, id: SectionId) {
  const en = sectionOf(id);
  return { ...en, ...text.copy.sections?.[id] };
}
