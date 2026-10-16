import { describe, expect, it } from 'vitest';
import { decodeVehiclePositions } from './realtime';

const varint = (n: number) => {
  const out: number[] = [];
  while (n >= 0x80) { out.push((n % 0x80) | 0x80); n = Math.floor(n / 0x80); }
  out.push(n);
  return out;
};
const tag = (field: number, wire: number) => varint(field * 8 + wire);
const len = (field: number, body: number[]) => [...tag(field, 2), ...varint(body.length), ...body];
const str = (field: number, s: string) => len(field, [...new TextEncoder().encode(s)]);
const num = (field: number, n: number) => [...tag(field, 0), ...varint(n)];
const f32 = (field: number, v: number) => {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setFloat32(0, v, true);
  return [...tag(field, 5), ...b];
};

const header = (ts?: number) => len(1, [...str(1, '2.0'), ...(ts ? num(3, ts) : [])]);
const entity = (id: string, vehicle: number[], extra: number[] = []) => len(2, [...str(1, id), ...extra, ...len(4, vehicle)]);
const position = (lat: number, lng: number, more: number[] = []) => len(2, [...f32(1, lat), ...f32(2, lng), ...more]);

describe('decodeVehiclePositions', () => {
  it('reads position, trip, vehicle descriptor and timestamps', () => {
    const buf = new Uint8Array([
      ...header(1_760_000_000),
      ...entity('e1', [
        ...len(1, [...str(1, 'trip-9'), ...str(5, '34A')]),
        ...position(41.0082, 28.9784, [...f32(3, 90), ...f32(5, 12.5)]),
        ...num(4, 2),
        ...num(5, 1_760_000_050),
        ...len(8, [...str(1, 'bus-7'), ...str(2, '7'), ...str(3, '34 AB 123')]),
      ]),
      ...entity('e2', position(40.99, 29.02)),
    ]);
    const feed = decodeVehiclePositions(buf);
    expect(feed.timestamp).toBe(1_760_000_000);
    expect(feed.vehicles).toHaveLength(2);
    const [a, b] = feed.vehicles;
    expect(a).toMatchObject({ id: 'bus-7', route: '34A', trip: 'trip-9', label: '7', plate: '34 AB 123', status: 2, t: 1_760_000_050, bearing: 90, speed: 12.5 });
    expect(a.lat).toBeCloseTo(41.0082, 4);
    expect(a.lng).toBeCloseTo(28.9784, 4);
    // No vehicle id or timestamp of its own: the entity id and the header's time.
    expect(b).toMatchObject({ id: 'e2', t: 1_760_000_000 });
  });

  it('skips unknown fields, deleted entities and entities without a position', () => {
    const buf = new Uint8Array([
      ...header(),
      ...num(99, 5),
      ...entity('trip-update-only', [], [...len(3, [...str(1, 'x')])]),
      ...entity('gone', position(48.85, 2.35), num(2, 1)),
      ...entity('kept', [...position(48.85, 2.35), ...len(15, [1, 2, 3]), ...num(9, 4)], [...len(6, [7, 7])]),
    ]);
    expect(decodeVehiclePositions(buf).vehicles.map(v => v.id)).toEqual(['kept']);
  });

  it('keeps a vehicle given by stop alone, keyed by its trip, with its trip update arrivals', () => {
    const now = 1_760_000_000;
    const stopTime = (stop: string, arrive: number) => len(2, [...len(2, num(2, arrive)), ...str(4, stop)]);
    const buf = new Uint8Array([
      ...header(now),
      // NYC's subway: the trip update and the stop-only position arrive as separate entities.
      ...len(2, [...str(1, '000001A'), ...len(3, [...len(1, [...str(1, '094800_A..N55R'), ...str(5, 'A')]), ...stopTime('A15N', now - 600), ...stopTime('A12N', now + 90), ...stopTime('A09N', now + 290)])]),
      ...entity('000002A', [...len(1, [...str(1, '094800_A..N55R'), ...str(5, 'A')]), ...num(3, 30), ...num(5, now - 12), ...str(7, 'A12N')]),
      ...entity('000004A', [...len(1, [...str(1, '094900_A..S58R')]), ...num(4, 1), ...str(7, 'H04S')]),
    ]);
    const feed = decodeVehiclePositions(buf);
    expect(feed.vehicles).toEqual([]);
    expect(feed.atStops).toEqual([
      { id: '094800_A..N55R', stopId: 'A12N', status: 2, route: 'A', trip: '094800_A..N55R', t: now - 12 },
      { id: '094900_A..S58R', stopId: 'H04S', status: 1, trip: '094900_A..S58R', t: now },
    ].map(f => expect.objectContaining(f)));
    // The stop it already left is kept apart from the ones ahead.
    expect(feed.trips.get('094800_A..N55R')).toEqual({
      route: 'A',
      left: { stop: 'A15N', arrive: now - 600 },
      next: [{ stop: 'A12N', arrive: now + 90 }, { stop: 'A09N', arrive: now + 290 }],
    });
  });

  it('drops null island and impossible coordinates', () => {
    const buf = new Uint8Array([...header(), ...entity('zero', position(0, 0)), ...entity('far', position(120, 10))]);
    expect(decodeVehiclePositions(buf).vehicles).toEqual([]);
  });

  it('reads timestamps past 2^32', () => {
    const big = 2 ** 33 + 7;
    expect(decodeVehiclePositions(new Uint8Array(header(big))).timestamp).toBe(big);
  });

  it('throws on bodies that are not a feed', () => {
    expect(() => decodeVehiclePositions(new TextEncoder().encode('<html>503</html>'))).toThrow();
    expect(() => decodeVehiclePositions(new Uint8Array([...header(), ...entity('e', position(1, 1))].slice(0, -3)))).toThrow(/truncated/);
    expect(() => decodeVehiclePositions(new Uint8Array([...tag(1, 2), 0, ...tag(3, 4)]))).toThrow(/wire type/);
    expect(() => decodeVehiclePositions(new Uint8Array([]))).toThrow(/header/);
  });
});
