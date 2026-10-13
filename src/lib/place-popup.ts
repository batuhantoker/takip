/* The popup for a labelled place on the base map, with its Wikipedia lead once looked up. */
import { htmlEsc, urlSafe } from './map-popups';
import { normalizeTitle } from './map-wiki';
import type { WikiSummary } from './space/wiki-topic';

export interface PlaceInfo {
  name: string;
  kind: string;
  /** Elevation, airport codes and the like. */
  detail?: string;
}

export type WikiState = { state: 'loading' } | { state: 'found'; summary: WikiSummary } | { state: 'none' };

const ACCENT = '#7FB3D5';
const BOX = `background:rgba(12,14,26,0.95);backdrop-filter:blur(16px);border-radius:10px;padding:14px;font-family:var(--font-hud);border:1px solid ${ACCENT}4D;max-width:320px;`;
const LINK = `color:${ACCENT};text-decoration:none;font-size:10px;`;

const searchUrl = (name: string) => `https://en.wikipedia.org/w/index.php?${new URLSearchParams({ search: name })}`;

function wikiBlock(place: PlaceInfo, wiki: WikiState): string {
  if (wiki.state === 'loading') return `<div style="font-size:10px;color:#5C5A54;">Looking up Wikipedia…</div>`;
  if (wiki.state === 'none') {
    return `<div style="font-size:10px;color:#8A877F;margin-bottom:6px;">No English Wikipedia article found for this place.</div>
      <a href="${urlSafe(searchUrl(place.name))}" target="_blank" rel="noopener noreferrer" style="${LINK}">Search Wikipedia ↗</a>`;
  }
  const s = wiki.summary;
  const img = s.image
    ? `<img src="${urlSafe(s.image.src)}" alt="" style="float:right;width:72px;height:72px;object-fit:cover;border-radius:6px;margin:0 0 6px 10px;" />`
    : '';
  // A nearby article matched on a shared word: say which one, so a wrong match is visible.
  const article = normalizeTitle(s.title) === normalizeTitle(place.name)
    ? ''
    : `<div style="font-size:10px;color:#E8E6E0;font-weight:600;margin-bottom:4px;">Wikipedia: ${htmlEsc(s.title)}</div>`;
  return `${img}${article}
    ${s.description ? `<div style="font-size:10px;color:#A9A69E;margin-bottom:6px;">${htmlEsc(s.description)}</div>` : ''}
    <div style="font-size:11px;line-height:1.45;color:#E8E6E0;">${htmlEsc(s.extract)}</div>
    <div style="clear:both;display:flex;justify-content:space-between;align-items:center;margin-top:10px;">
      <a href="${urlSafe(s.url)}" target="_blank" rel="noopener noreferrer" style="${LINK}font-weight:600;">Open on Wikipedia ↗</a>
      <span style="font-size:8px;color:#5C5A54;">Wikipedia · CC BY-SA</span>
    </div>`;
}

export function placePopupHtml(place: PlaceInfo, wiki: WikiState): string {
  const title = wiki.state === 'found'
    ? `<a href="${urlSafe(wiki.summary.url)}" target="_blank" rel="noopener noreferrer" style="color:${ACCENT};text-decoration:none;">${htmlEsc(place.name)}</a>`
    : htmlEsc(place.name);
  const sub = [place.kind, place.detail].filter(Boolean).map(htmlEsc).join(' · ');
  return `<div style="${BOX}">
    <div style="font-size:14px;font-weight:700;color:${ACCENT};margin-bottom:2px;">${title}</div>
    <div style="font-size:9px;letter-spacing:0.1em;color:#5C5A54;text-transform:uppercase;margin-bottom:10px;">${sub}</div>
    ${wikiBlock(place, wiki)}
  </div>`;
}
