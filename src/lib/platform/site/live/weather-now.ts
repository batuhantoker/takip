import type { Translate } from '@/lib/core/i18n/translator';
import type { LightningNow } from '@/lib/feeds/weather/near/lightning-near';
import type { RainNow } from '@/lib/feeds/weather/near/rain-near';
import { compass, skyOf, skyWords, temperatureIn, unitsFor, windSpeedIn } from '../places/copy/weather-words';
import type { StationNow } from '../places/live/metar-now';
import type { CityForecast } from '../places/topics/weather-forecast';

/** /api/weather-now's answer, in words: about "you" on the lightning and rain pages, about a city on its weather page. */

export interface WeatherNowAnswer {
  lightning: LightningNow | null;
  rain: RainNow | null;
  place: { name: string; path: string; cc: string } | null;
  /** With `detail=1`: the city's latest airport report, worded in the asked language, and the forecast for the point. */
  station?: StationNow | null;
  forecast?: CityForecast | null;
}

/** Thunder carries about 10 miles; lightning that close can strike (the US National Weather Service's rule). */
const THUNDER_KM = 16;
/** Closer than the networks' cells can tell apart. */
const OVER_KM = 3;

function distance(km: number, cc: string, t: Translate): string {
  return unitsFor(cc).distance === 'mi' ? t('{n} mi', { n: Math.max(1, Math.round(km / 1.609)) }) : t('{n} km', { n: Math.max(1, km) });
}

/** The 50 km searched, as 30 miles where miles are read: rounded down, so "none within" stays true. */
const radius = (cc: string, t: Translate) => (unitsFor(cc).distance === 'mi' ? t('{n} mi', { n: 30 }) : t('{n} km', { n: 50 }));

/** One sentence about lightning near the visitor; null when the networks couldn't be read. */
export function lightningForYou(now: LightningNow | null, cc: string, t: Translate): string | null {
  if (!now) return null;
  if (!now.covered) return t('Neither lightning network on the map reaches where you are.');
  const hit = now.nearest;
  if (!hit) return t('No lightning within {dist} of you in the last 15 minutes.', { dist: radius(cc, t) });
  if (hit.km <= OVER_KM) return t('Lightning right where you are in the last 15 minutes. If you can hear thunder, you are close enough to be struck: go indoors.');
  const vars = { dist: distance(hit.km, cc, t), dir: compass(hit.bearing, t) };
  return hit.km <= THUNDER_KM
    ? t('Lightning {dist} {dir} of you in the last 15 minutes, close enough to hear thunder and to be struck: go indoors.', vars)
    : t('Lightning {dist} {dir} of you in the last 15 minutes, farther than thunder usually carries (about 16 km, 10 miles).', vars);
}

export function rainForYou(now: RainNow | null, cc: string, t: Translate): string | null {
  if (!now) return null;
  if (!now.covered) return t('No ground radar in RainViewer’s mosaic reaches where you are.');
  const hit = now.nearest;
  if (!hit) return t('No rain or snow on radar within {dist} of you.', { dist: radius(cc, t) });
  if (hit.km <= OVER_KM) return t('Radar shows rain or snow falling where you are.');
  return t('Rain or snow on radar {dist} {dir} of you.', { dist: distance(hit.km, cc, t), dir: compass(hit.bearing, t) });
}

/** The same about a city, for its weather page; null where there is nothing measured to say. */
export function lightningForCity(now: LightningNow | null, city: string, cc: string, t: Translate): string | null {
  if (!now?.covered) return null;
  const hit = now.nearest;
  if (!hit) return t('No lightning within {dist} of {city} in the last 15 minutes.', { dist: radius(cc, t), city });
  if (hit.km <= OVER_KM) return t('Lightning over {city} in the last 15 minutes.', { city });
  const vars = { dist: distance(hit.km, cc, t), dir: compass(hit.bearing, t), city };
  return hit.km <= THUNDER_KM
    ? t('Lightning {dist} {dir} of {city} in the last 15 minutes, close enough for thunder to be heard there.', vars)
    : t('Lightning {dist} {dir} of {city} in the last 15 minutes.', vars);
}

export function rainForCity(now: RainNow | null, city: string, cc: string, t: Translate): string | null {
  if (!now?.covered) return null;
  const hit = now.nearest;
  if (!hit) return t('No rain or snow on radar within {dist} of {city}.', { dist: radius(cc, t), city });
  if (hit.km <= OVER_KM) return t('Radar shows rain or snow over {city}.', { city });
  return t('Rain or snow on radar {dist} {dir} of {city}.', { dist: distance(hit.km, cc, t), dir: compass(hit.bearing, t), city });
}

/** What it is like now: the nearest airport's report, measured, else the forecast's first hour, called a forecast. */
export function conditionsForYou(answer: WeatherNowAnswer, t: Translate): string | null {
  const s = answer.station;
  if (s) return t('{name}, {n, plural, one {# minute ago} other {# minutes ago}}: {report}.', { name: s.name, n: s.minutesAgo, report: s.text });
  const h = answer.forecast?.hours[0];
  if (!h) return null;
  const u = unitsFor(answer.place?.cc ?? '');
  const sky = skyOf(h.symbol);
  const vars = { temp: temperatureIn(h.tempC, u, t), dir: compass(h.windDir, t), speed: windSpeedIn(h.windMs, u, t) };
  return sky
    ? t('Forecast for now: {sky}, {temp}, wind {dir} {speed}.', { ...vars, sky: skyWords(sky.sky, t) })
    : t('Forecast for now: {temp}, wind {dir} {speed}.', vars);
}
