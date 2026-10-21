import { t } from '@/lib/core/i18n/active';
import { htmlEsc, pop, urlSafe } from '@/lib/map/popups/kit';
import { MAP_INK } from '@/lib/map/style/tokens';

/** A channel pin's properties (components/map/layers/live/use-news-layers.ts). */
export interface NewsPin {
  name: string;
  city: string;
  language: string;
  offline: boolean;
  /** The channel on YouTube. */
  watch: string;
}

/** A channel that is not broadcasting: the way to it on YouTube, without a player that would only say "unavailable". */
export function offAirPopupHtml(p: NewsPin): string {
  return pop({
    kicker: t('Live TV'), dot: MAP_INK.rose, title: p.name, subtitle: p.city,
    note: t('Off air now. It plays here again once it is broadcasting.'),
    links: [{ href: p.watch, label: t('Open on YouTube') }],
  });
}

/** Channels under one click, a row each; a live row carries `data-news-feed`, its index in `pins`, for the map to open. */
export function newsroomPopupHtml(pins: NewsPin[]): string {
  const oneCity = pins.every(p => p.city === pins[0].city);
  const rows = pins.map((p, i) => {
    const meta = htmlEsc([oneCity ? '' : p.city, p.offline ? t('Off air') : p.language.toUpperCase()].filter(Boolean).join(' · '));
    const name = `<span class="tk-pop-route-name">${htmlEsc(p.name)}</span><span class="tk-pop-list-meta">${meta}</span>`;
    return p.offline
      ? `<a class="tk-pop-route" href="${urlSafe(p.watch)}" target="_blank" rel="noopener noreferrer">${name}</a>`
      : `<button type="button" class="tk-pop-route" data-news-feed="${i}">${name}</button>`;
  }).join('');
  return pop({
    kicker: t('Live TV'), dot: MAP_INK.rose,
    title: oneCity ? pins[0].city : t('{n, plural, one {# channel} other {# channels}}', { n: pins.length }),
    body: rows,
    // Scrolls rather than running out of a small map.
    wide: true,
  });
}
