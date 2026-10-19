/* The popup for a labelled place on the base map, with its Wikipedia lead once looked up. */
import { activeIntl, t } from '@/lib/core/i18n/active';
import { htmlEsc, pop, urlSafe } from '@/lib/map/popups/kit';
import { languageName } from '@/lib/core/wikipedia/language';
import { normalizeTitle } from './wiki';
import type { WikiSummary } from '@/lib/core/wikipedia/summary';

export interface PlaceInfo {
  name: string;
  kind: string;
  /** Elevation, airport codes and the like. */
  detail?: string;
}

/** The article /api/map/wiki found: in the reader's Wikipedia when it has one (`lang`), else English; `matched` is the English title the name matched. */
export type PlaceArticle = WikiSummary & { lang: string; matched: string };

export type WikiState = { state: 'loading' } | { state: 'found'; summary: PlaceArticle } | { state: 'none' };

const searchUrl = (name: string, lang: string) => `https://${lang}.wikipedia.org/w/index.php?${new URLSearchParams({ search: name })}`;

function wikiBlock(place: PlaceInfo, wiki: WikiState, lang: string): string {
  if (wiki.state === 'loading') return `<div class="tk-pop-note">${htmlEsc(t('Looking up Wikipedia…'))}</div>`;
  if (wiki.state === 'none') return `<div class="tk-pop-note">${htmlEsc(t('No Wikipedia article found for this place.'))}</div>`;
  const s = wiki.summary;
  const img = s.image
    ? `<img src="${urlSafe(s.image.src)}" alt="" style="float:right;width:72px;height:72px;object-fit:cover;border-radius:6px;margin:0 0 6px 10px;" />`
    : '';
  // A nearby article matched on a shared word: say which one, so a wrong match is visible.
  const article = normalizeTitle(s.matched) === normalizeTitle(place.name)
    ? ''
    : `<div class="tk-pop-item-title">${htmlEsc(t('Wikipedia: {title}', { title: s.title }))}</div>`;
  const fallback = s.lang === lang
    ? ''
    : `<div class="tk-pop-note">${htmlEsc(t('No article in {language}, so this is the English one.', { language: languageName(lang, activeIntl()) }))}</div>`;
  return `${fallback}${img}${article}
    ${s.description ? `<div class="tk-pop-list-meta">${htmlEsc(s.description)}</div>` : ''}
    <div style="margin-top:6px;color:var(--ink-1);">${htmlEsc(s.extract)}</div>
    <div style="clear:both"></div>`;
}

/** `lang` is the reader's Wikipedia (getWikiLanguage). */
export function placePopupHtml(place: PlaceInfo, wiki: WikiState, lang: string): string {
  return pop({
    kicker: [place.kind, place.detail].filter(Boolean).join(' · ') || t('Place'),
    title: place.name,
    body: wikiBlock(place, wiki, lang),
    links: wiki.state === 'found'
      ? [{ href: wiki.summary.url, label: 'Wikipedia' }]
      : wiki.state === 'none' ? [{ href: searchUrl(place.name, lang), label: t('Search Wikipedia') }] : [],
    note: wiki.state === 'found' ? 'Wikipedia · CC BY-SA' : undefined,
  });
}
