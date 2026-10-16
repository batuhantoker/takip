import { describe, expect, it, vi } from 'vitest';
import {
  backUpDevice, createImporter, IMPORTED_NAME, markImportOffered, readCurrent, restoreDevice, shouldOfferImport, writeCurrent,
} from './device';
import { readDeviceState } from './stored-parts';
import { MemoryStorage } from './testing';

const AREA = {
  id: 'a1', name: 'Area 1', kind: 'polygon', areaKm2: 12, perimeterKm: 14, color: '#00E5FF', createdAt: 1,
  geojson: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[29, 41], [30, 41], [30, 42], [29, 41]]] } },
};

function device() {
  const storage = new MemoryStorage();
  storage.setItem('takip.layers', JSON.stringify({ maritime: false, flights: true }));
  storage.setItem('takip.aoi.shapes.v1', JSON.stringify([AREA, { id: 'broken' }]));
  storage.setItem('takip.recent-places', JSON.stringify([{ label: 'Odesa', lat: 46.48, lng: 30.72, at: 5 }]));
  storage.setItem('takip.markets.watchlist', JSON.stringify(['BZ=F']));
  return storage;
}

describe('this device', () => {
  it('reads its localStorage keys as a workspace state, dropping malformed entries', () => {
    expect(readDeviceState(device())).toEqual({
      v: 1,
      layers: { maritime: false, flights: true },
      areas: [AREA],
      recentPlaces: [{ label: 'Odesa', lat: 46.48, lng: 30.72, at: 5 }],
      watchlist: ['BZ=F'],
    });
    expect(readDeviceState(new MemoryStorage())).toEqual({ v: 1 });
  });

  it('offers the import once, whatever the answer', () => {
    const storage = device();
    expect(shouldOfferImport(storage)).toBe(true);
    markImportOffered(storage);
    expect(shouldOfferImport(storage)).toBe(false);
    expect(shouldOfferImport(new MemoryStorage())).toBe(false);
  });

  it('imports once, even when asked twice', async () => {
    const storage = device();
    const create = vi.fn(async (name: string) => ({ id: 'w1', name }));
    const importOnce = createImporter(storage, create);

    const first = importOnce();
    expect(importOnce()).toBeNull();
    expect(await first).toEqual({ id: 'w1', name: IMPORTED_NAME });
    expect(importOnce()).toBeNull();
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(IMPORTED_NAME, readDeviceState(storage));
    expect(shouldOfferImport(storage)).toBe(false);
  });

  it('remembers the current workspace per account', () => {
    const storage = new MemoryStorage();
    writeCurrent(storage, 'ada', 'W1');
    expect([readCurrent(storage, 'ada'), readCurrent(storage, 'bo')]).toEqual(['W1', null]);
    writeCurrent(storage, 'ada', null);
    expect(readCurrent(storage, 'ada')).toBeNull();
  });

  it('puts its own keys back after a shared workspace replaced them', () => {
    const storage = device();
    const own = readDeviceState(storage);
    backUpDevice(storage);
    storage.setItem('takip.layers', JSON.stringify({ flights: false }));
    storage.removeItem('takip.aoi.shapes.v1');
    backUpDevice(storage);

    expect(restoreDevice(storage)).toBe(true);
    expect(readDeviceState(storage)).toEqual(own);
    expect(restoreDevice(storage)).toBe(false);
  });
});
