import { Prec } from '@takip/core/time';
import * as maplibregl from 'maplibre-gl';
import type { RefObject } from 'react';
import { articleTitle, type HistoryDetail, type HistoryExtras, type HistoryFeature, historyPopupHtml, shownIds } from '@/lib/history/popup';
import type { ArticleSummary } from '@/lib/history/wiki';

/* A history event's popup: drawn at once from the map feature, then filled in as its detail, related events and article land. */

type PopupRef = RefObject<maplibregl.Popup | null>;

const detail = (id: number): Promise<HistoryDetail | null> =>
  fetch(`/api/replay/history/events/${id}`)
    .then(res => (res.ok ? (res.json() as Promise<HistoryDetail>) : null))
    .catch(() => null);

const summary = (qs: URLSearchParams): Promise<ArticleSummary | null> =>
  fetch(`/api/history/wiki?${qs}`)
    .then(res => (res.ok ? (res.json() as Promise<ArticleSummary>) : null))
    .catch(() => null);

/**
 * The article the importer stored; failing that, only attacks known to the day and placed no coarser than an
 * area are looked up by date and place: a country-placed point would match the capital's events.
 */
function wiki(p: HistoryFeature, d: HistoryDetail | null, at: [number, number]): Promise<ArticleSummary | null> | null {
  const title = articleTitle(d?.attrs);
  if (title) return summary(new URLSearchParams({ title }));
  if (p.kind !== 'attack.terror' || p.prec < Prec.day || p.geoPrec > 3) return null;
  return summary(new URLSearchParams({ date: new Date(p.t0 * 1000).toISOString().slice(0, 10), lat: at[1].toFixed(4), lon: at[0].toFixed(4) }));
}

export function openHistoryPopup(map: maplibregl.Map, popupRef: PopupRef, p: HistoryFeature, at: [number, number], known?: HistoryDetail) {
  popupRef.current?.remove();
  let d: HistoryDetail | null | undefined = known;
  const x: HistoryExtras = {};
  // setHTML refocuses the first control on every update, which would leave the language select looking picked.
  const popup = new maplibregl.Popup({ closeButton: true, maxWidth: '340px', offset: 12, focusAfterOpen: false }).setLngLat(at).setHTML(historyPopupHtml(p, d, x)).addTo(map);
  popupRef.current = popup;
  const render = () => { if (popupRef.current === popup) popup.setHTML(historyPopupHtml(p, d, x)); };

  popup.getElement().addEventListener('change', e => {
    const el = (e.target as Element | null)?.closest<HTMLSelectElement>('select[data-history-lang]');
    if (!el) return;
    void summary(new URLSearchParams({ title: el.value })).then(w => {
      if (!w) return;
      x.wiki = w;
      x.expanded = false;
      render();
    });
  });

  popup.getElement().addEventListener('click', e => {
    const el = (e.target as Element | null)?.closest<HTMLElement>('[data-history-more],[data-history-event]');
    if (!el) return;
    if (el.hasAttribute('data-history-more')) {
      x.expanded = !x.expanded;
      render();
      return;
    }
    void detail(Number(el.dataset.historyEvent)).then(r => {
      if (!r || popupRef.current !== popup) return;
      const there: [number, number] | null = typeof r.lon === 'number' && typeof r.lat === 'number' ? [r.lon, r.lat] : null;
      if (there) map.easeTo({ center: there, duration: 600 });
      openHistoryPopup(map, popupRef, r, there ?? at, r);
    });
  });

  void (known ? Promise.resolve(known) : detail(p.id)).then(r => {
    d = r;
    render();
    void wiki(p, r, at)?.then(w => { x.wiki = w; render(); });
    const ids = r ? shownIds(r) : [];
    if (!ids.length) return;
    void Promise.all(ids.map(detail)).then(rs => {
      const ok = rs.filter((x): x is HistoryDetail => !!x);
      x.related = ok.length ? ok : null;
      render();
    });
  });
}
