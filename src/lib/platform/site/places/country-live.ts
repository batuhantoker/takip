import { allPlaces, DERIVED_TTL_MS } from './gazetteer';
import { placePages } from './pages';
import type { Place } from './place';
import type { MapLink } from './topic';
import { CAMERAS, type CamerasData } from './topics/cameras';
import { FLIGHTS } from './topics/flights';
import { kmBetween } from './topics/sky-rules';

/**
 * A country overview's "Live in" block: its biggest cities' indexed live pages, by topic. Cities are looked at most
 * populous first, at most CITIES of them, through the topics' own pages() (table lookups), and kept per country.
 */

export const LIVE_TOPICS = ['cameras', 'weather', 'transit', 'flights'] as const;
export type LiveTopic = (typeof LIVE_TOPICS)[number];

export interface LiveLink { place: Place; slug: string; cameras?: number }
export interface CountryLive { topic: LiveTopic; links: LiveLink[] }

const PER_TOPIC = 6;
const NEIGHBOUR_KM = 25;
const at = (p: Place) => ({ lat: p.at[1], lng: p.at[0] });
const CITIES = 300;

const held = new Map<number, { at: number; rows: CountryLive[] }>();

export function countryLive(country: Place): CountryLive[] {
  const kept = held.get(country.id);
  if (kept && Date.now() - kept.at < DERIVED_TTL_MS) return kept.rows;
  const cities = allPlaces().filter(p => p.kind === 'city' && p.cc === country.cc).sort((a, b) => b.pop - a.pop).slice(0, CITIES);
  const links = new Map<LiveTopic, LiveLink[]>(LIVE_TOPICS.map(id => [id, []]));
  for (const place of cities) {
    for (const ref of placePages(place)) {
      const list = links.get(ref.topic.id as LiveTopic);
      if (!list || !ref.page.index || ref.topic.faith || list.length >= PER_TOPIC) continue;
      // Brooklyn and Queens beside New York City add nothing to a row; it reaches further instead.
      if (list.some(l => kmBetween(at(l.place), at(place)) < NEIGHBOUR_KM)) continue;
      list.push({ place, slug: ref.page.slug, ...(ref.topic.id === 'cameras' ? { cameras: (ref.page.data as CamerasData).onAir } : {}) });
    }
    if ([...links.values()].every(l => l.length >= PER_TOPIC)) break;
  }
  const rows = LIVE_TOPICS.map(topic => ({ topic, links: links.get(topic)! })).filter(r => r.links.length);
  held.set(country.id, { at: Date.now(), rows });
  return rows;
}

/** A country overview's header map, the same for every country: live flights and public cameras, as their own pages open them. */
export const countryMap = (country: Place): MapLink => ({
  layers: [...(FLIGHTS.open(country, undefined as never).layers ?? []), ...(CAMERAS.open(country, undefined as never).layers ?? [])],
});
