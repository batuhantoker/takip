import { htmlEsc, idSafe, urlSafe } from '@/lib/map-popups';
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

const label = (text: string) => `<span style="color:#5C5A54;font-size:8px;letter-spacing:0.1em;">${text}</span>`;
const stat = (name: string, value: string) => `<div>${label(name)}<br/><span style="color:#E8E6E0;font-size:11px;">${value}</span></div>`;
const button = (attrs: string, body: string) =>
  `<button type="button" ${attrs} style="display:flex;align-items:center;gap:8px;width:100%;padding:5px 6px;background:none;border:0;border-radius:4px;color:#B0BEC5;font:inherit;font-size:10px;text-align:left;cursor:pointer;">${body}</button>`;
const linkStyle = 'padding:4px 8px;border:1px solid rgba(255,255,255,0.12);border-radius:4px;color:#B0BEC5;font-size:9px;letter-spacing:0.08em;text-decoration:none;';
const link = (href: string, text: string) => `<a href="${urlSafe(href)}" target="_blank" rel="noopener noreferrer" style="${linkStyle}">${text}</a>`;

type Row = Pick<RouteSummary, 'id' | 'name' | 'ref' | 'itinerary' | 'symbol_id'> & { group?: string };

function routeRow(r: Row): string {
  const g = routeGroup(r.group);
  return button(`data-hiking-route="${r.id}"`,
    `${symbol(r.symbol_id, 16)}<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${htmlEsc(routeTitle(r))}</span>` +
    `<span style="color:${g.color};font-size:8px;letter-spacing:0.08em;">${htmlEsc(g.label.toUpperCase())}</span>`);
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
  const kind = [g.label.toUpperCase(), r.ref && r.ref !== title ? r.ref : ''].filter(Boolean).map(htmlEsc).join(' · ');
  // A "part of" route arrives without these until its details land.
  const localName = r.local_name ?? d?.local_name;
  const itinerary = r.itinerary?.length ? r.itinerary : d?.itinerary;

  const stats = [
    d?.length ? stat('MAPPED', km(d.length)) : '',
    d?.official_length ? stat('OFFICIAL', km(d.official_length)) : '',
    d?.subroutes ? stat('STAGES', String(d.subroutes)) : '',
  ].join('');
  const text = [d?.description && d.description !== title ? d.description : '', d?.note ?? ''].filter(Boolean);
  const partOf = d?.superroutes.length
    ? `<div style="margin-top:8px;">${label('PART OF')}${d.superroutes.map(routeRow).join('')}</div>`
    : '';
  const links = [
    d?.bbox ? `<button type="button" data-hiking-fit style="${linkStyle}background:rgba(255,224,102,0.10);border-color:rgba(255,224,102,0.35);color:#FFE066;cursor:pointer;font-family:inherit;">FIT ROUTE</button>` : '',
    link(`https://hiking.waymarkedtrails.org/#route?id=${r.id}&type=relation`, 'WAYMARKED ↗'),
    link(`https://www.openstreetmap.org/relation/${r.id}`, 'OSM ↗'),
    d?.url ? link(d.url, 'WEBSITE ↗') : '',
    d?.wikipedia ? link(d.wikipedia, 'WIKIPEDIA ↗') : '',
  ].join('');
  const others = routes.filter(x => x.id !== r.id);
  const more = others.length > MAX_OTHERS ? `<div style="padding:2px 6px;">${label(`+${others.length - MAX_OTHERS} MORE`)}</div>` : '';

  return `<div style="background:rgba(12,14,26,0.95);border:1px solid ${g.color}4D;border-radius:10px;padding:14px;font-family:var(--font-hud);min-width:260px;">
    <div style="display:flex;align-items:center;gap:10px;">
      ${symbol(r.symbol_id ?? d?.symbol_id, 26)}
      <div style="min-width:0;">
        <div style="color:${g.color};font-size:13px;font-weight:700;line-height:1.25;">${htmlEsc(title)}</div>
        <div style="color:#5C5A54;font-size:9px;letter-spacing:0.1em;margin-top:2px;">${kind}</div>
      </div>
    </div>
    ${localName && localName !== title ? `<div style="color:#78909C;font-size:10px;margin-top:6px;">${htmlEsc(localName)}</div>` : ''}
    ${itinerary?.length ? `<div style="color:#B0BEC5;font-size:10px;margin-top:6px;">${itinerary.map(htmlEsc).join(' → ')}</div>` : ''}
    ${stats ? `<div style="display:flex;gap:16px;margin-top:10px;">${stats}</div>` : ''}
    ${d?.operator ? `<div style="margin-top:8px;">${label('OPERATOR')}<br/><span style="color:#B0BEC5;font-size:10px;">${htmlEsc(d.operator)}</span></div>` : ''}
    ${text.map(t => `<div style="color:#90A4AE;font-size:10px;line-height:1.4;margin-top:8px;">${htmlEsc(clip(t))}</div>`).join('')}
    ${details === 'loading' ? `<div style="margin-top:8px;">${label('LOADING DETAILS…')}</div>` : ''}
    ${partOf}
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;">${links}</div>
    ${others.length ? `<div style="margin-top:10px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.06);">${label(`ALSO HERE · ${others.length}`)}${others.slice(0, MAX_OTHERS).map(routeRow).join('')}${more}</div>` : ''}
    <div style="margin-top:8px;color:#5C5A54;font-size:8px;">Waymarked Trails · © OpenStreetMap contributors</div>
  </div>`;
}
