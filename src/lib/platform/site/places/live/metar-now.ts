import type { Translate } from '@/lib/core/i18n/translator';
import type { AirportWx } from '@/lib/feeds/aviation-weather/metar';
import { ownApi } from '../../live/own-api';

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

/** These stations' reports from the last three hours, in the order given. */
export function stationsNow(rows: AirportWx[], stations: { icao: string; name: string; km: number }[], cc: string, now: number, t: Translate): StationNow[] {
  const byId = new Map(rows.map(r => [r.id, r]));
  return stations.flatMap(s => {
    const w = byId.get(s.icao);
    const at = w ? Date.parse(w.at) : NaN;
    if (!w || !Number.isFinite(at)) return [];
    const minutesAgo = Math.max(0, Math.round((now - at) / 60_000));
    if (minutesAgo > MAX_AGE_MIN) return [];
    const text = describeReport(w, cc, t);
    return text ? [{ icao: s.icao, name: s.name, km: s.km, text, cat: w.cat, minutesAgo }] : [];
  });
}

export async function metarNow(stations: { icao: string; name: string; km: number }[], cc: string, t: Translate): Promise<StationNow[]> {
  if (!stations.length) return [];
  const rows = await allStations();
  return rows ? stationsNow(rows, stations, cc, Date.now(), t) : [];
}
