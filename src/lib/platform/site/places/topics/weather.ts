import { msg, type Translate } from '@/lib/core/i18n/translator';
import { DESCRIPTION_RANGE, fit, listOf, nameOf, placeName, TITLE_MAX } from '../copy/format';
import { metarNow, type StationNow } from '../live/metar-now';
import type { Place } from '../place';
import { topicTable } from '../tables';
import type { PlaceTopic, TopicPage } from '../topic';
import type { WeatherMeta, WeatherRow } from './air-weather-data';

/**
 * The weather at /city/<place>/weather: which of TAKIP's weather layers reach the place and which are measured or
 * modelled, with the latest reports from its METAR stations. Every city has a page (the model and the warnings cover
 * everywhere); indexed where something measures the place itself: a METAR station, and radar or lightning.
 */

export interface WeatherData {
  stations: { icao: string; name: string; km: number }[];
  radar: boolean | null;
  lightning: boolean;
  alerts: 'nws' | 'canada' | 'wmo';
}

const MIN_INDEXED_POP = 50_000;

/**
 * NOAA nowCOAST's lightning density covers 25° S to 80° N from 110° E east across the Pacific and the Americas
 * to 0° (lib/feeds/weather/lightning.ts).
 */
export function lightningCovers([lng, lat]: [number, number]): boolean {
  return lat >= -25 && lat <= 80 && (lng >= 110 || lng <= 0);
}

/** Whose severe-weather warnings reach the map there (the severe-weather page's sources). */
export const alertSource = (place: Place): WeatherData['alerts'] => (place.cc === 'US' ? 'nws' : place.cc === 'CA' ? 'canada' : 'wmo');

export const WEATHER: PlaceTopic<WeatherData, StationNow[]> = {
  id: 'weather',
  label: msg('Weather'),
  kinds: ['city'],

  pages(place) {
    const table = topicTable<WeatherRow, WeatherMeta>('weather');
    const row = table.rows[place.id];
    if (!row) return [];
    const data: WeatherData = {
      stations: row.metar.map(([icao, km]) => ({ icao, km, name: table.meta?.stations[icao] ?? icao })),
      radar: row.radar,
      lightning: lightningCovers(place.at),
      alerts: alertSource(place),
    };
    const measured = data.stations.length > 0 && (data.radar === true || data.lightning);
    return [{ slug: 'weather', data, index: measured && place.pop >= MIN_INDEXED_POP }];
  },

  header(place, { data }, t) {
    const name = (t: Translate) => nameOf(place, t);
    const alerts = (t: Translate) => ({
      nws: t('National Weather Service warnings'), canada: t('Environment Canada warnings'), wmo: t('severe-weather warnings'),
    })[data.alerts];
    const layers = (t: Translate, k: number) => listOf([
      ...(data.radar ? [t('rain radar')] : []),
      ...(data.lightning ? [t('lightning')] : []),
      t('temperature and wind'),
      alerts(t),
      ...(data.stations.length ? [t('the latest airport reports from {stations}', { stations: listOf(data.stations.slice(0, k).map(s => s.icao), t) })] : []),
    ], t);
    return {
      title: fit(data.radar ? [
        t => t('{city} weather radar and live conditions map', { city: name(t) }),
        t => t('{city} weather radar map', { city: name(t) }),
      ] : [
        t => t('{city} live weather map: conditions and alerts', { city: name(t) }),
        t => t('{city} live weather map', { city: name(t) }),
      ], t, TITLE_MAX),
      description: fit([
        ...[2, 1].flatMap(k => [
          (t: Translate) => t('{place} weather on one live map: {layers}.', { place: placeName(place, t), layers: layers(t, k) }),
          (t: Translate) => t('{city} weather on one live map: {layers}.', { city: name(t), layers: layers(t, k) }),
        ]),
        t => t('{place} weather on one live map: temperature and wind from NOAA’s forecast model, and severe-weather warnings where they are issued.', { place: placeName(place, t) }),
        t => t('{city} weather on one live map: radar, temperature, wind and warnings, with the latest airport report nearby.', { city: name(t) }),
      ], t, DESCRIPTION_RANGE[1], DESCRIPTION_RANGE[0]),
      heading: t('Weather in {city}, live', { city: name(t) }),
      lede: data.stations.length
        ? data.radar
          ? t('The weather over {city} as it is measured right now, from radar and the airport reports at {stations}, beside the forecast model’s temperature and wind. Each layer says which it is.', { city: name(t), stations: listOf(data.stations.slice(0, 2).map(s => s.name), t) })
          : data.radar === false
            ? t('The weather at {city} as the airport reports at {stations} measure it, beside the forecast model’s temperature and wind. No ground radar in RainViewer’s mosaic reaches it.', { city: name(t), stations: listOf(data.stations.slice(0, 2).map(s => s.name), t) })
            : t('The weather at {city} as the airport reports at {stations} measure it, beside the forecast model’s temperature and wind. Each layer says which it is.', { city: name(t), stations: listOf(data.stations.slice(0, 2).map(s => s.name), t) })
        : data.radar
          ? t('What the rain radar sees over {city} right now, beside the forecast model’s temperature and wind. No airport weather station reports within 30 km of it.', { city: name(t) })
          : data.radar === false
            ? t('The forecast model’s temperature and wind over {city}, and the warnings issued for it. No radar or airport weather station reaches it, so nothing on the map measures it directly.', { city: name(t) })
            : t('The forecast model’s temperature and wind over {city}, and the warnings issued for it. No airport weather station reports within 30 km of it.', { city: name(t) }),
    };
  },

  summary(place, { data }, t) {
    const parts = [
      ...(data.radar ? [t('rain radar')] : []),
      ...(data.lightning ? [t('lightning')] : []),
      ...(data.stations.length ? [t('airport reports from {stations}', { stations: listOf(data.stations.slice(0, 2).map(s => s.icao), t) })] : []),
      t('model temperature and wind'),
    ];
    const s = listOf(parts, t);
    return `${s.charAt(0).toLocaleUpperCase()}${s.slice(1)}.`;
  },

  open: (place, { data }) => ({ layers: ['wx_radar', ...(data.lightning ? ['wx_lightning'] : []), 'weather', 'airport_weather'], zoom: 8 }),

  live: (place, { data }, t) => metarNow(data.stations.slice(0, 3), place.cc, t),
};

export type WeatherPage = TopicPage<WeatherData>;
