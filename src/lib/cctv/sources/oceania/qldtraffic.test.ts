import { afterEach, describe, it, expect, vi } from 'vitest';
import { mapQldCamera, fetchQldTrafficCameras, QLDTRAFFIC_BOUNDS, type QldFeature } from './qldtraffic';

afterEach(() => vi.unstubAllGlobals());

// Trimmed from data.qldtraffic.qld.gov.au/webcameras.geojson and floodcameras.geojson (2026-10-12).
const archerfield: QldFeature = {
  geometry: { coordinates: [153.0086975, -27.5551796] },
  properties: {
    id: 1, description: 'Archerfield - Ipswich Motorway & Granard Rd - North', locality: 'Archerfield',
    image_url: 'https://cameras.qldtraffic.qld.gov.au/Metropolitan/Archerfield_Ipswich_Mwy_sth.jpg',
  },
};
const mossman: QldFeature = {
  geometry: { coordinates: [145.371718, -16.451611] },
  properties: {
    id: 190, description: 'Mossman - Mossman Daintree Road at Foxton bridge - North', locality: 'Mossman',
    image_url: 'https://cameras.qldtraffic.qld.gov.au/resized/7d90cbc7-264e-4aba-a95a-41f8b1fb676c.jpg',
  },
};

describe('mapQldCamera', () => {
  it('maps a traffic camera', () => {
    expect(mapQldCamera(archerfield, 'web')).toEqual({
      id: 'qld-web-1',
      lat: -27.5551796,
      lng: 153.0086975,
      name: 'Archerfield - Ipswich Motorway & Granard Rd - North',
      city: 'Archerfield',
      country: 'Australia',
      feed_url: 'https://cameras.qldtraffic.qld.gov.au/Metropolitan/Archerfield_Ipswich_Mwy_sth.jpg',
      external_url: 'https://qldtraffic.qld.gov.au/',
      source: 'QLDTraffic',
    });
  });

  it('keeps flood and traffic ids apart', () => {
    expect(mapQldCamera(mossman, 'flood')?.id).toBe('qld-flood-190');
  });

  it('drops stills off the camera host or over http, and unusable rows', () => {
    const props = archerfield.properties!;
    expect(mapQldCamera({ ...archerfield, properties: { ...props, image_url: 'https://evil.example/x.jpg' } }, 'web')).toBeNull();
    expect(mapQldCamera({ ...archerfield, properties: { ...props, image_url: props.image_url!.replace('https:', 'http:') } }, 'web')).toBeNull();
    expect(mapQldCamera({ ...archerfield, properties: { ...props, image_url: null } }, 'web')).toBeNull();
    expect(mapQldCamera({ ...archerfield, properties: { ...props, id: null } }, 'web')).toBeNull();
    expect(mapQldCamera({ ...archerfield, geometry: { coordinates: [0, 0] } }, 'web')).toBeNull();
    expect(mapQldCamera({ ...archerfield, geometry: null }, 'web')).toBeNull();
    expect(QLDTRAFFIC_BOUNDS.minLat).toBeLessThan(-27.5551796);
  });
});

describe('fetchQldTrafficCameras', () => {
  it('reads both lists and survives one failing', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (url.endsWith('/webcameras.geojson')
      ? Response.json({ type: 'FeatureCollection', features: [archerfield, archerfield] })
      : new Response('', { status: 503 }))));
    expect((await fetchQldTrafficCameras()).map(c => c.id)).toEqual(['qld-web-1']);
  });

  it('throws when neither list answers', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })));
    await expect(fetchQldTrafficCameras()).rejects.toThrow(/neither camera list/);
  });
});

const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

describe('fetchQldTrafficCameras (live)', () => {
  liveIt('fetches traffic and flood cameras', async () => {
    const cams = await fetchQldTrafficCameras();
    expect(cams.length).toBeGreaterThan(200);
    expect(cams.some(c => c.id.startsWith('qld-flood-'))).toBe(true);
  }, 20000);
});
