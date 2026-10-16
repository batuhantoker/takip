import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, GRID_LATS, GRID_LNGS, clearWeatherGrid, hourIndex } from './route';

const T0 = Date.parse('2026-10-11T17:00:00Z') / 1000;
const POINTS = GRID_LATS.length * GRID_LNGS.length;

/** Open-Meteo's multi-location reply: one entry per requested point, in request order. */
function upstream(hours = 24) {
  return Array.from({ length: POINTS }, (_, k) => ({
    hourly: {
      time: Array.from({ length: hours }, (_, h) => T0 + h * 3600),
      temperature_2m: Array.from({ length: hours }, (_, h) => k + h / 100),
      wind_speed_10m: Array(hours).fill(12),
      wind_direction_10m: Array(hours).fill(270),
      wind_gusts_10m: Array(hours).fill(20),
      precipitation: Array(hours).fill(0),
      cloud_cover: Array(hours).fill(50),
      weather_code: Array(hours).fill(2),
    },
  }));
}

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

describe('GET /api/weather-grid', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-11T17:20:00Z'));
    clearWeatherGrid();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('asks for the whole grid in one request', async () => {
    fetchMock.mockResolvedValue(ok(upstream()));
    await GET();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.searchParams.get('latitude')!.split(',')).toHaveLength(POINTS);
    expect(url.searchParams.get('forecast_hours')).toBe('24');
  });

  it('answers with the hour nearest now, row-major over the grid', async () => {
    fetchMock.mockResolvedValue(ok(upstream()));
    const body = await (await GET()).json();

    expect(body.time).toBe('2026-10-11T17:00:00.000Z');
    expect(body.points).toHaveLength(POINTS);
    expect(body.points[0]).toMatchObject({ lat: GRID_LATS[0], lng: GRID_LNGS[0], temp: 0, wind: 12, windDir: 270 });
    expect(body.points[GRID_LNGS.length]).toMatchObject({ lat: GRID_LATS[1], lng: GRID_LNGS[0] });
    expect(body.attribution).toContain('Open-Meteo');
  });

  it('moves on to later hours from the same forecast without asking again', async () => {
    fetchMock.mockResolvedValue(ok(upstream()));
    await GET();
    vi.setSystemTime(new Date('2026-10-11T19:05:00Z'));
    const body = await (await GET()).json();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(body.time).toBe('2026-10-11T19:00:00.000Z');
    expect(body.points[0].temp).toBeCloseTo(0.02);
  });

  it('keeps serving the last forecast when a refresh fails', async () => {
    fetchMock.mockResolvedValueOnce(ok(upstream()));
    await GET();
    vi.setSystemTime(new Date('2026-10-11T20:40:00Z'));
    fetchMock.mockResolvedValueOnce(new Response('busy', { status: 429 }));

    const res = await GET();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res.status).toBe(200);
    expect((await res.json()).time).toBe('2026-10-11T21:00:00.000Z');
  });

  it('rejects a reply that is missing grid points', async () => {
    fetchMock.mockResolvedValue(ok(upstream().slice(0, 10)));
    expect((await GET()).status).toBe(503);
  });
});

describe('hourIndex', () => {
  it('picks the nearest hour and gives up once the forecast has run out', () => {
    const times = [0, 3600, 7200];
    expect(hourIndex(times, 1700)).toBe(0);
    expect(hourIndex(times, 1900)).toBe(1);
    expect(hourIndex(times, 7200 + 3601)).toBe(-1);
    expect(hourIndex([], 0)).toBe(-1);
  });
});
