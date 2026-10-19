import { msg, type Translate } from '@/lib/core/i18n/translator';
import { count, DESCRIPTION_RANGE, fit, nameOf, placeName, TITLE_MAX } from '../copy/format';
import { topicTable } from '../tables';
import type { PlaceTopic, TopicPage } from '../topic';
import type { HikingMeta, HikingRow } from './hiking-data';
import { hikingStory, renderHikingSentence, routeName, type HikingStory } from './hiking-facts';

/**
 * Waymarked hiking routes at /city/<place>/hiking: how many run within the place's radius and at what level, which
 * long-distance trails and networks pass through, the routes with most of their length there, and who keeps them.
 * From Waymarked Trails' reading of OpenStreetMap; indexed by HIKING_INDEX (hiking-facts.ts).
 */

export interface HikingData { story: HikingStory; counted: string }

export const HIKING: PlaceTopic<HikingData> = {
  id: 'hiking',
  label: msg('Hiking routes'),
  inline: msg('hiking routes'),
  kinds: ['city'],

  pages(place) {
    const table = topicTable<HikingRow, HikingMeta>('hiking');
    const row = table.rows[place.id];
    if (!row || !table.meta) return [];
    const story = hikingStory(row, table.meta.routes);
    return [{ slug: 'hiking', data: { story, counted: table.generated }, index: story.index }];
  },

  header(place, { data: { story } }, t) {
    const f = story.facts;
    const n = (t: Translate) => (f.capped ? t('at least {n}', { n: count(f.total, t) }) : count(f.total, t));
    const v = (t: Translate) => ({ city: nameOf(place, t), place: placeName(place, t), n: n(t), r: f.r });
    const lead = f.routes.find(r => r.name);
    return {
      title: fit([
        t => t('{city} hiking routes: {n} waymarked trails nearby', v(t)),
        t => t('{city} hiking routes: {n} waymarked trails', v(t)),
        t => t('{city} hiking routes', v(t)),
      ], t, TITLE_MAX),
      description: fit([
        ...(lead ? [
          (t: Translate) => t('Hiking routes around {place}: {n} waymarked trails within {r} km, among them {route}, on a free map with each route’s length and network.', { ...v(t), route: routeName(lead, lead.id) }),
          (t: Translate) => t('Hiking routes around {city}: {n} waymarked trails within {r} km, among them {route}, with each route’s length and network.', { ...v(t), route: routeName(lead, lead.id) }),
        ] : []),
        t => t('Hiking routes around {place}: {n} waymarked trails within {r} km on a free map from OpenStreetMap, with each route’s length, network and operator.', v(t)),
        t => t('Hiking routes around {city}: {n} waymarked trails within {r} km on a free map from OpenStreetMap, with each route’s length and network.', v(t)),
        t => t('Hiking routes around {city}: {n} waymarked trails within {r} km on a free map, with each route’s length and network.', v(t)),
      ], t, DESCRIPTION_RANGE[1], DESCRIPTION_RANGE[0]),
      heading: t('Hiking routes around {city}', v(t)),
      lede: renderHikingSentence(story.sentences[0], nameOf(place, t), t),
    };
  },

  summary(_place, { data: { story: { facts: f } } }, t) {
    const lead = f.routes.find(r => r.name);
    if (f.capped) return t('At least {n} waymarked routes within {r} km.', { n: count(f.total, t), r: f.r });
    return lead
      ? t('{n, plural, one {One waymarked route} other {# waymarked routes}} within {r} km, among them {route}.', { n: f.total, r: f.r, route: routeName(lead, lead.id) })
      : t('{n, plural, one {One waymarked route} other {# waymarked routes}} within {r} km.', { n: f.total, r: f.r });
  },

  // Local routes draw from zoom 10.
  open: (_place, { data: { story } }) => ({ layers: ['hiking_routes'], zoom: story.facts.r >= 25 ? 10 : 11 }),
};

export type HikingPage = TopicPage<HikingData>;
