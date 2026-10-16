import * as maplibregl from 'maplibre-gl';
import type { RefObject } from 'react';
import type { ArticleSummary } from '@/lib/history/wiki';
import { getWikiLanguage } from '@/lib/core/wikipedia/language';
import { articleOf, type BorderExtras, type WorldBorderFeature, worldBorderPopupHtml } from '@/lib/history/world-borders';

/* A polity's popup: its years at once, then the Wikipedia article Cliopatria names for it. */

const article = (ref: string): Promise<ArticleSummary | null> =>
  fetch(`/api/history/wiki?${new URLSearchParams({ title: ref, lang: getWikiLanguage() })}`)
    .then(res => (res.ok ? (res.json() as Promise<ArticleSummary>) : null))
    .catch(() => null);

export function openWorldBorderPopup(map: maplibregl.Map, popupRef: RefObject<maplibregl.Popup | null>, p: WorldBorderFeature, at: maplibregl.LngLatLike) {
  popupRef.current?.remove();
  const x: BorderExtras = {};
  // setHTML would otherwise refocus the first control on every update.
  const popup = new maplibregl.Popup({ closeButton: true, maxWidth: '340px', offset: 8, focusAfterOpen: false }).setLngLat(at).setHTML(worldBorderPopupHtml(p, x)).addTo(map);
  popupRef.current = popup;
  const render = () => { if (popupRef.current === popup) popup.setHTML(worldBorderPopupHtml(p, x)); };
  popup.getElement().addEventListener('click', e => {
    if (!(e.target as Element | null)?.closest('[data-history-more]')) return;
    x.expanded = !x.expanded;
    render();
  });

  const ref = articleOf(p);
  if (ref) void article(ref).then(w => { x.wiki = w; render(); });
}
