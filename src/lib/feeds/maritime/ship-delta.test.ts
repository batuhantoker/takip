import { describe, expect, it } from 'vitest';
import { createShipBook, parseSince, SHIP_STALE_MS, shipsSince } from './ship-delta';

const T = Date.parse('2026-10-19T16:00:00Z');
const ship = (mmsi: number, timestamp: number, lat = 0) => ({ mmsi, timestamp, lat });
const iso = (ms: number) => new Date(ms).toISOString();

describe('parseSince', () => {
  it('accepts a recent time and refuses anything else', () => {
    expect(parseSince(String(T - 10_000), T)).toBe(T - 10_000);
    expect(parseSince(null, T)).toBeNull();
    expect(parseSince('abc', T)).toBeNull();
    expect(parseSince(String(T + 1), T)).toBeNull();
    expect(parseSince(String(T - SHIP_STALE_MS), T)).toBeNull();
  });
});

describe('shipsSince', () => {
  it('keeps only ships heard after the time', () => {
    expect(shipsSince([ship(1, T - 5), ship(2, T), ship(3, T + 5)], T).map(s => s.mmsi)).toEqual([3]);
  });
});

describe('createShipBook', () => {
  it('asks for everything first, then only what changed, and merges it in', () => {
    const book = createShipBook<ReturnType<typeof ship>>();
    expect(book.url()).toBe('/api/maritime');
    book.apply({ ships: [ship(1, T - 1000), ship(2, T - 2000)], timestamp: iso(T) });
    expect(book.url()).toBe(`/api/maritime?since=${T}`);
    const merged = book.apply({ ships: [ship(2, T + 5000, 9), ship(3, T + 6000)], timestamp: iso(T + 10_000), delta: true });
    expect(merged.map(s => [s.mmsi, s.lat])).toEqual([[1, 0], [2, 9], [3, 0]]);
  });

  it('drops ships the server would have dropped', () => {
    const book = createShipBook<ReturnType<typeof ship>>();
    book.apply({ ships: [ship(1, T), ship(2, T - SHIP_STALE_MS + 60_000)], timestamp: iso(T) });
    expect(book.apply({ ships: [], timestamp: iso(T + 120_000), delta: true }).map(s => s.mmsi)).toEqual([1]);
  });

  it('starts over on a full reply, and asks for everything again after one without a time', () => {
    const book = createShipBook<ReturnType<typeof ship>>();
    book.apply({ ships: [ship(1, T)], timestamp: iso(T) });
    expect(book.apply({ ships: [ship(2, T + 1)], timestamp: iso(T + 1) }).map(s => s.mmsi)).toEqual([2]);
    book.apply({ ships: [] });
    expect(book.url()).toBe('/api/maritime');
  });
});
