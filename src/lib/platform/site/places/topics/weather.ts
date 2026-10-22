import { msg, type Translate } from '@/lib/core/i18n/translator';
import { LIGHTNING_SOURCES, type LightningSourceId } from '@/lib/feeds/weather/lightning';
import { DESCRIPTION_RANGE, fit, listOf, nameOf, placeFirst, placeName, TITLE_MAX, wordingOf } from '../copy/format';
import { lightningForCity, rainForCity, type WeatherNowAnswer } from '../../live/weather-now';
import { ownApi } from '../../live/own-api';
import { allPlaces, km, reachKm } from '../gazetteer';
import { metarNow, type StationNow } from '../live/metar-now';
import type { Place } from '../place';
import { topicTable } from '../tables';
import type { PlaceTopic, TopicPage } from '../topic';
import type { WeatherMeta, WeatherRow } from './air-weather-data';
import type { IssRow } from './sky-data';
import { cityForecast, type CityForecast } from './weather-forecast';

/**
 * The weather at /city/<place>/weather: MET Norway's forecast, which of TAKIP's weather layers reach the place and
 * which are measured or modelled, with the latest reports from its METAR stations and the lightning and rain around
 * it now. Every city has a page (the model and the warnings cover everywhere); indexed where something measures the
 * place itself: a METAR station, and radar or lightning.
 */

export interface WeatherData {
  stations: { icao: string; name: string; km: number }[];
  radar: boolean | null;
  /** The lightning network that reaches the place. */
  lightning: LightningSourceId | null;
  alerts: 'nws' | 'canada' | 'wmo';
}

/** What is true now: the lightning and rain around the city in a few sentences, or one station's report. */
export type WeatherLive = StationNow | { lines: string[]; near: boolean };

const MIN_INDEXED_POP = 50_000;

const NEAR_KM = 40;

/** The city whose weather page stands for a point: the biggest whose reach takes it in, else the nearest within 40 km. */
export function weatherCityNear(at: [number, number]): Place | null {
  const rows = topicTable<WeatherRow>('weather').rows;
  let reached: Place | null = null;
  let nearest: { place: Place; d: number } | null = null;
  for (const p of allPlaces()) {
    if (p.kind !== 'city' || Math.abs(p.at[1] - at[1]) > 0.5 || !rows[p.id]) continue;
    const d = km(at, p.at);
    if (d <= reachKm(p) && (!reached || p.pop > reached.pop)) reached = p;
    if (d <= NEAR_KM && (!nearest || d < nearest.d)) nearest = { place: p, d };
  }
  return reached ?? nearest?.place ?? null;
}

/** Whose severe-weather warnings reach the map there (the severe-weather page's sources). */
export const alertSource = (place: Place): WeatherData['alerts'] => (place.cc === 'US' ? 'nws' : place.cc === 'CA' ? 'canada' : 'wmo');

/** How far the weather table looks for an airport station (tools/site/topics/air-weather.ts). */
const STATION_KM = 30;

