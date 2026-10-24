import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseBoundaries, type PickResult } from './areas/boundaries';
import { REST_MS, TOWN_RETRY_MS, TOWN_TRIES, createPointerPlace, geocodeCell, pointerPlace, townOf } from './pointer-place';

const square = (w: number, s: number, e: number, n: number) => [[w, s], [e, s], [e, n], [w, n], [w, s]];
const fc = (features: [object, number[][]][]) => ({
  type: 'FeatureCollection',
  features: features.map(([properties, ring]) => ({ type: 'Feature', properties, geometry: { type: 'Polygon', coordinates: [ring] } })) as GeoJSON.Feature[],
});

const COUNTRIES = fc([
  [{ id: 'AAA', name: 'Alpha', iso3: 'AAA' }, square(0, 0, 10, 10)],
  [{ id: 'BBB', name: 'Bravo', iso3: 'BBB' }, square(10, 0, 20, 10)],
]);
// The border sits off the 0.1° grid, so a pointer at 5.04 is in East while its cell's centre (5.0) is in West.
const ALPHA_STATES = fc([
  [{ id: 'AAA-W', name: 'West', country: 'Alpha', countryId: 'AAA' }, square(0, 0, 5.02, 10)],
  [{ id: 'AAA-E', name: 'İstanbul', country: 'Alpha', countryId: 'AAA' }, square(5.02, 0, 10, 10)],
]);

describe('geocodeCell', () => {
  it('rounds to the route grid and wraps a longitude panned past the dateline', () => {
    expect(geocodeCell(41.0123, 388.98)).toEqual({ key: '41.0,29.0', lat: 41, lng: 29, url: '/api/geo/reverse?lat=41.0&lng=29.0' });
    expect(geocodeCell(-0.04, -0.04).key).toBe('0.0,0.0');
  });
});

describe('townOf', () => {
  it('takes the first part of a line that has more than one', () => {
    expect(townOf('Çankaya, Central Anatolia Region, Turkey')).toBe('Çankaya');
    expect(townOf('Berlin, Germany')).toBe('Berlin');
    expect(townOf('Monaco')).toBeNull();
    expect(townOf(null)).toBeNull();
  });
});

describe('pointerPlace', () => {
  const [alpha] = parseBoundaries(COUNTRIES, 'country');
  const [west, east] = parseBoundaries(ALPHA_STATES, 'admin1');
  const at = (boundary: PickResult['boundary'], parents = boundary === alpha ? [] : [alpha]): PickResult =>
    ({ boundary, parents, loading: false });

  it('puts the cell’s town before the province and country under the pointer', () => {
    expect(pointerPlace(at(west), at(west), 'Townsville, Some Region, Alpha')).toBe('Townsville, West, Alpha');
  });

  it('drops a town that repeats the province, ignoring case and accents', () => {
    expect(pointerPlace(at(east), at(east), 'Istanbul, Marmara Region, Alpha')).toBe('İstanbul, Alpha');
  });

  it('drops the town when the cell’s centre is across a border', () => {
    expect(pointerPlace(at(east), at(west), 'Townsville, Some Region, Alpha')).toBe('İstanbul, Alpha');
  });

  it('falls back to the route’s line where no outline covers the pointer', () => {
    expect(pointerPlace(at(null, []), at(null, []), 'Islet, Region, Alpha')).toBe('Islet, Region, Alpha');
    expect(pointerPlace(at(null, []), at(null, []), null)).toBe('');
  });
});

