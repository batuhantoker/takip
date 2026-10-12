import { describe, it, expect } from 'vitest';
import { BELLINGEN_BOUNDS, fetchBellingenCameras, mapBellingenCamera, type BellingenFeature } from './bellingen';

// Verbatim from the Flood_Camera_Network layer (outSR=4326), 2026-10-12.
const feature: BellingenFeature = {
  attributes: {
    OBJECTID: 3, Site: 'Moodys Bridge', Road_Name: 'Kalang Road', Locaility: 'KALANG',
    Hyperlink: "https://public.disasterwatch-iotp.com.au/prospectpublicimages/999/Moody's%20Bridge%20-%20Overview.jpeg",
    Verified_By: 'LIAMM', Verified_Date: 1768435200000,
  } as BellingenFeature['attributes'],
  geometry: { x: 152.86944549991415, y: -30.46831950975824 },
};
const withAttrs = (patch: Record<string, unknown>): BellingenFeature => ({ ...feature, attributes: { ...feature.attributes, ...patch } });

describe('mapBellingenCamera', () => {
  it('maps a bridge camera to its still, keyed by image folder', () => {
    expect(mapBellingenCamera(feature)).toEqual({
      id: 'bellingen-999',
      lat: -30.46831950975824,
      lng: 152.86944549991415,
      name: 'Moodys Bridge, Kalang Road',
      city: 'Kalang',
      country: 'Australia',
      feed_url: "https://public.disasterwatch-iotp.com.au/prospectpublicimages/999/Moody's%20Bridge%20-%20Overview.jpeg",
      stream_type: 'jpg',
      source: 'Bellingen Shire Council',
    });
  });

  it('drops rows without an https still on the image host, or outside the shire', () => {
    expect(mapBellingenCamera(withAttrs({ Hyperlink: 'http://public.disasterwatch-iotp.com.au/prospectpublicimages/999/x.jpeg' }))).toBeNull();
    expect(mapBellingenCamera(withAttrs({ Hyperlink: 'https://example.com/999/x.jpeg' }))).toBeNull();
    expect(mapBellingenCamera(withAttrs({ Hyperlink: null }))).toBeNull();
    expect(mapBellingenCamera({ ...feature, geometry: { x: 0, y: 0 } })).toBeNull();
  });
});

const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;
liveIt('fetches the shire flood cameras', async () => {
  const cams = await fetchBellingenCameras();
  expect(cams.length).toBeGreaterThanOrEqual(5);
  for (const c of cams) {
    expect(c.id).toMatch(/^bellingen-\d+$/);
    expect(c.lat).toBeGreaterThan(BELLINGEN_BOUNDS.minLat);
  }
});
