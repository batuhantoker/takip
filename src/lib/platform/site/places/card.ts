import type { Translate } from '@/lib/core/i18n/translator';
import { compareCard } from '../compare/card';
import { placeName } from './copy/format';
import { placeBySlug, type PlaceKind } from './gazetteer';
import { overviewCopy } from './overview';
import { findPlacePage, placePages } from './pages';
import { KIND_LABEL } from './paths';

const KINDS: readonly PlaceKind[] = ['city', 'town', 'county', 'state', 'country'];

/**
 * A place page's share card, for /og: `?place=city/cincinnati/transit`. Null for anything that isn't a page, so a
 * query can't put arbitrary words on a card.
 */
export function placeCard(key: string, t: Translate): { kicker: string; title: string; subtitle: string; points: { lat: number; lon: number }[]; picture: string } | null {
  const [kind, slug, page, ...rest] = key.split('/');
  if (kind === 'compare' || kind === 'world') return compareCard(key, t);
  if (rest.length || !KINDS.includes(kind as PlaceKind) || !slug) return null;
  const place = placeBySlug(kind as PlaceKind, slug);
  if (!place) return null;
  const pages = placePages(place);
  const ref = page ? findPlacePage(place, page) : undefined;
  if (page ? !ref : !pages.length) return null;
  const copy = ref ? ref.topic.header(place, ref.page, t) : overviewCopy(place, pages, t);
  return {
    kicker: ref ? placeName(place, t) : t(KIND_LABEL[place.kind]),
    title: copy.heading,
    subtitle: copy.lede.split(/(?<=[.!?])\s+|(?<=[。！？])/)[0],
    points: [{ lat: place.at[1], lon: place.at[0] }],
    picture: `${kind}-${slug}${page ? `-${page}` : ''}`,
  };
}

export const placeCardKey = (kind: PlaceKind, slug: string, page?: string) => `${kind}/${slug}${page ? `/${page}` : ''}`;
