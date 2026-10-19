import { beforeEach, describe, expect, it } from 'vitest';
import { GET, clearMaritimeSnapshot } from './route';

const ships = () => (globalThis as unknown as { shipsCache: Map<number, object> }).shipsCache;
const add = (mmsi: number, timestamp: number) => ships().set(mmsi, { id: mmsi, mmsi, lat: 10, lng: 10, speed: 5, timestamp });
const get = async (query = '') => {
  const res = await GET(new Request(`http://localhost/api/maritime${query}`));
  return { cache: res.headers.get('Cache-Control'), body: await res.json() };
};

describe('GET /api/maritime?since=', () => {
  beforeEach(() => {
    ships().clear();
    clearMaritimeSnapshot();
  });

  it('sends only the ships heard after the last reply, with the ports and the full count', async () => {
    const now = Date.now();
    add(1, now - 60_000);
    add(2, now - 30_000);
    add(3, now - 1_000);
    const full = await get();
    expect(full.body.ships.map((s: { mmsi: number }) => s.mmsi)).toEqual([1, 2, 3]);
    expect(full.body.delta).toBeUndefined();

    const since = now - 40_000;
    const delta = await get(`?since=${since}`);
    expect(delta.body).toMatchObject({ delta: true, total_ships: 3, timestamp: full.body.timestamp });
    expect(delta.body.ships.map((s: { mmsi: number }) => s.mmsi)).toEqual([2, 3]);
    expect(delta.body.ports.length).toBe(full.body.ports.length);
    expect(delta.cache).toBe('private, no-store');
  });

  it('sends everything when the time is too old, in the future or not a time', async () => {
    add(1, Date.now() - 1_000);
    for (const q of [`?since=${Date.now() - 11 * 60_000}`, `?since=${Date.now() + 60_000}`, '?since=abc']) {
      expect((await get(q)).body.delta, q).toBeUndefined();
    }
  });
});
