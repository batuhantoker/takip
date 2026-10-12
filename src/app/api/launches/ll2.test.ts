import { describe, expect, it } from 'vitest';
import { LL2_URLS, mapLl2Launch, parseLl2, type Ll2Launch } from './ll2';

// Verbatim from ll.thespacedevs.com/2.2.0/launch/upcoming/?mode=normal, 2026-10-12 (fields we read).
const STARLINK: Ll2Launch = {
  id: '97c6f5e1-299e-4652-b72d-9618ac047076',
  name: 'Falcon 9 Block 5 | Starlink Group 15-25',
  net: '2026-10-13T00:11:44Z',
  window_start: '2026-10-12T23:00:00Z',
  window_end: '2026-10-13T03:00:00Z',
  status: { abbrev: 'Go', name: 'Go for Launch' },
  net_precision: { name: 'Second' },
  launch_service_provider: { name: 'SpaceX' },
  rocket: { configuration: { name: 'Falcon 9', full_name: 'Falcon 9 Block 5' } },
  mission: { name: 'Starlink Group 15-25', type: 'Communications', orbit: { abbrev: 'LEO' } },
  pad: {
    id: 16,
    name: 'Space Launch Complex 4E',
    latitude: '34.632',
    longitude: '-120.611',
    wiki_url: 'https://en.wikipedia.org/wiki/Vandenberg_Space_Launch_Complex_4#SLC-4E',
    location: { name: 'Vandenberg SFB, CA, USA', country_code: 'USA' },
  },
  webcast_live: false,
};

describe('mapLl2Launch', () => {
  it('maps an upcoming launch to its pad', () => {
    expect(mapLl2Launch(STARLINK)).toEqual({
      id: 'll2-97c6f5e1-299e-4652-b72d-9618ac047076',
      name: 'Falcon 9 Block 5 | Starlink Group 15-25',
      net: '2026-10-13T00:11:44Z',
      window_start: '2026-10-12T23:00:00Z',
      window_end: '2026-10-13T03:00:00Z',
      precision: 'Second',
      status: 'Go',
      status_name: 'Go for Launch',
      provider: 'SpaceX',
      rocket: 'Falcon 9 Block 5',
      mission: 'Starlink Group 15-25',
      mission_type: 'Communications',
      orbit: 'LEO',
      pad_id: 'll2-pad-16',
      pad: 'Space Launch Complex 4E',
      location: 'Vandenberg SFB, CA, USA',
      country: 'USA',
      lat: 34.632,
      lng: -120.611,
      webcast_live: false,
      url: 'https://ll.thespacedevs.com/2.2.0/launch/97c6f5e1-299e-4652-b72d-9618ac047076/',
    });
  });

  it('drops launches without a date or a usable pad position', () => {
    expect(mapLl2Launch({ ...STARLINK, net: null })).toBeNull();
    expect(mapLl2Launch({ ...STARLINK, pad: { ...STARLINK.pad, latitude: null } })).toBeNull();
    expect(mapLl2Launch({ ...STARLINK, pad: { ...STARLINK.pad, latitude: '0', longitude: '0' } })).toBeNull();
    expect(mapLl2Launch({ ...STARLINK, pad: null })).toBeNull();
  });
});

describe('parseLl2', () => {
  it('sorts soonest first and throws on an unexpected body', () => {
    const later = { ...STARLINK, id: 'b', net: '2026-11-01T00:00:00Z' };
    expect(parseLl2({ count: 2, results: [later, STARLINK] }).map(l => l.id)).toEqual(['ll2-97c6f5e1-299e-4652-b72d-9618ac047076', 'll2-b']);
    expect(() => parseLl2({ detail: 'Request was throttled.' })).toThrow();
  });
});

const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;
liveIt('reads live upcoming launches', async () => {
  const res = await fetch(LL2_URLS[0], { signal: AbortSignal.timeout(20_000) });
  const launches = parseLl2(await res.json());
  expect(launches.length).toBeGreaterThan(10);
}, 30_000);
