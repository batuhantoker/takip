import { describe, it, expect } from 'vitest';
import { mapSite, fetchPhenoCamCameras, type PhenoCamSite } from './phenocam';

// Trimmed sites from phenocam.nau.edu/api/cameras/ (2026-10-12).
const harvard: PhenoCamSite = {
  Sitename: 'harvard', Lat: 42.5378, Lon: -72.1715, active: true, date_last: '2026-10-11',
  sitemetadata: { site_description: 'EMS Tower, Harvard Forest, Petersham, Massachusetts' },
};
const neon: PhenoCamSite = {
  Sitename: 'NEON.D01.BART.DP1.00033', Lat: 44.063869, Lon: -71.287375, active: true, date_last: '2026-10-11',
  sitemetadata: { site_description: 'NEON Site - D01 (Northeast) Bartlett Experimental Forest, New Hampshire - top-of-tower camera' },
};
// Flagged active, but nothing uploaded for over a year.
const stale: PhenoCamSite = {
  Sitename: 'aafcottawacfiaf14e', Lat: 45.2921, Lon: -75.7664, active: true, date_last: '2025-08-26',
  sitemetadata: { site_description: 'AAFC Site - Ottawa (On) - CFIA - Field F14 - East Flux Tower' },
};
const testcam: PhenoCamSite = {
  Sitename: 'testcam3', Lat: 35.17961521, Lon: -111.60490323, active: true, date_last: '2026-05-16',
  sitemetadata: { site_description: '' },
};

const NOW = Date.parse('2026-10-12T14:00:00Z');

describe('mapSite', () => {
  it('maps a site to its latest still', () => {
    expect(mapSite(harvard, NOW)).toEqual({
      id: 'phenocam-harvard',
      lat: 42.5378,
      lng: -72.1715,
      name: 'EMS Tower, Harvard Forest, Petersham, Massachusetts',
      city: '',
      country: '',
      feed_url: 'https://phenocam.nau.edu/data/latest/harvard.jpg',
      external_url: 'https://phenocam.nau.edu/webcam/sites/harvard/',
      source: 'PhenoCam Network',
    });
  });

  it('keeps NEON site names with dots verbatim', () => {
    expect(mapSite(neon, NOW)).toMatchObject({
      id: 'phenocam-NEON.D01.BART.DP1.00033',
      feed_url: 'https://phenocam.nau.edu/data/latest/NEON.D01.BART.DP1.00033.jpg',
    });
  });

  it('drops inactive, stale and test sites', () => {
    expect(mapSite({ ...harvard, active: false }, NOW)).toBeNull();
    expect(mapSite(stale, NOW)).toBeNull();
    expect(mapSite({ ...harvard, date_last: null }, NOW)).toBeNull();
    expect(mapSite({ ...testcam, date_last: '2026-10-11' }, NOW)).toBeNull();
    expect(mapSite({ ...harvard, Sitename: 'csutest' }, NOW)).toBeNull();
  });

  it('drops unsafe names and unusable coordinates', () => {
    expect(mapSite({ ...harvard, Sitename: '../harvard' }, NOW)).toBeNull();
    expect(mapSite({ ...harvard, Sitename: 'harvard forest' }, NOW)).toBeNull();
    expect(mapSite({ ...harvard, Sitename: null }, NOW)).toBeNull();
    expect(mapSite({ ...harvard, Lat: null }, NOW)).toBeNull();
    expect(mapSite({ ...harvard, Lat: 0, Lon: 0 }, NOW)).toBeNull();
    expect(mapSite({ ...harvard, Lat: 95 }, NOW)).toBeNull();
  });

  it('falls back to the site name', () => {
    expect(mapSite({ ...harvard, sitemetadata: null }, NOW)?.name).toBe('harvard');
  });
});

// Live integration test — opt in with RUN_LIVE_TESTS=1.
const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

describe('fetchPhenoCamCameras (live)', () => {
  liveIt('fetches the recently uploading sites', async () => {
    const cams = await fetchPhenoCamCameras();
    expect(cams.length).toBeGreaterThan(500);
    expect(new Set(cams.map(c => c.id)).size).toBe(cams.length);
    for (const cam of cams) expect(cam.feed_url).toMatch(/^https:\/\/phenocam\.nau\.edu\/data\/latest\/[\w.-]+\.jpg$/);
  }, 20000);
});
