import { describe, expect, it, vi } from 'vitest';
import { openAppDb } from '../db/app-db';
import { migrateAppSchema } from '../db/migrations';
import { activityBook } from './activity-book';
import { edgeCountry, parseActions } from './map-time-input';

const fresh = () => {
  const db = openAppDb(':memory:');
  migrateAppSchema(db);
  return db;
};
const BERLIN = { country: 'DE', region: 'Land Berlin', city: 'Berlin', latitude: 52.52, longitude: 13.4 };

describe('places', () => {
  it('places an address once, when first seen for that subject, and counts its minutes after', () => {
    const db = fresh();
    const locate = vi.fn(() => BERLIN);
    const book = activityBook(db, locate);
    book.place({ type: 'visitor', id: 'v1' }, '203.0.113.5', 1000, 1, null);
    book.place({ type: 'visitor', id: 'v1' }, '203.0.113.5', 2000, 1, null);
    book.place({ type: 'visitor', id: 'v1' }, '203.0.113.5', 3000, 0, null);
    expect(locate).toHaveBeenCalledTimes(1);
    expect(db.prepare('SELECT country, city, latitude, first_seen_at AS firstSeenAt, last_seen_at AS lastSeenAt, minutes FROM place_seen').get())
      .toEqual({ country: 'DE', city: 'Berlin', latitude: 52.52, firstSeenAt: 1000, lastSeenAt: 3000, minutes: 2 });
  });

  it("falls back to Cloudflare's country where the database has no answer", () => {
    const db = fresh();
    activityBook(db, () => null).place({ type: 'user', id: 'u1' }, '203.0.113.5', 1000, 1, 'TR');
    expect(db.prepare('SELECT country, city FROM place_seen').get()).toEqual({ country: 'TR', city: null });
  });
});

describe('tick input', () => {
  it("believes CF-IPCountry only from a trusted Cloudflare edge, and not its unknown codes", () => {
    expect(edgeCountry('TR', true)).toBe('TR');
    expect(edgeCountry('TR', false)).toBeNull();
    for (const code of ['XX', 'T1', 'tr', 'TUR', '', undefined]) expect(edgeCountry(code, true), String(code)).toBeNull();
  });

  it('keeps known actions with whole positive counts, capped', () => {
    expect(parseActions({ 'search.run': 3, 'route.plan': 10_000, nope: 1, 'ti.ask': 0, 'alert.open': 2.5 })).toEqual([['search.run', 3], ['route.plan', 500]]);
    for (const junk of [null, 'search.run', ['search.run'], 42]) expect(parseActions(junk)).toEqual([]);
  });
});
