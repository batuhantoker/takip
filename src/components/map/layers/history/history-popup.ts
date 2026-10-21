import { Prec } from '@takip/core/time';
import * as maplibregl from 'maplibre-gl';
import type { RefObject } from 'react';
import { articleTitle, HISTORY_FALLBACK_COLOR, HISTORY_FAMILIES, type HistoryDetail, type HistoryExtras, type HistoryFeature, historyPopupHtml, shownIds } from '@/lib/history/popup';
import type { ArticleSummary } from '@/lib/history/wiki';
import { t } from '@/lib/core/i18n/active';
import { getWikiLanguage } from '@/lib/core/wikipedia/language';
import { keepPopupInView } from '@/lib/map/popups/keep-in-view';
import { pinStore } from '@/components/map/pinned/pin-store';
import { isPhoneViewport } from '@/components/ui/use-is-mobile';

/*
 * A history event's popup: drawn at once from the map feature, then filled in as its detail, related events and article land.
 * Pin moves its content into a window, where it carries on.
 */

type PopupRef = RefObject<maplibregl.Popup | null>;

const detail = (id: number): Promise<HistoryDetail | null> =>
  fetch(`/api/replay/history/events/${id}`)
    .then(res => (res.ok ? (res.json() as Promise<HistoryDetail>) : null))
    .catch(() => null);

const summary = (qs: URLSearchParams): Promise<ArticleSummary | null> =>
  fetch(`/api/history/wiki?${qs}&${new URLSearchParams({ lang: getWikiLanguage() })}`)
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
  let pinned = false, live = true;
  // One node for the popup's life, re-rendered in place, so Pin can move it into a window with its listener.
  const node = document.createElement('div');
  const html = () => historyPopupHtml(p, d, x, { pin: !pinned && pinStore.enabled(), windowed: pinned });
  node.innerHTML = html();
  // The Pin button would otherwise take focus as it opens.
  const popup = new maplibregl.Popup({ closeButton: true, maxWidth: '340px', offset: 12, focusAfterOpen: false }).setLngLat(at).setDOMContent(node).addTo(map);
  popupRef.current = popup;
  // On a phone it grows past the screen's room as its detail and picture land.
  const unfit = isPhoneViewport() ? keepPopupInView(map, popup) : undefined;
  popup.on('close', () => {
    unfit?.();
    if (!pinned) live = false;
  });
  const render = () => { if (live) node.innerHTML = html(); };

  const pin = () => {
    pinned = true;
    render();
    const family = HISTORY_FAMILIES[p.family];
    pinStore.pin({
      id: `history:${p.id}`,
      label: p.title ?? (family ? t(family.label) : t('Event')),
      kicker: family ? t(family.label) : t('Event'),
      dot: family?.color ?? HISTORY_FALLBACK_COLOR,
      at,
      node,
      release: () => { live = false; },
    });
    if (popupRef.current === popup) popupRef.current = null;
    popup.remove();
  };

  node.addEventListener('click', e => {
    const el = (e.target as Element | null)?.closest<HTMLElement>('[data-history-more],[data-history-event],[data-pop-pin]');
    if (!el) return;
    if (el.hasAttribute('data-pop-pin')) {
      pin();
      return;
    }
    if (el.hasAttribute('data-history-more')) {
      x.expanded = !x.expanded;
      render();
      return;
    }
    void detail(Number(el.dataset.historyEvent)).then(r => {
      if (!r || !live) return;
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
