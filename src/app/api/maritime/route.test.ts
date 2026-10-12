import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, applyAisMessage, clearMaritimeSnapshot, shipCategory, type AisFrame, type Ship as AisShip } from './route';

/* The route aggregates over the websocket-fed ship map on globalThis, so the
   tests drive it directly rather than standing up an AIS stream. */
interface Ship {
  id: number; mmsi: number; lat: number; lng: number;
  speed: number; type: string; name: string; timestamp: number;
}

const ships = () => (globalThis as unknown as { shipsCache: Map<number, Ship> }).shipsCache;

function addShip(mmsi: number, lat: number, lng: number) {
  ships().set(mmsi, {
    id: mmsi, mmsi, lat, lng, speed: 0, type: 'cargo',
    name: `SHIP-${mmsi}`, timestamp: Date.now(),
  });
}

describe('GET /api/maritime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    ships().clear();
    clearMaritimeSnapshot();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('still counts the ships sitting off a port', async () => {
    addShip(1, 1.26, 103.84); // on top of Singapore
    const body = await (await GET()).json();

    const singapore = body.ports.find((p: { name: string }) => p.name === 'Singapore');
    expect(singapore.volume).toContain('LIVE: 1');
    expect(singapore.volume).toContain('WAITING: 1');
    expect(body.total_ships).toBe(1);
  });

  it('serves one snapshot to every caller inside the TTL', async () => {
    addShip(1, 1.26, 103.84);
    const first = await (await GET()).json();

    vi.advanceTimersByTime(4_000);
    addShip(2, 1.27, 103.85);
    const second = await (await GET()).json();

    // The aggregation did not run again — the second caller got the first
    // caller's bytes, which is the whole point under load.
    expect(second).toEqual(first);
    expect(second.total_ships).toBe(1);
  });

  it('rebuilds once the TTL has passed', async () => {
    addShip(1, 1.26, 103.84);
    expect((await (await GET()).json()).total_ships).toBe(1);

    vi.advanceTimersByTime(5_000);
    addShip(2, 1.27, 103.85);
    expect((await (await GET()).json()).total_ships).toBe(2);
  });

  it('lets the browser and any CDN reuse the response', async () => {
    const res = await GET();
    const cc = res.headers.get('cache-control') ?? '';

    expect(cc).toContain('s-maxage=5');
    expect(cc).toContain('max-age=5');
    expect(cc).not.toContain('no-store');
    expect(res.headers.get('content-type')).toContain('application/json');
  });
});

type Report = { Latitude: number; Longitude: number; TrueHeading?: number; Cog?: number };
type Static = { Name?: string; Destination?: string; Type?: number };

/* Shaped like real aisstream.io frames: MetaData carries the MMSI, a padded
   name and the receiver-side position; Message carries the AIS payload. */
const position = (mmsi: number, report: Report, name = 'EVER GIVEN    '): AisFrame => ({
  MessageType: 'PositionReport',
  MetaData: { MMSI: mmsi, ShipName: name, latitude: report.Latitude, longitude: report.Longitude },
  Message: { PositionReport: { Sog: 12.3, Cog: 90, TrueHeading: 88, ...report } },
});

const staticData = (mmsi: number, data: Static, meta: { latitude?: number; longitude?: number } = {}): AisFrame => ({
  MessageType: 'ShipStaticData',
  MetaData: { MMSI: mmsi, ShipName: '', ...meta },
  Message: { ShipStaticData: data },
});

describe('applyAisMessage', () => {
  let cache: Map<number, AisShip>;
  beforeEach(() => { cache = new Map(); });

  it('stores a position report with a trimmed name', () => {
    applyAisMessage(cache, position(1, { Latitude: 30.5, Longitude: 32.3 }), 1000);

    expect(cache.get(1)).toMatchObject({
      mmsi: 1, name: 'EVER GIVEN', lat: 30.5, lng: 32.3, speed: 12.3, heading: 88, timestamp: 1000,
    });
  });

  it('drops the "position not available" sentinel instead of plotting it', () => {
    applyAisMessage(cache, position(1, { Latitude: 91, Longitude: 181 }));
    expect(cache.has(1)).toBe(false);
  });

  it('falls back to course over ground when there is no heading sensor', () => {
    applyAisMessage(cache, position(1, { Latitude: 1, Longitude: 103, TrueHeading: 511, Cog: 245 }));
    expect(cache.get(1)?.heading).toBe(245);
  });

  it('keeps a due-north heading rather than treating 0 as missing', () => {
    applyAisMessage(cache, position(1, { Latitude: 1, Longitude: 103, TrueHeading: 0, Cog: 245 }));
    expect(cache.get(1)?.heading).toBe(0);
  });

  it('keeps a ship on the equator or the prime meridian', () => {
    applyAisMessage(cache, position(1, { Latitude: 0, Longitude: 0 }));
    expect(cache.get(1)).toMatchObject({ lat: 0, lng: 0 });
  });

  it('enriches a known ship with its static data', () => {
    applyAisMessage(cache, position(1, { Latitude: 26, Longitude: 56 }));
    applyAisMessage(cache, staticData(1, { Name: 'FRONT ALTA ', Destination: 'FUJAIRAH  ', Type: 84 }));

    expect(cache.get(1)).toMatchObject({ name: 'FRONT ALTA', destination: 'FUJAIRAH', type: 'tanker', lat: 26 });
  });

  it('places a ship whose static data arrives before any position report', () => {
    applyAisMessage(cache, staticData(1, { Name: 'HMS DUNCAN', Type: 35 }, { latitude: 50.8, longitude: -1.1 }));
    expect(cache.get(1)).toMatchObject({ name: 'HMS DUNCAN', type: 'military', lat: 50.8, lng: -1.1 });
  });

  it('ignores frames without an MMSI', () => {
    applyAisMessage(cache, { MessageType: 'PositionReport', MetaData: {}, Message: {} });
    applyAisMessage(cache, { error: 'Api Key Is Not Valid' });
    expect(cache.size).toBe(0);
  });

  it('evicts the ship that has gone longest without reporting', () => {
    for (let mmsi = 1; mmsi <= 20_000; mmsi++) {
      applyAisMessage(cache, position(mmsi, { Latitude: 1, Longitude: 1 }));
    }
    // Ship 1 reports again, so ship 2 is now the stalest.
    applyAisMessage(cache, position(1, { Latitude: 2, Longitude: 2 }));
    applyAisMessage(cache, position(20_001, { Latitude: 3, Longitude: 3 }));

    expect(cache.size).toBe(20_000);
    expect(cache.has(1)).toBe(true);
    expect(cache.has(2)).toBe(false);
  });
});

describe('shipCategory', () => {
  it.each([
    [70, 'cargo'], [79, 'cargo'], [84, 'tanker'], [60, 'passenger'], [41, 'passenger'],
    [30, 'fishing'], [35, 'military'], [55, 'military'], [52, 'service'],
    [31, 'service'], [51, 'service'], [36, 'leisure'], [37, 'leisure'], [90, 'other'], [0, 'other'],
  ])('AIS type %i is %s', (code, category) => {
    expect(shipCategory(code)).toBe(category);
  });

  it('files a ship with no static report yet under other', () => {
    expect(shipCategory(undefined)).toBe('other');
  });
});
