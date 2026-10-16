import { describe, expect, it } from 'vitest';
import { AQ_CITIES, aqiBand, mapOpenMeteoAq, openMeteoAqUrl } from './open-meteo';

// Verbatim from air-quality-api.open-meteo.com for London and Delhi, 2026-10-12 (units trimmed).
const RAW = [
  { latitude: 51.5, longitude: -0.10000038, current: { time: '2026-10-12T20:00', interval: 3600, pm2_5: 6.4, pm10: 8.9, us_aqi: 40, european_aqi: 40, nitrogen_dioxide: 25.4, ozone: 27.0 } },
  { latitude: 28.599998, longitude: 77.20001, current: { time: '2026-10-12T20:00', interval: 3600, pm2_5: 79.4, pm10: 92.4, us_aqi: 114, european_aqi: 75, nitrogen_dioxide: 60.0, ozone: 23.0 } },
];
const CITIES = [
  { name: 'London', country: 'GB', lat: 51.507, lng: -0.128 },
  { name: 'Delhi', country: 'IN', lat: 28.614, lng: 77.209 },
];

describe('mapOpenMeteoAq', () => {
  it('pairs each answer with the city asked for, in order', () => {
    const [london, delhi] = mapOpenMeteoAq(RAW, CITIES);
    expect(london).toEqual({
      id: 'aq-gb-london', name: 'London', city: 'London', country: 'GB', lat: 51.507, lng: -0.128,
      pm25: 6.4, pm10: 8.9, us_aqi: 40, european_aqi: 40, no2: 25.4, o3: 27,
      unit: 'µg/m³', level: 'Good', color: '#00E676', lastUpdated: '2026-10-12T20:00Z',
      kind: 'modelled', source: 'Open-Meteo (CAMS)',
    });
    expect(delhi).toMatchObject({ us_aqi: 114, level: 'Unhealthy (Sensitive)' });
  });

  it('accepts a single-city object and skips rows without a reading', () => {
    expect(mapOpenMeteoAq(RAW[0], CITIES)).toHaveLength(1);
    expect(mapOpenMeteoAq([{ current: { pm2_5: null, us_aqi: null } }, RAW[1]], CITIES).map(r => r.name)).toEqual(['Delhi']);
    expect(() => mapOpenMeteoAq({ error: true, reason: 'x' }, CITIES)).toThrow();
  });
});

describe('aqiBand', () => {
  it('follows the EPA breakpoints', () => {
    expect([0, 50, 51, 100, 101, 150, 151, 200, 201, 300, 301].map(a => aqiBand(a).level)).toEqual([
      'Good', 'Good', 'Moderate', 'Moderate', 'Unhealthy (Sensitive)', 'Unhealthy (Sensitive)',
      'Unhealthy', 'Unhealthy', 'Very Unhealthy', 'Very Unhealthy', 'Hazardous',
    ]);
  });
});

describe('openMeteoAqUrl', () => {
  it('asks for every city in one request', () => {
    const url = new URL(openMeteoAqUrl(AQ_CITIES));
    expect(url.searchParams.get('latitude')?.split(',')).toHaveLength(AQ_CITIES.length);
    expect(url.searchParams.get('current')).toBe('pm2_5,pm10,us_aqi,european_aqi,nitrogen_dioxide,ozone');
  });
});

const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;
liveIt('reads live readings for every city', async () => {
  const res = await fetch(openMeteoAqUrl(AQ_CITIES), { signal: AbortSignal.timeout(20_000) });
  expect(mapOpenMeteoAq(await res.json(), AQ_CITIES).length).toBeGreaterThan(AQ_CITIES.length * 0.9);
}, 30_000);
