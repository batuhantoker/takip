import { describe, it, expect } from 'vitest';
import { mapFeature, fetchEstoniaCameras, type TarkTeeFeature } from './estonia';

// A feature from the road_cameras layer (outSR=4326), 2026-10-12. The weather fields are ignored.
const sample: TarkTeeFeature = {
  attributes: {
    objectid: 11, site_name: 'Jõhvi', image_path: '94/94_202610121656.jpg',
    weather_station_id: 56, closest_weather_station: 'Jõhvi', distance: 0.0, air_temp: 9.1, road_temp: 9.4,
    road_status_aggregate: 'COLD_WET_SURFACE', road_status: 'WET', weather_time: 1791813000000, image_time: 1791813401000,
  } as TarkTeeFeature['attributes'],
  geometry: { x: 27.440670000618645, y: 59.36535999924768 },
};

const withAttrs = (patch: Record<string, unknown>): TarkTeeFeature => ({
  ...sample,
  attributes: { ...sample.attributes, ...patch },
});

describe('mapFeature', () => {
  it('maps a feature to a camera keyed on its camera number', () => {
    expect(mapFeature(sample)).toEqual({
      id: 'tarktee-94',
      lat: 59.36535999924768,
      lng: 27.440670000618645,
      name: 'Jõhvi',
      city: 'Estonia',
      country: 'Estonia',
      feed_url: 'https://tarktee.transpordiamet.ee/images/94/94_202610121656.jpg',
      source: 'Transpordiamet',
    });
  });

  it('keeps the id when the frame changes', () => {
    expect(mapFeature(withAttrs({ image_path: '94/94_202610121706.jpg' }))?.id).toBe('tarktee-94');
  });

  it('skips features without a well-formed image path', () => {
    expect(mapFeature(withAttrs({ image_path: null }))).toBeNull();
    expect(mapFeature(withAttrs({ image_path: '94/95_202610121656.jpg' }))).toBeNull();
    expect(mapFeature(withAttrs({ image_path: '../94/94_202610121656.jpg' }))).toBeNull();
    expect(mapFeature({})).toBeNull();
  });

  it('skips missing or out-of-bounds coordinates', () => {
    expect(mapFeature({ ...sample, geometry: undefined })).toBeNull();
    expect(mapFeature({ ...sample, geometry: { x: 0, y: 0 } })).toBeNull();
    // Riga, south of the border.
    expect(mapFeature({ ...sample, geometry: { x: 24.1052, y: 56.9496 } })).toBeNull();
  });

  it('falls back to a default name', () => {
    expect(mapFeature(withAttrs({ site_name: ' ' }))?.name).toBe('Tark Tee Camera 94');
  });
});

// Live integration test — opt in with RUN_LIVE_TESTS=1.
const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

describe('fetchEstoniaCameras (live)', () => {
  liveIt('fetches the national set', async () => {
    const cams = await fetchEstoniaCameras();
    expect(cams.length).toBeGreaterThan(150);
    expect(new Set(cams.map(c => c.id)).size).toBe(cams.length);
    for (const cam of cams) expect(cam.feed_url).toMatch(/^https:\/\/tarktee\.transpordiamet\.ee\/images\/\d+\/\d+_\d{12}\.jpg$/);
  });
});
