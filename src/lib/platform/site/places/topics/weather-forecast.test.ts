import { describe, expect, it } from 'vitest';
import { parseMetForecast } from '@/lib/feeds/weather/forecast';
import { summarise } from './weather-forecast';

const H = 3_600_000;
const START = Date.UTC(2026, 9, 21, 6);

/** MET's hourly steps for 60 hours, then six-hourly to day ten, as Locationforecast sends them. */
function reply() {
  const timeseries = [];
  for (let h = 0; h < 60; h++) {
    timeseries.push({
      time: new Date(START + h * H).toISOString(),
      data: {
        instant: { details: { air_temperature: 10 + (h % 24) / 2, wind_speed: 3, wind_from_direction: 225, relative_humidity: 80 } },
        next_1_hours: { summary: { symbol_code: 'rain' }, details: { precipitation_amount: 0.5 } },
        next_6_hours: { summary: { symbol_code: 'rain' }, details: { precipitation_amount: 3 } },
      },
    });
  }
  for (let h = 60; h < 240; h += 6) {
    timeseries.push({
      time: new Date(START + h * H).toISOString(),
      data: {
        instant: { details: { air_temperature: 12, wind_speed: 5, wind_from_direction: 0 } },
        next_6_hours: { summary: { symbol_code: 'cloudy' }, details: { precipitation_amount: 1 } },
      },
    });
  }
  return { properties: { meta: { updated_at: '2026-10-21T05:00:00Z' }, timeseries } };
}

describe('city forecast', () => {
  const f = summarise(parseMetForecast(reply()), 'Europe/Istanbul', START);

  it('gives the next day every three hours, with the rain over each three', () => {
    expect(f.hours).toHaveLength(8);
    expect(f.hours[1].t - f.hours[0].t).toBe(3 * H);
    expect(f.hours[0].precipMm).toBeCloseTo(1.5);
  });

  it('counts each hour of rain once, hourly amounts before six-hourly ones', () => {
    // 09:00 local is 06:00 UTC: today (from 09:00) has fifteen wet hours left.
    expect(f.today).toBe('2026-10-21');
    expect(f.days[0].date).toBe('2026-10-21');
    expect(f.days[0].precipMm).toBeCloseTo(7.5);
    expect(f.days[1].precipMm).toBeCloseTo(12);
  });

  it('keeps seven days, each with enough of it forecast', () => {
    expect(f.days).toHaveLength(7);
    expect(f.days.every(d => d.maxC >= d.minC)).toBe(true);
    expect(f.days.at(-1)!.symbol).toBe('cloudy');
  });

  it('starts at tomorrow once most of today is past', () => {
    const late = summarise(parseMetForecast(reply()), 'Europe/Istanbul', START + 8 * H);
    expect(late.days[0].date).toBe('2026-10-22');
  });
});
