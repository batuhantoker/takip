import { describe, expect, it, vi } from 'vitest';
import { openAppDb } from '../db/app-db';
import { migrateAppSchema } from '../db/migrations';
import { activityBook } from './activity-book';
import { edgeCountry, parseActions, parseDevice } from './map-time-input';

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

describe('shared locations', () => {
  const ANKARA = { latitude: 39.920772, longitude: 32.854110, accuracyM: 40 };
  const rows = (db: ReturnType<typeof fresh>) =>
    db.prepare('SELECT latitude, longitude, accuracy_m AS accuracyM, label, first_seen_at AS firstAt, last_seen_at AS lastAt, fixes FROM device_place ORDER BY first_seen_at').all();

  it('keeps the fix as given, adds nearby ones (about 25 m) to it, and starts a new spot further away', async () => {
    const db = fresh();
    const name = vi.fn(async () => 'Ankara, Ankara, Türkiye');
    const book = activityBook(db, () => null, name);
    book.device({ type: 'visitor', id: 'v1' }, ANKARA, 1000);
    await vi.waitFor(() => expect(rows(db)[0]).toMatchObject({ label: 'Ankara, Ankara, Türkiye' }));
    book.device({ type: 'visitor', id: 'v1' }, { latitude: 39.920900, longitude: 32.854200, accuracyM: 12 }, 2000);
    book.device({ type: 'visitor', id: 'v1' }, { latitude: 39.925, longitude: 32.86, accuracyM: null }, 3000);
    expect(rows(db)).toEqual([
      { latitude: 39.920772, longitude: 32.85411, accuracyM: 12, label: 'Ankara, Ankara, Türkiye', firstAt: 1000, lastAt: 2000, fixes: 2 },
      { latitude: 39.925, longitude: 32.86, accuracyM: null, label: null, firstAt: 3000, lastAt: 3000, fixes: 1 },
    ]);
    // Named once for the first spot (the second fix found its label) and once for the new spot.
    await vi.waitFor(() => expect(name).toHaveBeenCalledTimes(2));
  });

  it('never lets a slow or failing name hold up or break the booking', async () => {
    const db = fresh();
    activityBook(db, () => null, () => Promise.reject(new Error('nominatim down'))).device({ type: 'user', id: 'u1' }, ANKARA, 1000);
    expect(rows(db)).toHaveLength(1);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(rows(db)[0]).toMatchObject({ label: null });
  });

  it('reads fixes from a tick body, refusing nonsense', () => {
    expect(parseDevice({ lat: 39.92077251, lon: 32.8541104, accuracy: 35.6 })).toEqual({ latitude: 39.920773, longitude: 32.85411, accuracyM: 36 });
    expect(parseDevice({ lat: 39.9, lon: 32.8 })).toEqual({ latitude: 39.9, longitude: 32.8, accuracyM: null });
    for (const junk of [null, {}, { lat: '39', lon: 32 }, { lat: 91, lon: 0 }, { lat: 0, lon: 0 }, { lat: 39, lon: 32, accuracy: 60_000 }, { lat: NaN, lon: 1 }]) {
      expect(parseDevice(junk), JSON.stringify(junk)).toBeNull();
    }
  });
});
