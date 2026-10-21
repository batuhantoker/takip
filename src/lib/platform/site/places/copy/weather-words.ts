import type { Translate } from '@/lib/core/i18n/translator';
import { listOf } from './intl';

/** The units a place's readers expect: the US is imperial throughout, the UK keeps miles an hour. */
export interface WeatherUnits { temp: 'c' | 'f'; wind: 'kmh' | 'mph'; rain: 'mm' | 'in'; distance: 'km' | 'mi' }

export function unitsFor(cc: string): WeatherUnits {
  if (cc === 'US') return { temp: 'f', wind: 'mph', rain: 'in', distance: 'mi' };
  return { temp: 'c', wind: cc === 'GB' ? 'mph' : 'kmh', rain: 'mm', distance: 'km' };
}

const KT_MS = 0.514444;

export const temperatureIn = (c: number, u: WeatherUnits, t: Translate) =>
  u.temp === 'f' ? t('{f} °F', { f: Math.round((c * 9) / 5 + 32) }) : t('{c} °C', { c: Math.round(c) });

export const windSpeedIn = (ms: number, u: WeatherUnits, t: Translate) =>
  u.wind === 'mph' ? t('{n} mph', { n: Math.round(ms * 2.23694) }) : t('{n} km/h', { n: Math.round(ms * 3.6) });

export const knotsToMs = (kt: number) => kt * KT_MS;

export function precipitationIn(mm: number, u: WeatherUnits, t: Translate) {
  if (u.rain === 'in') return t('{n} in', { n: new Intl.NumberFormat(t.intl, { maximumFractionDigits: 2 }).format(mm / 25.4) });
  return t('{n} mm', { n: new Intl.NumberFormat(t.intl, { maximumFractionDigits: 1 }).format(mm) });
}

const POINTS = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'] as const;

/** The eight-point compass direction the wind blows from: "SW". */
export const compass = (deg: number, t: Translate) =>
  t('{dir, select, n {N} ne {NE} e {E} se {SE} s {S} sw {SW} w {W} other {NW}}', { dir: POINTS[Math.round((((deg % 360) + 360) % 360) / 45) % 8] });

/** Relative humidity from temperature and dew point (Magnus, Alduchov and Eskridge's constants). */
export function humidity(tempC: number, dewC: number): number {
  const e = (x: number) => Math.exp((17.625 * x) / (243.04 + x));
  return Math.max(0, Math.min(100, Math.round((100 * e(dewC)) / e(tempC))));
}

const PHENOMENA: Record<string, string> = {
  DZ: 'drizzle', RA: 'rain', SN: 'snow', SG: 'snow', PL: 'ice', GR: 'hail', GS: 'hail', IC: 'ice', UP: 'precipitation',
  BR: 'mist', FG: 'fog', HZ: 'haze', FU: 'smoke', VA: 'ash', DU: 'dust', SA: 'sand', PY: 'spray', SQ: 'squalls', DS: 'dust', SS: 'sand', PO: 'dust',
};

const word = (code: string, t: Translate) =>
  t('{w, select, drizzle {drizzle} rain {rain} snow {snow} hail {hail} ice {ice pellets} mist {mist} fog {fog} haze {haze} smoke {smoke} ash {volcanic ash} dust {dust} sand {sand} spray {spray} squalls {squalls} other {precipitation}}', { w: PHENOMENA[code] ?? 'other' });

/** One METAR weather group in words: "-SHRA" is "light rain showers", "TSRA" "thunderstorm with rain". */
export function weatherGroup(group: string, t: Translate): string | null {
  const m = /^(VC|[-+])?(MI|PR|BC|DR|BL|SH|TS|FZ)?((?:DZ|RA|SN|SG|PL|GR|GS|IC|UP|BR|FG|HZ|FU|VA|DU|SA|PY|SQ|PO|DS|SS)*)$/.exec(group);
  if (!m || (!m[2] && !m[3])) return null;
  const codes = m[3].match(/../g) ?? [];
  const what = codes.length ? listOf(codes.map(c => word(c, t)), t) : null;
  let s: string;
  if (m[2] === 'TS') s = what ? t('thunderstorm with {w}', { w: what }) : t('thunderstorm');
  else if (!what) return null;
  else if (m[2] === 'SH') s = t('{w} showers', { w: what });
  // Freezing fog is common and a phrase of its own: "freezing {w}" can't agree with fog's gender everywhere.
  else if (m[2] === 'FZ') s = m[3] === 'FG' ? t('freezing fog') : t('freezing {w}', { w: what });
  else s = what;
  if (m[1] === '-') return t('light {w}', { w: s });
  if (m[1] === '+') return t('heavy {w}', { w: s });
  if (m[1] === 'VC') return t('{w} nearby', { w: s });
  return s;
}

export const weatherWords = (wx: string, t: Translate) =>
  wx.split(/\s+/).map(g => weatherGroup(g, t)).filter((s): s is string => !!s);

export type Sky = 'clear' | 'fair' | 'partly' | 'cloudy' | 'fog' | 'lightrain' | 'rain' | 'heavyrain' | 'sleet' | 'lightsnow' | 'snow' | 'heavysnow' | 'thunder';

/** MET Norway's symbol code ("lightrainshowers_day") as one of a dozen kinds of sky; showers count as their rain or snow. */
export function skyOf(symbol: string | null): { sky: Sky; night: boolean } | null {
  if (!symbol) return null;
  const night = symbol.endsWith('_night') || symbol.endsWith('_polartwilight');
  const base = symbol.replace(/_(day|night|polartwilight)$/, '');
  const strength = (light: Sky, plain: Sky, heavy: Sky) => (base.startsWith('light') ? light : base.startsWith('heavy') ? heavy : plain);
  const sky: Sky | null = base.includes('thunder') ? 'thunder'
    : base.includes('snow') ? strength('lightsnow', 'snow', 'heavysnow')
      : base.includes('sleet') ? 'sleet'
        : base.includes('rain') ? strength('lightrain', 'rain', 'heavyrain')
          : base === 'fog' ? 'fog' : base === 'cloudy' ? 'cloudy' : base === 'partlycloudy' ? 'partly' : base === 'fair' ? 'fair' : base === 'clearsky' ? 'clear' : null;
  return sky ? { sky, night } : null;
}

export const skyWords = (sky: Sky, t: Translate) =>
  t('{sky, select, clear {Clear} fair {Mostly clear} partly {Partly cloudy} cloudy {Cloudy} fog {Fog} lightrain {Light rain} rain {Rain} heavyrain {Heavy rain} sleet {Sleet} lightsnow {Light snow} snow {Snow} heavysnow {Heavy snow} other {Thunderstorms}}', { sky });