describe('createPointerPlace', () => {
  let reverse: { label: string | null; cache: string; retryAfter?: string };
  const fetchMock = vi.fn(async (url: string) => {
    if (url.endsWith('/countries.json')) return Response.json(COUNTRIES);
    if (url.endsWith('/admin1/AAA.json')) return Response.json(ALPHA_STATES);
    if (url.startsWith('/api/geo/reverse')) {
      return Response.json({ label: reverse.label }, { headers: { 'cache-control': reverse.cache, ...(reverse.retryAfter && { 'retry-after': reverse.retryAfter }) } });
    }
    return new Response(null, { status: 404 });
  });
  const shown = () => {
    const place = createPointerPlace();
    place.subscribe(() => {});
    return place;
  };
  const reverseCalls = () => fetchMock.mock.calls.map(([url]) => url).filter(url => url.startsWith('/api/geo/reverse'));
  // Lets fetches and their JSON resolve without moving the clock.
  const settle = async () => { for (let i = 0; i < 5; i++) await new Promise(r => setImmediate(r)); };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockClear();
    reverse = { label: 'Townsville, Some Region, Alpha', cache: 'public, max-age=86400' };
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  // First, while boundary-store's module cache is still cold.
  it('fetches nothing while no status bar shows the label, and catches up once one does', async () => {
    const place = createPointerPlace();
    place.point(5, 2);
    await vi.advanceTimersByTimeAsync(REST_MS * 2);
    await settle();
    expect(fetchMock).not.toHaveBeenCalled();

    const stop = place.subscribe(() => {});
    await settle();
    expect(place.label()).toBe('West, Alpha');
    stop();
    await vi.advanceTimersByTimeAsync(REST_MS);
    expect(reverseCalls()).toEqual([]);
  });

  it('names the province as soon as the outlines arrive, before any town is asked for', async () => {
    const place = shown();
    place.point(5, 2);
    await settle();
    expect(place.label()).toBe('West, Alpha');
    expect(reverseCalls()).toEqual([]);
  });

  it('asks for a town only once the pointer rests, at the cell’s centre', async () => {
    const place = shown();
    for (const lng of [1, 1.3, 1.6, 1.9, 2.2, 2.5, 2.8, 3.1, 3.4, 3.7]) {
      place.point(5, lng);
      await vi.advanceTimersByTimeAsync(100);
    }
    expect(reverseCalls()).toEqual([]);

    await vi.advanceTimersByTimeAsync(REST_MS);
    await settle();
    expect(reverseCalls()).toEqual(['/api/geo/reverse?lat=5.0&lng=3.7']);
    expect(place.label()).toBe('Townsville, West, Alpha');
  });

  it('leaves out the town of a cell whose centre is in the next province', async () => {
    const place = shown();
    place.point(5, 5.04);
    await vi.advanceTimersByTimeAsync(REST_MS);
    await settle();
    expect(reverseCalls()).toHaveLength(1);
    expect(place.label()).toBe('İstanbul, Alpha');
  });

  it('asks again after a refused lookup, but not after open sea', async () => {
    const place = shown();
    reverse = { label: null, cache: 'no-store' };
    place.point(5, 2);
    await vi.advanceTimersByTimeAsync(REST_MS);
    await settle();
    place.point(5, 2.01);
    await vi.advanceTimersByTimeAsync(REST_MS);
    await settle();
    expect(reverseCalls()).toHaveLength(2);

    reverse = { label: null, cache: 'public, max-age=86400' };
    place.point(5, 2.02);
    await vi.advanceTimersByTimeAsync(REST_MS);
    await settle();
    place.point(5, 2.03);
    await vi.advanceTimersByTimeAsync(REST_MS);
    await settle();
    expect(reverseCalls()).toHaveLength(3);
    expect(place.label()).toBe('West, Alpha');
  });

  it('asks again when the route’s Retry-After says the queued answer should be in', async () => {
    const place = shown();
    reverse = { label: null, cache: 'no-store', retryAfter: '5' };
    place.point(5, 2);
    await vi.advanceTimersByTimeAsync(REST_MS);
    await settle();
    reverse = { label: 'Townsville, Some Region, Alpha', cache: 'public, max-age=86400' };
    await vi.advanceTimersByTimeAsync(TOWN_RETRY_MS);
    await settle();
    expect(reverseCalls()).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(5_000 - TOWN_RETRY_MS);
    await settle();
    expect(reverseCalls()).toHaveLength(2);
    expect(place.label()).toBe('Townsville, West, Alpha');
  });

  it('asks again while the pointer rests on a still-queued lookup, a few times at most', async () => {
    const place = shown();
    reverse = { label: null, cache: 'no-store' };
    place.point(5, 2);
    await vi.advanceTimersByTimeAsync(REST_MS);
    await settle();
    for (let i = 0; i < TOWN_TRIES + 2; i++) {
      await vi.advanceTimersByTimeAsync(TOWN_RETRY_MS);
      await settle();
    }
    expect(reverseCalls()).toHaveLength(TOWN_TRIES);

    place.point(5, 2.5);
    await vi.advanceTimersByTimeAsync(REST_MS);
    await settle();
    reverse = { label: 'Townsville, Some Region, Alpha', cache: 'public, max-age=86400' };
    await vi.advanceTimersByTimeAsync(TOWN_RETRY_MS);
    await settle();
    expect(reverseCalls()).toHaveLength(TOWN_TRIES + 2);
    expect(place.label()).toBe('Townsville, West, Alpha');
  });
});
