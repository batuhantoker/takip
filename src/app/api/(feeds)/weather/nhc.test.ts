import { describe, expect, it } from 'vitest';
import { hurricaneCategory, mapNhcStorm, parseNhcStorms, NHC_URL, type NhcStorm } from './nhc';

// Verbatim from CurrentStorms.json, 2026-10-12 (GIS links trimmed).
const SIMON: NhcStorm = {
  id: 'ep202026',
  binNumber: 'EP5',
  name: 'Simon',
  classification: 'HU',
  intensity: '90',
  pressure: '965',
  latitudeNumeric: 20.2,
  longitudeNumeric: -106.6,
  movementDir: 270,
  movementSpeed: 2,
  lastUpdate: '2026-10-12T18:00:00.000Z',
  publicAdvisory: { url: 'https://www.nhc.noaa.gov/text/MIATCPEP5.shtml' },
  forecastGraphics: { url: 'https://www.nhc.noaa.gov/graphics_ep5.shtml' },
};

describe('mapNhcStorm', () => {
  it('maps an active hurricane to a weather event', () => {
    expect(mapNhcStorm(SIMON)).toEqual({
      id: 'nhc-ep202026',
      title: 'Hurricane Simon, Category 2 — 90 kt, 965 mb, moving W at 2 kt',
      category: 'tropicalCyclone',
      type: 'Hurricane (Category 2)',
      icon: 'cyclone',
      severity: 'high',
      lat: 20.2,
      lng: -106.6,
      date: '2026-10-12T18:00:00.000Z',
      area: 'Eastern Pacific',
      source: 'https://www.nhc.noaa.gov/graphics_ep5.shtml',
      provider: 'NOAA/NHC',
    });
  });

  it('grades storms below hurricane strength', () => {
    expect(mapNhcStorm({ ...SIMON, classification: 'TS', intensity: '50' })?.severity).toBe('medium');
    expect(mapNhcStorm({ ...SIMON, classification: 'TD', intensity: '30' })).toMatchObject({ severity: 'low', type: 'Tropical Depression' });
    expect(mapNhcStorm({ ...SIMON, classification: 'XX' })?.type).toBe('Tropical Cyclone');
  });

  it('falls back to the advisory link and omits unknown fields', () => {
    const e = mapNhcStorm({ ...SIMON, binNumber: 'AT1', forecastGraphics: null, pressure: '', movementDir: undefined });
    expect(e?.source).toBe('https://www.nhc.noaa.gov/text/MIATCPEP5.shtml');
    expect(e?.area).toBe('Atlantic');
    expect(e?.title).toBe('Hurricane Simon, Category 2 — 90 kt');
  });

  it('drops rows without an id or a usable position', () => {
    expect(mapNhcStorm({ ...SIMON, id: undefined })).toBeNull();
    expect(mapNhcStorm({ ...SIMON, latitudeNumeric: undefined })).toBeNull();
    expect(mapNhcStorm({ ...SIMON, longitudeNumeric: 200 })).toBeNull();
    expect(mapNhcStorm(null)).toBeNull();
  });
});

describe('hurricaneCategory', () => {
  it('follows the Saffir-Simpson thresholds in knots', () => {
    expect([64, 83, 96, 113, 137].map(hurricaneCategory)).toEqual([1, 2, 3, 4, 5]);
    expect([82, 95, 112, 136].map(hurricaneCategory)).toEqual([1, 2, 3, 4]);
  });
});

describe('parseNhcStorms', () => {
  it('treats a quiet season as an empty list, not a failure', () => {
    expect(parseNhcStorms({ activeStorms: [] })).toEqual([]);
  });

  it('throws on an unexpected shape', () => {
    expect(() => parseNhcStorms({})).toThrow();
    expect(() => parseNhcStorms(null)).toThrow();
  });
});

const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;
liveIt('reads the live NHC feed', async () => {
  const res = await fetch(NHC_URL, { signal: AbortSignal.timeout(15_000) });
  expect(res.ok).toBe(true);
  const events = parseNhcStorms(await res.json());
  for (const e of events) {
    expect(e.id).toMatch(/^nhc-[a-z]{2}\d{6}$/);
    expect(Math.abs(e.lat)).toBeLessThanOrEqual(90);
  }
});
