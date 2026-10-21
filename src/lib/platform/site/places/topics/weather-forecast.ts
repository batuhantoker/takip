import { forecastPoint, type Forecast, type ForecastStep } from '@/lib/feeds/weather/forecast';
import { ownApi } from '../../live/own-api';
import type { Place } from '../place';
import { localClock } from './sky-time';

/** The forecast as a city page shows it: the next day in three-hour steps, then a line a day, in the place's own time. */

export interface ForecastHour {
  t: number;
  tempC: number;
  windMs: number;
  windDir: number;
  /** Over the three hours from `t`; null where the forecast doesn't say. */
  precipMm: number | null;
  symbol: string | null;
}

export interface ForecastDay {
  /** YYYY-MM-DD in the place's time zone. */
  date: string;
  minC: number;
  maxC: number;
  precipMm: number;
  windMaxMs: number;
  symbol: string | null;
}

export interface CityForecast {
  updated: string | null;
  tz: string;
  /** The place's date now, YYYY-MM-DD. */
  today: string;
  hours: ForecastHour[];
  days: ForecastDay[];
}

const HOUR = 3_600_000;
const STRIP = 8;
const DAYS = 7;

/** Every step's precipitation once: hourly amounts while they last, then the six-hourly ones after them. */
function precipitation(steps: ForecastStep[]): Map<number, number> {
  const out = new Map<number, number>();
  let covered = -Infinity;
  for (const s of steps) {
    if (s.precipMm == null || !s.hours || s.t < covered) continue;
    out.set(s.t, s.precipMm);
    covered = s.t + s.hours * HOUR;
  }
  return out;
}

export function summarise(f: Forecast, tz: string, now: number): CityForecast {
  const steps = f.steps.filter(s => s.t >= now - HOUR / 2);
  const rain = precipitation(steps);

  const hourly = steps.filter(s => s.hours === 1);
  const hours: ForecastHour[] = [];
  for (let i = 0; i < hourly.length && hours.length < STRIP; i += 3) {
    const s = hourly[i];
    const three = hourly.slice(i, i + 3);
    hours.push({
      t: s.t, tempC: s.tempC, windMs: s.windMs, windDir: s.windDir,
      precipMm: three.length === 3 && three.every(x => x.precipMm != null) ? three.reduce((a, x) => a + x.precipMm!, 0) : null,
      symbol: s.symbol,
    });
  }

  const byDate = new Map<string, ForecastStep[]>();
  for (const s of steps) {
    const date = localClock(s.t, tz).date;
    byDate.set(date, [...(byDate.get(date) ?? []), s]);
  }
  const today = localClock(now, tz);
  const days: ForecastDay[] = [];
  for (const [date, list] of byDate) {
    // Today only while most of it is still ahead; a later day only with its morning, afternoon and evening.
    if (date === today.date ? today.hour >= 12 : list.length < 3) continue;
    const midday = list.reduce((best, s) => (Math.abs(localClock(s.t, tz).hour - 13) < Math.abs(localClock(best.t, tz).hour - 13) ? s : best));
    days.push({
      date,
      minC: Math.min(...list.map(s => s.tempC)),
      maxC: Math.max(...list.map(s => s.tempC)),
      precipMm: list.reduce((a, s) => a + (rain.get(s.t) ?? 0), 0),
      windMaxMs: Math.max(...list.map(s => s.windMs)),
      symbol: midday.symbol,
    });
    if (days.length === DAYS) break;
  }
  return { updated: f.updated, tz, today: today.date, hours, days };
}

/** The place's forecast, over loopback (app/api/(feeds)/forecast); null when MET Norway can't be reached. */
export async function cityForecast(place: Place, tz: string): Promise<CityForecast | null> {
  const p = forecastPoint(place.at[1], place.at[0]);
  const f = await ownApi<Forecast>(`/api/forecast?lat=${p.lat}&lon=${p.lon}`, 900);
  return f?.steps?.length ? summarise(f, tz, Date.now()) : null;
}
