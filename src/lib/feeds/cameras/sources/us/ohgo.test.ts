import { describe, it, expect } from 'vitest';
import { mapOhgoCamera, fetchOhgoCameras, OHGO_BOUNDS, type OhgoSite } from './ohgo';

// Verbatim from api.ohgo.com/cameras.
const site = {
  Id: '00000000000003', Latitude: 40.098986, Longitude: -83.160191,
  Location: 'US-33 at W of Avery Rd, 2134', Category: '', Description: 'US-33 at W of Avery Rd, 2134', Provider: null,
  Cameras: [{
    Direction: 'View',
    SmallURL: 'https://itscameras.dot.state.oh.us:443/images/CMH/2134.jpg',
    LargeURL: 'https://itscameras.dot.state.oh.us:443/images/CMH/2134.jpg',
  }],
} as OhgoSite;

const quad = {
  Id: '00000000000274', Latitude: 39.992434, Longitude: -82.855957,
  Location: 'I-270 at Claycraft/Morrison Rd, 2208', Category: '', Description: 'I-270 at Claycraft/Morrison Rd, 2208',
  Provider: null,
  Cameras: [
    { Direction: 'View', SmallURL: 'https://itscameras.dot.state.oh.us/images/CMH/CCTV2208_Quad.jpg', LargeURL: 'https://itscameras.dot.state.oh.us/images/CMH/CCTV2208_Quad.jpg' },
    { Direction: 'View 2', SmallURL: 'https://itscameras.dot.state.oh.us/images/CMH/CCTV2208_East.jpg', LargeURL: 'https://itscameras.dot.state.oh.us/images/CMH/CCTV2208_East.jpg' },
    { Direction: 'View 3', SmallURL: 'https://itscameras.dot.state.oh.us/images/CMH/CCTV2208_North.jpg', LargeURL: 'https://itscameras.dot.state.oh.us/images/CMH/CCTV2208_North.jpg' },
    { Direction: 'View 4', SmallURL: 'https://itscameras.dot.state.oh.us/images/CMH/CCTV2208_West.jpg', LargeURL: 'https://itscameras.dot.state.oh.us/images/CMH/CCTV2208_West.jpg' },
    { Direction: 'View 5', SmallURL: 'https://itscameras.dot.state.oh.us/images/CMH/CCTV2208_South.jpg', LargeURL: 'https://itscameras.dot.state.oh.us/images/CMH/CCTV2208_South.jpg' },
  ],
} as OhgoSite;

// A KYTC camera on TRIMARC, which kentucky.ts already serves.
const kytc = {
  Id: '422_CCTV09002', Latitude: 38.683252, Longitude: -83.786774,
  Location: 'US 68 MP 18 @ Ohio River Brdg Maysville', Category: '', Description: 'US 68 MP 18 @ Ohio River Brdg Maysville',
  Provider: 'KYTC',
  Cameras: [{
    Direction: 'North',
    SmallURL: 'https://www.trimarc.org/images/milestone/CCTV_09_US68_0180.jpg',
    LargeURL: 'https://www.trimarc.org/images/milestone/CCTV_09_US68_0180.jpg',
  }],
} as OhgoSite;

const withView = (url: string | null): OhgoSite => ({ ...site, Cameras: [{ Direction: 'View', SmallURL: url, LargeURL: url }] });

describe('mapOhgoCamera', () => {
  it('maps a site to its still, without the default port', () => {
    expect(mapOhgoCamera(site)).toEqual({
      id: 'ohgo-3',
      lat: 40.098986,
      lng: -83.160191,
      name: 'US-33 at W of Avery Rd, 2134',
      city: 'Ohio',
      country: 'US',
      feed_url: 'https://itscameras.dot.state.oh.us/images/CMH/2134.jpg',
      stream_type: 'jpg',
      source: 'ODOT OHGO',
    });
  });

  it('uses the first view of a multi-view site', () => {
    const cam = mapOhgoCamera(quad);
    expect(cam?.id).toBe('ohgo-274');
    expect(cam?.feed_url).toBe('https://itscameras.dot.state.oh.us/images/CMH/CCTV2208_Quad.jpg');
  });

  it('leaves TRIMARC-hosted KYTC cameras to kentucky.ts', () => {
    expect(mapOhgoCamera(kytc)).toBeNull();
  });

  it('drops blank, non-https or missing stills', () => {
    expect(mapOhgoCamera(withView('https://itscameras.dot.state.oh.us/images/blank.jpg'))).toBeNull();
    expect(mapOhgoCamera(withView('http://itscameras.dot.state.oh.us/images/CMH/2134.jpg'))).toBeNull();
    expect(mapOhgoCamera(withView(null))).toBeNull();
    expect(mapOhgoCamera({ ...site, Cameras: [] })).toBeNull();
  });

  it('drops rows without an id or with coordinates outside Ohio', () => {
    expect(mapOhgoCamera({ ...site, Id: null })).toBeNull();
    expect(mapOhgoCamera({ ...site, Latitude: 0, Longitude: 0 })).toBeNull();
    expect(mapOhgoCamera({ ...site, Latitude: null })).toBeNull();
    expect(mapOhgoCamera(null)).toBeNull();
  });
});

// Live integration test — opt in with RUN_LIVE_TESTS=1.
const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

describe('fetchOhgoCameras (live)', () => {
  liveIt('fetches the statewide set', async () => {
    const cams = await fetchOhgoCameras();
    expect(cams.length).toBeGreaterThan(900);
    expect(new Set(cams.map(c => c.id)).size).toBe(cams.length);
    const b = OHGO_BOUNDS;
    for (const c of cams) {
      expect(c.id).toMatch(/^ohgo-[\w-]+$/);
      expect(c.lat > b.minLat && c.lat < b.maxLat && c.lng > b.minLng && c.lng < b.maxLng).toBe(true);
      expect(c.feed_url).toMatch(/^https:\/\//);
      expect(c.feed_url).not.toContain('trimarc.org');
    }
  }, 20_000);
});
