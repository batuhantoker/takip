import { describe, expect, it } from 'vitest';
import { mapSafecastDevice, parseSafecastDevices } from './safecast';

const NOW = Date.parse('2026-10-12T20:00:00Z');

// Shaped from tt.safecast.org/devices, 2026-10-12.
const ZEN = {
  device_urn: 'geigiecast-zen:65002',
  device_class: 'geigiecast-zen',
  when_captured: '2026-10-12T17:34:03Z',
  loc_lat: 34.482657,
  loc_lon: 136.163205,
  lnd_7318u: 31,
};

const AIRNOTE = {
  device_urn: 'note:dev:864475046543061',
  device_sn: 'Barcelona-airnote',
  when_captured: '2026-10-12T09:29:39Z',
  loc_lat: 41.42,
  loc_lon: 2.17,
  pms_pm02_5: 2,
};

describe('mapSafecastDevice', () => {
  it('converts tube CPM to nSv/h and leaves the reading unrated', () => {
    expect(mapSafecastDevice(ZEN, NOW)).toEqual({
      id: 'safecast-geigiecast-zen-65002',
      name: 'Safecast geigiecast-zen:65002',
      city: '',
      country: '',
      lat: 34.482657,
      lng: 136.163205,
      reading: 93,
      time: '2026-10-12T17:34:03.000Z',
      status: 'UNRATED',
      network: 'Safecast',
      source: 'https://safecast.org/',
    });
  });

  it('prefers the beta-shielded 7318 over the bare tube', () => {
    expect(mapSafecastDevice({ ...ZEN, lnd_7318c: 20 }, NOW)?.reading).toBe(60);
    expect(mapSafecastDevice({ ...ZEN, lnd_7318u: undefined, lnd_712u: 12 }, NOW)?.reading).toBe(111);
  });

  it('drops air-quality devices, dead units and garbage clocks', () => {
    expect(mapSafecastDevice(AIRNOTE, NOW)).toBeNull();
    expect(mapSafecastDevice({ ...ZEN, when_captured: '2026-10-10T00:00:00Z' }, NOW)).toBeNull();
    expect(mapSafecastDevice({ ...ZEN, when_captured: '2044-00-00T09:42:35Z' }, NOW)).toBeNull();
    expect(mapSafecastDevice({ ...ZEN, when_captured: '2044-01-01T09:42:35Z' }, NOW)).toBeNull();
    expect(mapSafecastDevice({ ...ZEN, loc_lat: 0, loc_lon: 0 }, NOW)).toBeNull();
    expect(mapSafecastDevice({ ...ZEN, lnd_7318u: 0 }, NOW)).toBeNull();
  });
});

describe('parseSafecastDevices', () => {
  it('keeps the newest message per device', () => {
    const older = { ...ZEN, when_captured: '2026-10-12T10:00:00Z', lnd_7318u: 99 };
    const out = parseSafecastDevices([older, ZEN, AIRNOTE, null], NOW);
    expect(out).toHaveLength(1);
    expect(out[0].reading).toBe(93);
  });

  it('throws on an unexpected body', () => {
    expect(() => parseSafecastDevices({ error: 'down' }, NOW)).toThrow(/shape/);
  });
});
