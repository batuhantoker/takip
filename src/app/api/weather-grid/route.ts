import { NextResponse } from 'next/server';

/**
 * OSIRIS — Global weather grid (Open-Meteo, keyless, CC BY 4.0).
 *
 * Open-Meteo bills every location as one call against the free tier (10k/day,
 * 600/min), so the 510-point grid is fetched as a single 24-hour forecast every
 * three hours (~4k calls/day) and each request is answered with the hour
 * nearest to now. Readers share that one forecast however many are watching.
 */

const range = (from: number, to: number, step: number) =>
  Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);

export const GRID_LATS = range(-80, 80, 10);
export const GRID_LNGS = range(-180, 168, 12);

const HOURLY = [
  'temperature_2m', 'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m',
  'precipitation', 'cloud_cover', 'weather_code',
] as const;
type HourlyVar = typeof HOURLY[number];

const REFRESH_MS = 3 * 60 * 60_000;
const RETRY_MS = 10 * 60_000;
const ATTRIBUTION = 'Weather data by Open-Meteo.com (CC BY 4.0)';

export interface WeatherPoint {
  lat: number;
  lng: number;
  temp: number | null;
  wind: number | null;
  windDir: number | null;
  gust: number | null;
  precip: number | null;
  cloud: number | null;
  code: number | null;
}

interface Forecast {
  fetchedAt: number;
  /** Unix seconds, hourly. */
  times: number[];
  /** One entry per grid point, row-major: GRID_LATS outer, GRID_LNGS inner. */
  series: Record<HourlyVar, (number | null)[]>[];
}

const globalForGrid = globalThis as unknown as {
  weatherGrid?: { forecast: Forecast | null; nextFetch: number; inflight: Promise<Forecast | null> | null };
};

async function fetchForecast(): Promise<Forecast> {
  const lats: number[] = [];
  const lngs: number[] = [];
  for (const lat of GRID_LATS) for (const lng of GRID_LNGS) { lats.push(lat); lngs.push(lng); }

  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', lats.join(','));
  url.searchParams.set('longitude', lngs.join(','));
  url.searchParams.set('hourly', HOURLY.join(','));
  url.searchParams.set('forecast_hours', '24');
  url.searchParams.set('timeformat', 'unixtime');
  // A regular grid wants the cell under each point, not the nearest land cell.
  url.searchParams.set('cell_selection', 'nearest');

  const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`Open-Meteo answered ${res.status}`);
  const body = await res.json();
  const list: { hourly?: Record<string, (number | null)[]> & { time?: number[] } }[] = Array.isArray(body) ? body : [body];
  if (list.length !== lats.length || !list[0]?.hourly?.time?.length) {
    throw new Error(`Open-Meteo returned ${list.length} of ${lats.length} grid points`);
  }
  return {
    fetchedAt: Date.now(),
    times: list[0].hourly.time,
    series: list.map(l => Object.fromEntries(HOURLY.map(v => [v, l.hourly?.[v] ?? []])) as Forecast['series'][number]),
  };
}

async function loadForecast(): Promise<Forecast | null> {
  const state = (globalForGrid.weatherGrid ??= { forecast: null, nextFetch: 0, inflight: null });
  if (Date.now() < state.nextFetch) return state.forecast;
  if (state.inflight) return state.inflight;

  state.inflight = fetchForecast()
    .then(forecast => {
      state.forecast = forecast;
      state.nextFetch = Date.now() + REFRESH_MS;
      return forecast;
    })
    .catch(err => {
      console.warn('[OSIRIS] Open-Meteo grid refresh failed:', err instanceof Error ? err.message : err);
      state.nextFetch = Date.now() + RETRY_MS;
      return state.forecast;
    })
    .finally(() => { state.inflight = null; });
  return state.inflight;
}

/** Index of the forecast hour nearest `nowSec`, or -1 once the forecast has run out. */
export function hourIndex(times: number[], nowSec: number): number {
  if (!times.length || nowSec > times[times.length - 1] + 3600) return -1;
  let best = 0;
  for (let i = 1; i < times.length; i++) {
    if (Math.abs(times[i] - nowSec) < Math.abs(times[best] - nowSec)) best = i;
  }
  return best;
}

/** Test seam — drops the cached forecast. */
export function clearWeatherGrid(): void {
  delete globalForGrid.weatherGrid;
}

export async function GET() {
  const forecast = await loadForecast();
  const i = forecast ? hourIndex(forecast.times, Date.now() / 1000) : -1;
  if (!forecast || i < 0) {
    return NextResponse.json({ error: 'Weather grid unavailable' }, { status: 503 });
  }

  const cols = GRID_LNGS.length;
  const at = (s: Forecast['series'][number], v: HourlyVar) => s[v]?.[i] ?? null;
  const points: WeatherPoint[] = forecast.series.map((s, k) => ({
    lat: GRID_LATS[Math.floor(k / cols)],
    lng: GRID_LNGS[k % cols],
    temp: at(s, 'temperature_2m'),
    wind: at(s, 'wind_speed_10m'),
    windDir: at(s, 'wind_direction_10m'),
    gust: at(s, 'wind_gusts_10m'),
    precip: at(s, 'precipitation'),
    cloud: at(s, 'cloud_cover'),
    code: at(s, 'weather_code'),
  }));

  return NextResponse.json({
    time: new Date(forecast.times[i] * 1000).toISOString(),
    fetchedAt: new Date(forecast.fetchedAt).toISOString(),
    attribution: ATTRIBUTION,
    lats: GRID_LATS,
    lngs: GRID_LNGS,
    points,
  }, {
    headers: { 'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=600' },
  });
}
