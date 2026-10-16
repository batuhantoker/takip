import { describe, it, expect } from 'vitest';
import { mapCars511xFeature, viewMedia, type Cars511xFeature, type Cars511xSource } from './cars511x';
import { STATE_FEEDS } from './us-511';

const NYSDOT: Cars511xSource = {
  api: 'https://api-511x-nysdot.carsprogram.org', idPrefix: 'nysdot', source: 'NYSDOT', state: 'New York',
  bounds: { minLat: 40.4, maxLat: 45.1, minLng: -79.8, maxLng: -71.7 },
  excludeOwners: ['NYC DOT'],
};

// Verbatim from api-511x-nysdot.carsprogram.org/cameras/map-features.
const camera: Cars511xFeature = {
  geometry: { coordinates: [-73.491488, 40.700365] },
  properties: {
    id: 32768,
    name: 'SSP at NY135 (Crown Castle) - 1',
    public: true,
    cameraOwner: 'NYSDOT',
    views: [{
      type: 'WMP',
      url: 'https://s7.nysdot.skyvdn.com/rtplive/R10_384/playlist.m3u8',
      videoPreviewUrl: 'https://public.carsprogram.org/cameras/NYSDOT/R10_384.flv.png',
      broken: false,
    }],
  },
};

// Verbatim: 511NY also lists NYC DOT's cameras, which ./nyc carries.
const nycDot: Cars511xFeature = {
  geometry: { coordinates: [-73.969353, 40.785302] },
  properties: {
    id: 20930,
    name: 'Central Park West @ 86 St',
    public: true,
    cameraOwner: 'NYC DOT',
    views: [{
      type: 'STILL_IMAGE',
      url: 'https://nyctmc.org/api/cameras/8a6bc417-4877-4ebe-8052-88c1b261baf1/image',
      videoPreviewUrl: 'https://nyctmc.org/api/cameras/8a6bc417-4877-4ebe-8052-88c1b261baf1/image',
      broken: false,
    }],
  },
};

const withProps = (p: Partial<NonNullable<Cars511xFeature['properties']>>): Cars511xFeature =>
  ({ ...camera, properties: { ...camera.properties, ...p } });

describe('mapCars511xFeature', () => {
  it('maps a camera to its HLS stream and preview still', () => {
    expect(mapCars511xFeature(camera, NYSDOT)).toEqual({
      id: 'nysdot-32768',
      lat: 40.700365,
      lng: -73.491488,
      name: 'SSP at NY135 (Crown Castle) - 1',
      city: 'New York',
      country: 'US',
      feed_url: 'https://public.carsprogram.org/cameras/NYSDOT/R10_384.flv.png',
      stream_url: 'https://s7.nysdot.skyvdn.com/rtplive/R10_384/playlist.m3u8',
      stream_type: 'hls',
      source: 'NYSDOT',
    });
  });

  it('drops cameras whose owner another source carries', () => {
    expect(mapCars511xFeature(nycDot, NYSDOT)).toBeNull();
    expect(mapCars511xFeature(nycDot, { ...NYSDOT, excludeOwners: [] })).toMatchObject({
      id: 'nysdot-20930',
      feed_url: 'https://nyctmc.org/api/cameras/8a6bc417-4877-4ebe-8052-88c1b261baf1/image',
      stream_type: 'jpg',
    });
  });

  it('drops coordinates outside the box', () => {
    // Verbatim: rows parked at 0,0 and one with the longitude's sign lost.
    expect(mapCars511xFeature({ ...camera, geometry: { coordinates: [0, 0] } }, NYSDOT)).toBeNull();
    expect(mapCars511xFeature({ ...camera, geometry: { coordinates: [73.221827, 40.812794] } }, NYSDOT)).toBeNull();
    expect(mapCars511xFeature({ ...camera, geometry: null }, NYSDOT)).toBeNull();
  });

  it('drops private cameras, rows with no id, and rows with no usable view', () => {
    expect(mapCars511xFeature(withProps({ public: false }), NYSDOT)).toBeNull();
    expect(mapCars511xFeature(withProps({ id: null }), NYSDOT)).toBeNull();
    expect(mapCars511xFeature(withProps({ views: [] }), NYSDOT)).toBeNull();
    expect(mapCars511xFeature(withProps({ views: [{ ...camera.properties!.views![0], broken: true }] }), NYSDOT)).toBeNull();
  });

  it('uses the first view that has media', () => {
    const cam = mapCars511xFeature(withProps({
      views: [{ type: 'WMP', broken: true, url: 'https://x.example/a.m3u8' }, nycDot.properties!.views![0]],
    }), NYSDOT);
    expect(cam?.feed_url).toBe('https://nyctmc.org/api/cameras/8a6bc417-4877-4ebe-8052-88c1b261baf1/image');
  });

  it('falls back to a generated name', () => {
    expect(mapCars511xFeature(withProps({ name: '  ' }), NYSDOT)?.name).toBe('NYSDOT Camera 32768');
  });
});

describe('viewMedia', () => {
  it('keeps only https playlists and stills', () => {
    expect(viewMedia({ type: 'WMP', url: 'http://s7.example/playlist.m3u8', videoPreviewUrl: 'https://p.example/a.png' }))
      .toEqual({ hls: undefined, feed: 'https://p.example/a.png' });
    expect(viewMedia({ type: 'WMP', url: 'https://s7.example/live.flv' })).toBeNull();
    expect(viewMedia({ type: 'STILL_IMAGE', url: 'http://p.example/a.png' })).toBeNull();
    expect(viewMedia({ type: 'IFRAME', url: 'https://p.example/embed' })).toBeNull();
  });

  it('strips a numeric cache-buster from stills', () => {
    expect(viewMedia({ type: 'STILL_IMAGE', url: 'https://p.example/a.png?1791742944000' })).toEqual({ feed: 'https://p.example/a.png' });
  });
});

const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

liveIt('fetches a large set of well-formed 511NY cameras', async () => {
  const feed = STATE_FEEDS.find(f => f.region === 'newyork')!;
  const cams = await feed.fetch();
  expect(cams.length).toBeGreaterThan(1400);
  expect(new Set(cams.map(c => c.id)).size).toBe(cams.length);
  for (const c of cams) {
    expect(c.id).toMatch(/^nysdot-\d+$/);
    expect(c.source).toBe('NYSDOT');
    expect(c.feed_url ?? c.stream_url).toMatch(/^https:\/\//);
    expect(c.lat).toBeGreaterThan(feed.bounds.minLat);
    expect(c.lat).toBeLessThan(feed.bounds.maxLat);
    expect(c.lng).toBeGreaterThan(feed.bounds.minLng);
    expect(c.lng).toBeLessThan(feed.bounds.maxLng);
  }
});
