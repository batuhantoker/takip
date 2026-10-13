import { idSafe } from '@/lib/map/popups/layer-popups';
import { htmlEsc, urlSafe } from '@/lib/map/popups/kit';
import { routeGroup, routeTitle, type RouteSummary } from './api';
import type { RouteDetails } from './details';
import { WMT_API } from './overlay';

export type DetailsState = RouteDetails | 'loading' | 'failed' | undefined;

const MAX_OTHERS = 8;
const MAX_TEXT = 240;

const km = (m: number) => `${m >= 100_000 ? Math.round(m / 1000).toLocaleString('en-US') : (m / 1000).toFixed(1)} km`;
const clip = (s: string) => (s.length > MAX_TEXT ? `${s.slice(0, MAX_TEXT - 1)}…` : s);

const symbol = (id: string | undefined, size: number) => (id
  ? `<img src="${WMT_API}/symbols/id/${idSafe(id)}.svg" alt="" width="${size}" height="${size}" style="flex:none;"/>`
  : `<span style="flex:none;width:${size}px;"></span>`);

const stat = (name: string, value: string) => `<div><dt>${name}</dt><dd class="tk-mono">${value}</dd></div>`;
const button = (attrs: string, body: string) => `<button type="button" ${attrs} class="tk-pop-route">${body}</button>`;
const link = (href: string, text: string) => `<a href="${urlSafe(href)}" target="_blank" rel="noopener noreferrer">${text}</a>`;

type Row = Pick<RouteSummary, 'id' | 'name' | 'ref' | 'itinerary' | 'symbol_id'> & { group?: string };

function routeRow(r: Row): string {
  const g = routeGroup(r.group);
  return button(`data-hiking-route="${r.id}"`,
    `${symbol(r.symbol_id, 16)}<span class="tk-pop-route-name">${htmlEsc(routeTitle(r))}</span><span class="tk-pop-list-meta">${htmlEsc(g.label)}</span>`);
}

/**
 * The popup for a click on the hiking overlay: the selected route, with its
 * details once they arrive, then the other routes under the click. Rows carry
 * `data-hiking-route` and the fit button `data-hiking-fit` for the map to act on.
 */
export function hikingPopupHtml(routes: RouteSummary[], selected: number, details: DetailsState): string {
  const r = routes.find(x => x.id === selected) ?? routes[0];
  const d = typeof details === 'object' ? details : null;
  const g = routeGroup(r.group);
  const title = routeTitle(r);
  const kind = [g.label, r.ref && r.ref !== title ? r.ref : ''].filter(Boolean).map(htmlEsc).join(' · ');
  // A "part of" route arrives without these until its details land.
  const localName = r.local_name ?? d?.local_name;
  const itinerary = r.itinerary?.length ? r.itinerary : d?.itinerary;

  const stats = [
    d?.length ? stat('Mapped', km(d.length)) : '',
    d?.official_length ? stat('Official', km(d.official_length)) : '',
    d?.subroutes ? stat('Stages', String(d.subroutes)) : '',
  ].join('');
  const text = [d?.description && d.description !== title ? d.description : '', d?.note ?? ''].filter(Boolean);
  const partOf = d?.superroutes.length
    ? `<div class="tk-pop-label">Part of</div>${d.superroutes.map(routeRow).join('')}`
    : '';
  const links = [
    link(`https://hiking.waymarkedtrails.org/#route?id=${r.id}&type=relation`, 'Waymarked Trails'),
    link(`https://www.openstreetmap.org/relation/${r.id}`, 'OpenStreetMap'),
    d?.url ? link(d.url, 'Website') : '',
    d?.wikipedia ? link(d.wikipedia, 'Wikipedia') : '',
  ].join('');
  const others = routes.filter(x => x.id !== r.id);
  const more = others.length > MAX_OTHERS ? `<div class="tk-pop-list-meta">+${others.length - MAX_OTHERS} more</div>` : '';

  return `<div class="tk-pop">
    <div class="tk-pop-kicker"><span>${kind}</span></div>
    <div class="tk-pop-hike-head">
      ${symbol(r.symbol_id ?? d?.symbol_id, 24)}
      <div class="tk-pop-title">${htmlEsc(title)}</div>
    </div>
    ${localName && localName !== title ? `<div class="tk-pop-sub">${htmlEsc(localName)}</div>` : ''}
    ${itinerary?.length ? `<div class="tk-pop-body">${itinerary.map(htmlEsc).join(' → ')}</div>` : ''}
    ${stats ? `<dl class="tk-pop-stats">${stats}</dl>` : ''}
    ${d?.operator ? `<dl class="tk-pop-rows"><dt>Operator</dt><dd>${htmlEsc(d.operator)}</dd></dl>` : ''}
    ${text.map(t => `<div class="tk-pop-body">${htmlEsc(clip(t))}</div>`).join('')}
    ${details === 'loading' ? `<div class="tk-pop-note">Loading details…</div>` : ''}
    ${d?.bbox ? `<button type="button" data-hiking-fit class="tk-pop-action">Fit the route on the map</button>` : ''}
    ${partOf}
    ${others.length ? `<div class="tk-pop-label">Also here · ${others.length}</div>${others.slice(0, MAX_OTHERS).map(routeRow).join('')}${more}` : ''}
    <div class="tk-pop-links">${links}</div>
    <div class="tk-pop-note">Waymarked Trails · © OpenStreetMap contributors</div>
  </div>`;
}
