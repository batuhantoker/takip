import type { Translate } from '@/lib/core/i18n/translator';
import type { AirportWx } from '@/lib/feeds/aviation-weather/metar';
import { ownApi } from '../../live/own-api';
import { compass, humidity, knotsToMs, temperatureIn, unitsFor, weatherWords, windSpeedIn } from '../copy/weather-words';

/** One station's latest report, in words. */
export interface StationNow { icao: string; name: string; km: number; text: string; cat: AirportWx['cat']; minutesAgo: number }

// Every station in the world is a few MB, over Next's 2 MB fetch-cache limit, so it is kept here instead.
const TTL_MS = 5 * 60_000;
let held: { at: number; rows: Promise<AirportWx[] | null> } | null = null;

function allStations(): Promise<AirportWx[] | null> {
  if (!held || Date.now() - held.at > TTL_MS) {
    const rows = ownApi<{ airports?: AirportWx[] }>('/api/aviation-weather?kind=airports', 0).then(j => j?.airports ?? null);
    held = { at: Date.now(), rows };
    rows.then(r => { if (!r && held?.rows === rows) held = null; });
  }
  return held.rows;
}

const MAX_AGE_MIN = 180;

const fahrenheit = (c: number) => Math.round((c * 9) / 5 + 32);

function temperature(c: number, cc: string, t: Translate) {
  return cc === 'US' ? t('{c} °C ({f} °F)', { c: Math.round(c), f: fahrenheit(c) }) : t('{c} °C', { c: Math.round(c) });
}

function wind(w: AirportWx, t: Translate) {
  if (w.windKt == null) return null;
  if (w.windKt === 0) return t('calm');
  const gust = w.gustKt ? t(', gusting {g} kt', { g: w.gustKt }) : '';
  // North is 360 in a METAR; a direction of 0 with wind blowing means it varied.
  return w.windDir == null || w.windDir === 0
    ? t('variable at {kt} kt{gust}', { kt: w.windKt, gust })
    : t('from {dir}° at {kt} kt{gust}', { dir: String(w.windDir).padStart(3, '0'), kt: w.windKt, gust });
}

/** "14 °C, wind from 230° at 9 kt, visibility 10+ miles": what the report says, as written. */
export function describeReport(w: AirportWx, cc: string, t: Translate): string {
  const parts: string[] = [];
  if (w.tempC != null) parts.push(temperature(w.tempC, cc, t));
  const wd = wind(w, t);
  if (wd) parts.push(t('wind {wind}', { wind: wd }));
  if (w.visSm) parts.push(t('visibility {vis} miles', { vis: w.visSm }));
  if (w.ceilingFt != null) parts.push(t('cloud base {ft} ft', { ft: new Intl.NumberFormat(t.intl).format(w.ceilingFt) }));
  if (w.wx) parts.push(w.wx);
  return parts.join(', ');
}

/** "14 °C, humidity 72%, wind SW 17 km/h, gusts 30 km/h, light rain": the same report in the units the place uses. */
export function describeEveryday(w: AirportWx, cc: string, t: Translate): string {
  const u = unitsFor(cc);
  const parts: string[] = [];
  if (w.tempC != null) parts.push(temperatureIn(w.tempC, u, t));
  if (w.tempC != null && w.dewC != null) parts.push(t('humidity {n}%', { n: humidity(w.tempC, w.dewC) }));
  if (w.windKt === 0) parts.push(t('calm'));
  else if (w.windKt != null) {
    const speed = windSpeedIn(knotsToMs(w.windKt), u, t);
    parts.push(w.windDir ? t('wind {dir} {speed}', { dir: compass(w.windDir, t), speed }) : t('wind variable, {speed}', { speed }));
    if (w.gustKt) parts.push(t('gusts {speed}', { speed: windSpeedIn(knotsToMs(w.gustKt), u, t) }));
  }
  const miles = w.visSm ? Number.parseFloat(w.visSm) : NaN;
  if (Number.isFinite(miles)) {
    const more = w.visSm!.endsWith('+') ? '+' : '';
    // Visibility stays metric in the UK, as its forecasts give it, though its roads are in miles.
    parts.push(cc === 'US'
      ? t('visibility {vis} miles', { vis: w.visSm! })
      // "6+" is how NOAA writes a metric report's 9999, ten kilometres or more.
      : t('visibility {km} km', { km: w.visSm === '6+' ? '10+' : `${new Intl.NumberFormat(t.intl, { maximumFractionDigits: miles < 0.6 ? 1 : 0 }).format(miles * 1.609)}${more}` }));
  }
  if (w.wx) parts.push(...weatherWords(w.wx, t));
  return parts.join(', ');
}

export type ReportStyle = 'aviation' | 'everyday';

/** These stations' reports from the last three hours, in the order given. */
export function stationsNow(rows: AirportWx[], stations: { icao: string; name: string; km: number }[], cc: string, now: number, t: Translate, style: ReportStyle = 'aviation'): StationNow[] {
  const byId = new Map(rows.map(r => [r.id, r]));
  return stations.flatMap(s => {
    const w = byId.get(s.icao);
    const at = w ? Date.parse(w.at) : NaN;
    if (!w || !Number.isFinite(at)) return [];
    const minutesAgo = Math.max(0, Math.round((now - at) / 60_000));
    if (minutesAgo > MAX_AGE_MIN) return [];
    const text = style === 'everyday' ? describeEveryday(w, cc, t) : describeReport(w, cc, t);
    return text ? [{ icao: s.icao, name: s.name, km: s.km, text, cat: w.cat, minutesAgo }] : [];
  });
}

export async function metarNow(stations: { icao: string; name: string; km: number }[], cc: string, t: Translate, style: ReportStyle = 'aviation'): Promise<StationNow[]> {
  if (!stations.length) return [];
  const rows = await allStations();
  return rows ? stationsNow(rows, stations, cc, Date.now(), t, style) : [];
}
