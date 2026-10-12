import { describe, it, expect } from 'vitest';
import { mapFeature, fetchWsdotCameras, type WsdotFeature } from './wsdot';

// A representative feature from the TravelInfoCamerasWeather layer (outSR=4326).
const sample: WsdotFeature = {
  attributes: {
    OBJECTID: 1006,
    CameraTitle: 'I-5 at MP 131.8: S 38th St looking South',
    ImageURL: 'https://images.wsdot.wa.gov/orflow/005vc13180.jpg',
  },
  geometry: { x: -122.463284, y: 47.222566 },
};

describe('mapFeature', () => {
  it('maps a feature to a camera', () => {
    expect(mapFeature(sample)).toEqual({
      id: 'wsdot-1006',
      lat: 47.222566,
      lng: -122.463284,
      name: 'I-5 at MP 131.8: S 38th St looking South',
      city: 'Washington',
      country: 'US',
      feed_url: 'https://images.wsdot.wa.gov/orflow/005vc13180.jpg',
      source: 'WSDOT',
    });
  });

  it('leaves TripCheck-hosted cameras to oregon.ts', () => {
    expect(mapFeature({
      ...sample,
      attributes: { ...sample.attributes, ImageURL: 'https://www.tripcheck.com/RoadCams/cams/i5brnbn_pid552.jpg' },
    })).toBeNull();
  });

  it('skips features without an id, image or coordinates', () => {
    expect(mapFeature({ ...sample, attributes: { ...sample.attributes, OBJECTID: undefined } })).toBeNull();
    expect(mapFeature({ ...sample, attributes: { ...sample.attributes, ImageURL: ' ' } })).toBeNull();
    expect(mapFeature({ ...sample, geometry: undefined })).toBeNull();
    expect(mapFeature({})).toBeNull();
  });

  it('falls back to a default name', () => {
    expect(mapFeature({ ...sample, attributes: { ...sample.attributes, CameraTitle: null } })?.name).toBe('WSDOT Camera');
  });
});

// Live integration test — opt in with RUN_LIVE_TESTS=1.
const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

describe('fetchWsdotCameras (live)', () => {
  liveIt('fetches the statewide set', async () => {
    const cams = await fetchWsdotCameras();
    expect(cams.length).toBeGreaterThan(1000);
    expect(new Set(cams.map(c => c.id)).size).toBe(cams.length);
  });
});
