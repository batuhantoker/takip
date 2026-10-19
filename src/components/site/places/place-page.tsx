import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { cache } from 'react';
import { SiteFrame } from '@/components/site/pages/site-frame';
import { requestLocale } from '@/lib/core/i18n/request';
import type { Translate } from '@/lib/core/i18n/translator';
import { breadcrumbs, jsonLd } from '@/lib/platform/site/json-ld';
import { localePath } from '@/lib/platform/site/locale-path';
import { readingMetadata } from '@/lib/platform/site/meta';
import { configuredOrigin, publicOrigin } from '@/lib/platform/site/origin';
import { nameOf } from '@/lib/platform/site/places/copy/format';
import { placeBySlug, type PlaceKind } from '@/lib/platform/site/places/gazetteer';
import { overviewCopy } from '@/lib/platform/site/places/overview';
import { findPlacePage, indexedPlacesIn, nearbyWith, overviewIndexed, placePages, type PlacePageRef } from '@/lib/platform/site/places/pages';
import type { Place } from '@/lib/platform/site/places/place';
import { placeCardKey } from '@/lib/platform/site/places/card';
import { placePath } from '@/lib/platform/site/places/paths';
import { shotUrl } from '@/lib/platform/site/shots';
import { siteText } from '@/lib/platform/site/text';
import { PlaceArticle, type PageLive } from './place-article';

/** The topics whose "right now" also shows on a place's overview. */
const OVERVIEW_LIVE = ['transit', 'weather'];

/** The index of each kind of place, and what it is called in the trail. */
export const KIND_INDEX: Record<PlaceKind, string> = { city: '/city', country: '/country' };

/** The place and page a URL names, if it has one. Shared by the metadata and the page within one request. */
const load = cache(async (kind: PlaceKind, slug: string, pageSlug?: string) => {
  const place = placeBySlug(kind, slug);
  if (!place) return null;
  const pages = placePages(place);
  // A country's overview also leads to its places, so it stands even before any country topic does.
  const places = place.kind === 'country' && pageSlug === undefined ? indexedPlacesIn(place.cc) : [];
  if (!pages.length && !places.length) return null;
  const current = pageSlug === undefined ? undefined : findPlacePage(place, pageSlug);
  if (pageSlug !== undefined && !current) return null;
  const text = await siteText((await requestLocale()).locale);
  const copy = current ? current.topic.header(place, current.page, text.t) : overviewCopy(place, pages, text.t, places.length);
  const index = current ? current.page.index : overviewIndexed(pages) || places.length > 0;
  return { place, pages, places, current, text, copy, index };
});

export const placeShotSlug = (kind: PlaceKind, slug: string, page?: string) => `${kind}-${slug}${page ? `-${page}` : ''}`;

export async function placeMetadata(kind: PlaceKind, slug: string, page?: string): Promise<Metadata> {
  const found = await load(kind, slug, page);
  if (!found) return {};
  const { place, current, text, copy, index } = found;
  const meta = readingMetadata({
    locale: text.locale, path: placePath(place, current?.page.slug), title: copy.title, description: copy.description,
    image: `/og?place=${encodeURIComponent(placeCardKey(place.kind, place.slug, current?.page.slug))}&lang=${text.locale}`, type: 'article',
  });
  // Thin pages work for visitors and shared links but stay out of search until their data passes the topic's bar.
  return index ? meta : { ...meta, robots: { index: false, follow: true } };
}

/** What each page's topic says is true right now, stamped with when it was. */
async function livesFor(refs: PlacePageRef[], place: Place, t: Translate, overview: boolean): Promise<PageLive[]> {
  const found = await Promise.all(refs.filter(r => r.topic.live).map(async ref => {
    const answer: unknown = await ref.topic.live!(place, ref.page, t).catch(() => null);
    // The overview gives each topic one line: the first of a list (the nearest station).
    const live = overview && Array.isArray(answer) ? answer.slice(0, 1) : answer;
    if (live == null || (Array.isArray(live) && !live.length)) return null;
    // A live answer may say when it was true (transit does); an array's `at` is its method, not a time.
    const stamp = !Array.isArray(live) && (live as { at?: unknown }).at;
    return { ref, live, at: typeof stamp === 'number' ? stamp : Date.now() };
  }));
  return found.filter(x => !!x);
}

/** Null when the URL names no page, for the route to answer 404. */
export async function PlacePage({ kind, slug, page }: { kind: PlaceKind; slug: string; page?: string }) {
  const found = await load(kind, slug, page);
  if (!found) return null;
  const { place, pages, places, current, text, copy } = found;
  const { t } = text;
  const lives = await livesFor(current ? [current] : pages.filter(p => OVERVIEW_LIVE.includes(p.topic.id)), place, t, !current);
  const origin = configuredOrigin() ?? publicOrigin(await headers());
  const index = localePath(text.locale, KIND_INDEX[place.kind]);
  const overview = localePath(text.locale, placePath(place));
  const kindLabel = place.kind === 'city' ? t('Places') : t('Countries');
  const name = nameOf(place, t);
  return (
    <SiteFrame t={t} path={placePath(place, current?.page.slug)} trail={[{ href: index, label: kindLabel }, ...(current ? [{ href: overview, label: name }] : [])]}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbs(origin, [
        { name: 'TAKIP', path: '/' },
        { name: kindLabel, path: index },
        ...(current ? [{ name, path: overview }] : []),
        { name: copy.heading, path: localePath(text.locale, placePath(place, current?.page.slug)) },
      ])) }} />
      <PlaceArticle text={text} place={place} copy={copy} pages={pages} places={places} current={current} lives={lives}
        image={shotUrl(placeShotSlug(place.kind, place.slug, current?.page.slug))}
        nearby={nearbyWith(place, current?.topic.id)}
        kicker={current ? { href: overview, label: name } : { href: index, label: kindLabel }} />
    </SiteFrame>
  );
}
