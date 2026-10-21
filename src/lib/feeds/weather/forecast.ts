/**
 * Point forecasts from MET Norway's Locationforecast 2.0 (CC BY 4.0, free for any use): hourly for about two and a
 * half days, then every six hours to day ten, worldwide.
 */

export const MET_FORECAST_URL = 'https://api.met.no/weatherapi/locationforecast/2.0/compact';
export const MET_CREDIT = 'MET Norway';

/** One forecast time. Precipitation falls over the `hours` after `t`. */
export interface ForecastStep {
  /** Epoch ms. */
  t: number;
  tempC: number;
  windMs: number;
  /** Degrees the wind blows from. */
  windDir: number;
  rh: number | null;
  precipMm: number | null;
  hours: 1 | 6 | null;
  /** MET's symbol code: "rainshowers_day", "cloudy". */
  symbol: string | null;
}

export interface Forecast {
  /** When MET last ran it, ISO. */
  updated: string | null;
  steps: ForecastStep[];
}

interface MetPeriod { summary?: { symbol_code?: string }; details?: { precipitation_amount?: number } }
interface MetStep {
  time: string;
  data: {
    instant: { details: { air_temperature?: number; wind_speed?: number; wind_from_direction?: number; relative_humidity?: number } };
    next_1_hours?: MetPeriod;
    next_6_hours?: MetPeriod;
  };
}
interface MetReply { properties?: { meta?: { updated_at?: string }; timeseries?: MetStep[] } }

export function parseMetForecast(json: unknown): Forecast {
  const props = (json as MetReply)?.properties;
  const steps: ForecastStep[] = [];
  for (const s of props?.timeseries ?? []) {
    const d = s.data?.instant?.details;
    const t = Date.parse(s.time);
    if (!d || !Number.isFinite(t) || d.air_temperature == null || d.wind_speed == null) continue;
    const period = s.data.next_1_hours ?? s.data.next_6_hours;
    steps.push({
      t,
      tempC: d.air_temperature,
      windMs: d.wind_speed,
      windDir: d.wind_from_direction ?? 0,
      rh: d.relative_humidity ?? null,
      precipMm: period?.details?.precipitation_amount ?? null,
      hours: s.data.next_1_hours ? 1 : s.data.next_6_hours ? 6 : null,
      symbol: period?.summary?.symbol_code ?? null,
    });
  }
  return { updated: props?.meta?.updated_at ?? null, steps };
}

/** MET asks for at most four decimals; two (about a kilometre) lets neighbouring pages share one answer. */
export const forecastPoint = (lat: number, lon: number) => ({ lat: Math.round(lat * 100) / 100, lon: Math.round(lon * 100) / 100 });
