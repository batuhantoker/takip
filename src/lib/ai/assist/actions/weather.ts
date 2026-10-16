/** weather: the weather at a place: the nearest airport's observation, the model forecast at the point, and warnings near it. */
import type { AirportWx } from '@/lib/feeds/aviation-weather/metar';
import { weatherLabel } from '@/lib/feeds/weather/weather-field';
import { entitiesOf } from '../catalog';
import { km } from '../query/geo';
import type { Lookup, Outcome } from '../tools';
import { dataOf, ensure, fail, getJson, ok, placeOf, round, str } from './shared';

const METAR_KM = 100;
const WARNING_KM = 150;
const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const compass = (deg: number) => COMPASS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];

interface OpenMeteo {
  current?: { time?: string; temperature_2m?: number; apparent_temperature?: number; relative_humidity_2m?: number; precipitation?: number; weather_code?: number; cloud_cover?: number; wind_speed_10m?: number; wind_direction_10m?: number; wind_gusts_10m?: number };
  hourly?: { time?: string[]; temperature_2m?: number[]; precipitation_probability?: number[]; weather_code?: number[] };
  timezone?: string;
  /** Ground height at the point, metres above sea level. */
  elevation?: number;
}

// Open-Meteo's free API is for non-commercial use, like the weather-grid route that already uses it; check its terms before the paid plan.
const openMeteo = (lat: number, lng: number) =>
  `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lng.toFixed(3)}&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m&hourly=temperature_2m,precipitation_probability,weather_code&forecast_hours=12&wind_speed_unit=kmh&timezone=auto`;

export async function weather(a: Record<string, unknown>, lk: Lookup, signal?: AbortSignal): Promise<Outcome> {
  const place = await placeOf(lk, a.place ?? a.near);
  if (!place) return fail('weather', `Could not find "${str(a.place ?? a.near)}" on the map`);
  await ensure(lk, 'weather', signal).catch(() => false);
  const [metars, model] = await Promise.all([
    getJson<{ airports?: AirportWx[] }>(lk, '/api/aviation-weather?kind=airports', signal).catch(() => null),
    getJson<OpenMeteo>(lk, openMeteo(place.lat, place.lng), signal).catch(() => null),
  ]);

  const station = (metars?.airports ?? [])
    .map(s => ({ s, d: km(place, s) }))
    .filter(x => x.d <= METAR_KM)
    .sort((x, y) => x.d - y.d)[0];
  const obs = station ? {
    station: station.s.id, km: Math.round(station.d), at: station.s.at, metar: station.s.raw,
    temp_c: station.s.tempC ?? null, dew_c: station.s.dewC ?? null,
    wind: station.s.windKt !== undefined ? `${station.s.windDir !== undefined ? compass(station.s.windDir) : 'variable'} ${station.s.windKt} kt${station.s.gustKt ? ` gusting ${station.s.gustKt}` : ''}` : null,
    visibility_sm: station.s.visSm ?? null, ceiling_ft: station.s.ceilingFt ?? null, weather: station.s.wx ?? null, flight_category: station.s.cat,
  } : null;

  const c = model?.current;
  const now = c ? {
    conditions: weatherLabel(c.weather_code), temp_c: c.temperature_2m ?? null, feels_like_c: c.apparent_temperature ?? null, humidity_pct: c.relative_humidity_2m ?? null,
    wind: c.wind_speed_10m !== undefined ? `${c.wind_direction_10m !== undefined ? compass(c.wind_direction_10m) : ''} ${Math.round(c.wind_speed_10m)} km/h${c.wind_gusts_10m ? `, gusts ${Math.round(c.wind_gusts_10m)}` : ''}`.trim() : null,
    cloud_pct: c.cloud_cover ?? null, precipitation_mm: c.precipitation ?? null, local_time: c.time ?? null, timezone: model?.timezone ?? null,
  } : null;
  const h = model?.hourly;
  const next = h?.time?.length ? {
    high_c: Math.max(...(h.temperature_2m ?? []).filter(Number.isFinite)), low_c: Math.min(...(h.temperature_2m ?? []).filter(Number.isFinite)),
    rain_chance_max_pct: Math.max(0, ...(h.precipitation_probability ?? []).filter(Number.isFinite)),
    conditions: [...new Set((h.weather_code ?? []).map(weatherLabel))].filter(w => w !== 'Unknown').slice(0, 3),
  } : null;

  const warnings = entitiesOf(dataOf(lk), 'weather')
    .filter(e => e.lat !== null && e.lng !== null && km(place, { lat: e.lat, lng: e.lng }) <= WARNING_KM)
    .slice(0, 6).map(e => ({ title: e.title, detail: e.detail }));

  if (!obs && !now) return fail('weather', `No weather reading for ${place.name} just now: no airport within ${METAR_KM} km and the forecast service did not answer`);
  const temp = now?.temp_c ?? obs?.temp_c;
  const summary = [
    `${place.name}: ${now?.conditions ?? obs?.weather ?? 'conditions unknown'}${temp != null ? `, ${Math.round(temp)}°C` : ''}`,
    obs ? `${obs.station} (${obs.km} km) reports ${obs.wind ?? 'calm'}${obs.flight_category ? `, ${obs.flight_category}` : ''}` : `no airport within ${METAR_KM} km`,
    next ? `next 12 h ${Math.round(next.low_c)}–${Math.round(next.high_c)}°C, rain chance up to ${next.rain_chance_max_pct}%` : '',
    warnings.length ? `${warnings.length} warning${warnings.length === 1 ? '' : 's'} within ${WARNING_KM} km` : '',
  ].filter(Boolean).join('; ');
  return ok('weather', summary, {
    place: { name: place.name, lat: round(place.lat), lng: round(place.lng), ...(Number.isFinite(model?.elevation) ? { ground_m: Math.round(model!.elevation!) } : {}) },
    now, next_12h: next, observed: obs, warnings,
    sources: [obs ? 'aviationweather.gov METAR' : '', now ? 'Open-Meteo model forecast' : ''].filter(Boolean),
  }, {
    kind: 'weather', title: place.name, subtitle: now?.conditions,
    items: [
      ...(now ? [{ label: `${temp != null ? `${Math.round(temp)}°C` : ''} ${now.conditions}`.trim(), detail: [now.wind, now.humidity_pct != null ? `${now.humidity_pct}% humidity` : ''].filter(Boolean).join(' · ') || undefined, lat: place.lat, lng: place.lng }] : []),
      ...(next ? [{ label: `Next 12 h: ${Math.round(next.low_c)}–${Math.round(next.high_c)}°C`, detail: [`rain chance up to ${next.rain_chance_max_pct}%`, next.conditions.join(', ')].filter(Boolean).join(' · ') }] : []),
      ...(obs && station ? [{ label: `${obs.station}, ${obs.km} km`, detail: obs.metar, lat: station.s.lat, lng: station.s.lng }] : []),
      ...warnings.map(w => ({ label: w.title, detail: w.detail || undefined })),
    ],
  });
}
