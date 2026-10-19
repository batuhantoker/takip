import { beforeEach, describe, expect, it } from 'vitest';
import { GET, clearMaritimeSnapshot } from './route';

const ships = () => (globalThis as unknown as { shipsCache: Map<number, object> }).shipsCache;
const add = (mmsi: number, lat: number, lng: number, speed: number, type?: string, timestamp = Date.now()) =>
  ships().set(mmsi, { id: mmsi, mmsi, lat, lng, speed, type, timestamp });
const get = async (query: string) => {
  const res = await GET(new Request(`http://localhost/api/maritime?${query}`));
  return { status: res.status, body: await res.json() };
};

describe('GET /api/maritime?near=', () => {
  beforeEach(() => {
    ships().clear();
    clearMaritimeSnapshot();
  });

  it('counts the ships around a point instead of listing every ship', async () => {
    add(1, 51.9, 4.48, 0, 'cargo');
    add(2, 51.95, 4.5, 12, 'cargo');
    add(3, 51.9, 4.6, 3);
    add(4, 51.9, 4.19, 10, 'tanker'); // 20 km west
    add(5, 51.9, 4.48, 8, 'tanker', Date.now() - 11 * 60_000); // not heard for 11 minutes

    const { status, body } = await get('near=51.9,4.48&km=10');
    expect(status).toBe(200);
    expect(body).toEqual({ near: { km: 10, total: 3, underway: 2, types: { cargo: 2, other: 1 } }, timestamp: expect.any(String) });
  });

  it('counts within 10 km by default and never beyond 100', async () => {
    add(1, 51.9, 4.19, 10, 'tanker');
    expect((await get('near=51.9,4.48')).body.near).toMatchObject({ km: 10, total: 0 });
    expect((await get('near=51.9,4.48&km=5000')).body.near).toMatchObject({ km: 100, total: 1 });
  });

  it('turns away a point or radius that does not parse', async () => {
    for (const q of ['near=abc', 'near=91,0', 'near=0,181', 'near=1', 'near=1,2,3', 'near=,4', 'near=1,2&km=-1', 'near=1,2&km=x', 'near=1,2&km=']) {
      expect((await get(q)).status, q).toBe(400);
    }
  });

  it('still sends the whole snapshot without near', async () => {
    add(1, 1.26, 103.84, 0, 'cargo');
    const { body } = await get('');
    expect(body.ships).toHaveLength(1);
    expect(body.near).toBeUndefined();
  });
});
