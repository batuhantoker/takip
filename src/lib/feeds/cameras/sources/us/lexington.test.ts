import { describe, it, expect } from 'vitest';
import { mapLexingtonCamera, fetchLexingtonCameras, LEXINGTON_BOUNDS, type LexingtonFeature } from './lexington';

// Verbatim from the Traffic_Camera_Locations_Public_view layer (outSR=4326).
const feature = {
  attributes: {
    objectid: 1, location: 'Alumni/New Circle',
    still_url: 'https://6855e4345af72.streamlock.net:1935/thumbnail?application=lexington-live&streamname=lex-cam-014.stream&fitmode=stretch&size=600x400',
    created_user: 'gis_lfucg', created_date: 1763447754709, last_edited_user: 'gis_lfucg',
    last_edited_date: 1770146584000, globalid: '60b0bdaa-1939-4806-9ad3-3ac3d38ce908',
  },
  geometry: { x: -84.46457133969764, y: 37.99517367214168 },
} as LexingtonFeature;

// Verbatim too: a private-network address that only works inside the city's network.
const privateNet = {
  attributes: {
    objectid: 136, location: 'Cooper/Sports Center', still_url: 'http://172.19.40.191/aca/index.html#view',
    created_user: 'gis_lfucg', created_date: 1763447754709, last_edited_user: 'gis_lfucg',
    last_edited_date: 1770146584000, globalid: 'f0b6ab39-5866-49cb-ba9c-8a47ac192d16',
  },
  geometry: { x: -84.50180004335785, y: 38.0257002666745 },
} as LexingtonFeature;

const withAttrs = (patch: Record<string, unknown>): LexingtonFeature =>
  ({ ...feature, attributes: { ...feature.attributes, ...patch } });

describe('mapLexingtonCamera', () => {
  it('maps a feature to its still, keyed by stream number', () => {
    expect(mapLexingtonCamera(feature)).toEqual({
      id: 'lexky-014',
      lat: 37.99517367214168,
      lng: -84.46457133969764,
      name: 'Alumni/New Circle',
      city: 'Lexington',
      country: 'US',
      feed_url: 'https://6855e4345af72.streamlock.net:1935/thumbnail?application=lexington-live&streamname=lex-cam-014.stream&fitmode=stretch&size=600x400',
      stream_type: 'jpg',
      source: 'LFUCG Traffic Engineering',
    });
  });

  it('drops private-network and non-https stills', () => {
    expect(mapLexingtonCamera(privateNet)).toBeNull();
    expect(mapLexingtonCamera(withAttrs({
      still_url: 'http://6855e4345af72.streamlock.net:1935/thumbnail?application=lexington-live&streamname=lex-cam-014.stream',
    }))).toBeNull();
    expect(mapLexingtonCamera(withAttrs({ still_url: null }))).toBeNull();
  });

  it('drops stills without a camera stream name', () => {
    expect(mapLexingtonCamera(withAttrs({
      still_url: 'https://6855e4345af72.streamlock.net:1935/thumbnail?application=lexington-live',
    }))).toBeNull();
  });

  it('drops coordinates outside Lexington', () => {
    expect(mapLexingtonCamera({ ...feature, geometry: { x: 0, y: 0 } })).toBeNull();
    expect(mapLexingtonCamera({ ...feature, geometry: null })).toBeNull();
    expect(mapLexingtonCamera(null)).toBeNull();
  });

  it('falls back to a default name', () => {
    expect(mapLexingtonCamera(withAttrs({ location: null }))?.name).toBe('Lexington Camera 014');
  });
});

// Live integration test — opt in with RUN_LIVE_TESTS=1.
const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

describe('fetchLexingtonCameras (live)', () => {
  liveIt('fetches the city cameras', async () => {
    const cams = await fetchLexingtonCameras();
    expect(cams.length).toBeGreaterThan(80);
    expect(new Set(cams.map(c => c.id)).size).toBe(cams.length);
    const b = LEXINGTON_BOUNDS;
    for (const c of cams) {
      expect(c.id).toMatch(/^lexky-\d+$/);
      expect(c.lat > b.minLat && c.lat < b.maxLat && c.lng > b.minLng && c.lng < b.maxLng).toBe(true);
      expect(c.feed_url).toMatch(/^https:\/\//);
    }
  }, 20_000);
});
