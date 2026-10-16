import { describe, it, expect } from 'vitest';
import { ACT_PR_BOUNDS, fetchActPrCameras, mapActPrCamera, type ActPrCamera } from './act-pr';

// Verbatim from POST its.act.pr.gov/es/Default.aspx/GetCctv, 2026-10-12.
const row: ActPrCamera = {
  Id: 13, Name: '26-0.7_02 MD-IPV', LocationEn: 'PR-26 Miramar ', LocationEs: 'Miramar PR-26',
  Latitude: 18.456976, Longitude: -66.080456, ImageUrl: '/images/cameras/26-0.7_02_MD-IPV.jpg',
};

describe('mapActPrCamera', () => {
  it('maps a camera to its still', () => {
    expect(mapActPrCamera(row)).toEqual({
      id: 'actpr-13',
      lat: 18.456976,
      lng: -66.080456,
      name: 'Miramar PR-26',
      city: 'Puerto Rico',
      country: 'Puerto Rico',
      feed_url: 'https://its.act.pr.gov/images/cameras/26-0.7_02_MD-IPV.jpg',
      stream_type: 'jpg',
      external_url: 'https://its.act.pr.gov/es/',
      source: 'ACT Puerto Rico',
    });
  });

  it('skips a location that only repeats the device code', () => {
    // Verbatim: id 14 has its code in both location fields.
    const coded = { ...row, Id: 14, Name: '26-0.1_01 MD-IPV', LocationEn: '26-0.1_01 MD-IPV', LocationEs: '26-0.1_01 MD-IPV' };
    expect(mapActPrCamera(coded)?.name).toBe('26-0.1_01 MD-IPV');
  });

  it('drops rows without an id, an image path or a position on the island', () => {
    expect(mapActPrCamera({ ...row, Id: null })).toBeNull();
    expect(mapActPrCamera({ ...row, ImageUrl: 'https://elsewhere.example/x.jpg' })).toBeNull();
    expect(mapActPrCamera({ ...row, Latitude: 0, Longitude: 0 })).toBeNull();
  });
});

const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;
liveIt('fetches the ACT camera list over HTTP/2', async () => {
  const cams = await fetchActPrCameras();
  expect(cams.length).toBeGreaterThan(30);
  for (const c of cams) {
    expect(c.id).toMatch(/^actpr-\d+$/);
    expect(c.lat).toBeGreaterThan(ACT_PR_BOUNDS.minLat);
    expect(c.feed_url).toMatch(/^https:\/\/its\.act\.pr\.gov\/images\/cameras\//);
  }
});
