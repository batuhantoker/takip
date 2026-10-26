import { forecastPoint, type Forecast } from '@/lib/feeds/weather/forecast';
import { ownApi } from '@/lib/platform/site/live/own-api';
import { summarise, type CityForecast } from '@/lib/platform/site/places/topics/weather-forecast';
import type { Mountain } from './data';

/**
 * MET Norway's forecast at the summit: at the peak's own height, not the model's smoothed ground there, which on a
 * high peak is hundreds of metres lower and several degrees warmer. Times in the nearest town's zone.
 */
export async function summitForecast(m: Mountain): Promise<CityForecast | null> {
  const p = forecastPoint(m.lat, m.lon);
  const altitude = m.elev !== null ? `&altitude=${Math.round(m.elev)}` : '';
  const f = await ownApi<Forecast>(`/api/forecast?lat=${p.lat}&lon=${p.lon}${altitude}`, 900);
  return f?.steps?.length ? summarise(f, m.tz ?? 'UTC', Date.now()) : null;
}
