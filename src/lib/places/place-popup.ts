/* The popup for a labelled place on the base map, with its Wikipedia lead once looked up. */
import { htmlEsc, pop, urlSafe } from '@/lib/map/popups/kit';
import { normalizeTitle } from './wiki';
import type { WikiSummary } from '@/lib/space/wiki-topic';

export interface PlaceInfo {
  name: string;
  kind: string;
  /** Elevation, airport codes and the like. */
  detail?: string;
}

export type WikiState = { state: 'loading' } | { state: 'found'; summary: WikiSummary } | { state: 'none' };

const searchUrl = (name: string) => `https://en.wikipedia.org/w/index.php?${new URLSearchParams({ search: name })}`;

function wikiBlock(place: PlaceInfo, wiki: WikiState): string {
  if (wiki.state === 'loading') return `<div class="tk-pop-note">Looking up Wikipedia…</div>`;
  if (wiki.state === 'none') return `<div class="tk-pop-note">No English Wikipedia article found for this place.</div>`;
  const s = wiki.summary;
  const img = s.image
    ? `<img src="${urlSafe(s.image.src)}" alt="" style="float:right;width:72px;height:72px;object-fit:cover;border-radius:6px;margin:0 0 6px 10px;" />`
    : '';
  // A nearby article matched on a shared word: say which one, so a wrong match is visible.
  const article = normalizeTitle(s.title) === normalizeTitle(place.name)
    ? ''
    : `<div class="tk-pop-item-title">Wikipedia: ${htmlEsc(s.title)}</div>`;
  return `${img}${article}
    ${s.description ? `<div class="tk-pop-list-meta">${htmlEsc(s.description)}</div>` : ''}
    <div style="margin-top:6px;color:var(--ink-1);">${htmlEsc(s.extract)}</div>
    <div style="clear:both"></div>`;
}

export function placePopupHtml(place: PlaceInfo, wiki: WikiState): string {
  return pop({
    kicker: [place.kind, place.detail].filter(Boolean).join(' · ') || 'Place',
    title: place.name,
    body: wikiBlock(place, wiki),
    links: wiki.state === 'found'
      ? [{ href: wiki.summary.url, label: 'Wikipedia' }]
      : wiki.state === 'none' ? [{ href: searchUrl(place.name), label: 'Search Wikipedia' }] : [],
    note: wiki.state === 'found' ? 'Wikipedia · CC BY-SA' : undefined,
  });
}