export const WEATHER: PlaceTopic<WeatherData, WeatherLive[], CityForecast> = {
  id: 'weather',
  label: msg('Weather'),
  inline: msg('weather'),
  kinds: ['city'],

  pages(place) {
    const table = topicTable<WeatherRow, WeatherMeta>('weather');
    const row = table.rows[place.id];
    if (!row) return [];
    const data: WeatherData = {
      stations: row.metar.map(([icao, km]) => ({ icao, km, name: table.meta?.stations[icao] ?? icao })),
      radar: row.radar,
      lightning: LIGHTNING_SOURCES.find(s => s.covers(place.at))?.id ?? null,
      alerts: alertSource(place),
    };
    const measured = data.stations.length > 0 && (data.radar === true || !!data.lightning);
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
      title: fit(placeFirst(place, data.radar ? [
        ...(data.lightning ? [(t: Translate, city: string) => t('{city} weather: forecast, radar and lightning', { city })] : []),
        (t, city) => t('{city} weather: forecast, radar and live map', { city }),
        (t, city) => t('{city} weather forecast and radar', { city }),
        (t, city) => t('{city} weather forecast', { city }),
      ] : [
        ...(data.lightning ? [(t: Translate, city: string) => t('{city} weather: forecast and lightning map', { city })] : []),
        (t, city) => t('{city} weather: forecast and live map', { city }),
        (t, city) => t('{city} weather forecast', { city }),
      ]), t, TITLE_MAX),
      description: fit([
        ...(data.lightning ? [data.radar
          ? (t: Translate) => t('{place} weather: a 7-day forecast from MET Norway, with rain radar, lightning, temperature, wind and warnings on one live map.', { place: placeName(place, t) })
          : (t: Translate) => t('{place} weather: a 7-day forecast from MET Norway, with lightning, temperature, wind and severe-weather warnings on one live map.', { place: placeName(place, t) })] : []),
        data.radar
          ? t => t('{place} weather: a 7-day forecast from MET Norway, with rain radar, temperature, wind and warnings on one live map.', { place: placeName(place, t) })
          : t => t('{place} weather: a 7-day forecast from MET Norway, with temperature, wind and severe-weather warnings on one live map.', { place: placeName(place, t) }),
        ...[2, 1].flatMap(k => [
          (t: Translate) => t('{place} weather on one live map: {layers}.', { place: placeName(place, t), layers: layers(t, k) }),
          (t: Translate) => t('{city} weather on one live map: {layers}.', { city: name(t), layers: layers(t, k) }),
        ]),
        t => t('{place} weather on one live map: temperature and wind from NOAA’s forecast model, and severe-weather warnings where they are issued.', { place: placeName(place, t) }),
        t => t('{city} weather on one live map: radar, temperature, wind and warnings, with the latest airport report nearby.', { city: name(t) }),
      ], t, DESCRIPTION_RANGE[1], DESCRIPTION_RANGE[0]),
      heading: t('Weather in {city}: forecast and live map', { city: placeName(place, t) }),
      lede: data.stations.length
        ? data.radar
          ? t(wordingOf(place, 'lede', [msg('The weather over {city} as it is measured right now, from radar and the airport reports at {stations}, beside the forecast model’s temperature and wind. Each layer says which it is.'), msg('Radar and the airport reports at {stations} show the weather over {city} as it is now; the forecast model adds temperature and wind. Each layer says whether it is measured or modelled.')]), { city: name(t), stations: listOf(data.stations.slice(0, 2).map(s => s.name), t) })
          : data.radar === false
            ? t(wordingOf(place, 'lede', [msg('The weather at {city} as the airport reports at {stations} measure it, beside the forecast model’s temperature and wind. No ground radar in RainViewer’s mosaic reaches it.'), msg('The airport reports at {stations} measure the weather at {city}, and the forecast model adds temperature and wind. No ground radar in RainViewer’s mosaic covers it.')]), { city: name(t), stations: listOf(data.stations.slice(0, 2).map(s => s.name), t) })
            : t(wordingOf(place, 'lede', [msg('The weather at {city} as the airport reports at {stations} measure it, beside the forecast model’s temperature and wind. Each layer says which it is.'), msg('The airport reports at {stations} measure the weather at {city}, and the forecast model adds temperature and wind. Each layer says whether it is measured or modelled.')]), { city: name(t), stations: listOf(data.stations.slice(0, 2).map(s => s.name), t) })
        : data.radar
          ? t(wordingOf(place, 'lede', [msg('What the rain radar sees over {city} right now, beside the forecast model’s temperature and wind. No airport weather station reports within {reach, radius} of it.'), msg('The rain radar over {city} as it sees it now, with the forecast model’s temperature and wind. No airport weather station reports within {reach, radius}.')]), { city: name(t), reach: STATION_KM })
          : data.radar === false
            ? t(wordingOf(place, 'lede', [msg('The forecast model’s temperature and wind over {city}, and the warnings issued for it. No radar or airport weather station reaches it, so nothing on the map measures it directly.'), msg('Nothing on the map measures the weather at {city} directly, since no radar or airport station reaches it: here are the forecast model’s temperature and wind, and the warnings issued for it.')]), { city: name(t) })
            : t(wordingOf(place, 'lede', [msg('The forecast model’s temperature and wind over {city}, and the warnings issued for it. No airport weather station reports within {reach, radius} of it.'), msg('Temperature and wind over {city} from the forecast model, with the warnings issued for it. No airport weather station reports within {reach, radius}.')]), { city: name(t), reach: STATION_KM }),
    };
  },

  summary(place, { data }, t) {
    const parts = [
      t('a 7-day forecast'),
      ...(data.radar ? [t('rain radar')] : []),
      ...(data.lightning ? [t('lightning')] : []),
      ...(data.stations.length ? [t('airport reports from {stations}', { stations: listOf(data.stations.slice(0, 2).map(s => s.icao), t) })] : []),
      t('model temperature and wind'),
    ];
    const s = listOf(parts, t);
    return `${s.charAt(0).toLocaleUpperCase()}${s.slice(1)}.`;
  },

  open: (place, { data }) => ({ layers: ['wx_radar', ...(data.lightning ? ['wx_lightning'] : []), 'weather', 'airport_weather', 'wx_temperature', 'wx_wind'], zoom: 8 }),

  async live(place, { data }, t) {
    const [stations, now] = await Promise.all([
      metarNow(data.stations.slice(0, 3), place.cc, t, 'everyday'),
      ownApi<WeatherNowAnswer>(`/api/weather-now?lat=${place.at[1]}&lon=${place.at[0]}`, 120),
    ]);
    const city = nameOf(place, t);
    const lines = [lightningForCity(now?.lightning ?? null, city, place.cc, t), rainForCity(now?.rain ?? null, city, place.cc, t)]
      .filter(l => l !== null);
    if (!lines.length) return stations;
    const near = !!(now?.lightning?.covered && now.lightning.nearest) || !!(now?.rain?.covered && now.rain.nearest);
    // The overview shows only the first: lightning or rain nearby before the airport report, the report before "none".
    return near ? [{ lines, near }, ...stations] : [...stations, { lines, near }];
  },

  async detail(place) {
    const tz = topicTable<IssRow>('iss').rows[place.id]?.tz;
    return tz ? cityForecast(place, tz) : null;
  },
};

export type WeatherPage = TopicPage<WeatherData>;
