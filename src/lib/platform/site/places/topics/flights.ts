import { msg, type Translate } from '@/lib/core/i18n/translator';
import { DESCRIPTION_RANGE, fit, listOf, nameOf, placeName, TITLE_MAX } from '../copy/format';
import { metarNow, type StationNow } from '../live/metar-now';
import { topicTable } from '../tables';
import type { PlaceTopic, TopicPage } from '../topic';
import type { FlightsRow, WeatherMeta } from './air-weather-data';

/**
 * Aircraft at /city/<place>/flights: the airports with scheduled flights within 50 km, the latest weather each
 * reports, and FAA delays where they apply. Indexed for places of 100,000 people or more; around smaller ones
 * the page would repeat its neighbour's.
 */

export interface FlightsData { airports: { iata: string; icao: string; name: string; km: number }[] }

const MIN_INDEXED_POP = 100_000;

export const FLIGHTS: PlaceTopic<FlightsData, StationNow[]> = {
  id: 'flights',
  label: msg('Flights'),
  kinds: ['city'],

  pages(place) {
    const table = topicTable<FlightsRow, WeatherMeta>('flights');
    const row = table.rows[place.id];
    if (!row?.airports.length) return [];
    const airports = row.airports.map(a => ({ ...a, name: table.meta?.stations[a.icao] ?? a.iata }));
    return [{ slug: 'flights', data: { airports }, index: place.pop >= MIN_INDEXED_POP }];
  },

  header(place, { data }, t) {
    const name = (t: Translate) => nameOf(place, t);
    const codes = (k: number) => data.airports.slice(0, k).map(a => a.iata);
    return {
      title: fit([
        ...[2, 1].map(k => (t: Translate) => t('Flights over {city}: live planes around {airports}', { city: name(t), airports: listOf(codes(k), t) })),
        t => t('Flights over {city}: live flight tracker', { city: name(t) }),
        t => t('Flights over {city}', { city: name(t) }),
      ], t, TITLE_MAX),
      description: fit([
        ...[2, 1].map(k => (t: Translate) => t('Aircraft over {place} on a live map, from ADS-B receivers: flights in and out of {airports}, with each plane’s altitude, speed and route where known.', { place: placeName(place, t), airports: listOf(codes(k), t) })),
        t => t('Aircraft over {city} on a live map, from ADS-B receivers: flights in and out of {airport}, with each plane’s altitude and speed.', { city: name(t), airport: codes(1)[0] }),
      ], t, DESCRIPTION_RANGE[1], DESCRIPTION_RANGE[0]),
      heading: t('Flights over {city}, live', { city: name(t) }),
      lede: t('Every aircraft around {city} that broadcasts its position and is heard by a receiver, moving on the map: arrivals and departures at {airports}, and the traffic passing overhead.', {
        city: name(t), airports: listOf(data.airports.map(a => a.name), t),
      }),
    };
  },

  summary(place, { data }, t) {
    return listOf(data.airports.map(a => `${a.name} (${a.iata})`), t);
  },

  open: place => ({ layers: ['flights', 'private', 'jets', 'military', 'airport_weather', ...(place.cc === 'US' ? ['airport_delays'] : [])], zoom: 8.5 }),

  live: (place, { data }, t) => metarNow(data.airports.map(a => ({ icao: a.icao, name: a.name, km: a.km })), place.cc, t),
};

export type FlightsPage = TopicPage<FlightsData>;
