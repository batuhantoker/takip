import { afterEach, describe, it, expect, vi } from 'vitest';
import { mapGoAkamaiCamera, fetchGoAkamaiCameras, GOAKAMAI_BOUNDS, type GoAkamaiCamera } from './goakamai';

afterEach(() => vi.unstubAllGlobals());

// Trimmed rows from a.cameraservice.goakamai.org/cameras/?format=mapPage (2026-10-12).
const alaMoana = {
  id: 'TL-0001', deviceID: 'TL-0001', description: 'Ala Moana and Ala Moana Makai Exit',
  cameraImageURL: 'http://cctv.cdn.goakamai.org/SnapShot/320x240/TL-0001.jpg',
  streamingURL: 'https://cdn3.wowza.com/5/SXBEWXZIK3ZOTG5U/W1CCHNL_A/TL-0001_Ala_Moana_and_Ala_Moana_Makai_Exit.stream/playlist.m3u8',
  snippetURL: '', lastUpdate: '', lat: 21.28962, lon: -157.843628,
} as GoAkamaiCamera;
// No stream: still only.
const beretania = {
  id: 'TL-0191', deviceID: 'TL-0191', description: 'Beretania and Maunakea',
  cameraImageURL: 'http://cctv.cdn.goakamai.org/SnapShot/320x240/TL-0191.jpg',
  streamingURL: '', snippetURL: '', lastUpdate: '', lat: 21.3132839, lon: -157.861221,
} as GoAkamaiCamera;

describe('mapGoAkamaiCamera', () => {
  it('maps a camera to its https still and HLS stream', () => {
    expect(mapGoAkamaiCamera(alaMoana)).toEqual({
      id: 'hdot-TL-0001',
      lat: 21.28962,
      lng: -157.843628,
      name: 'Ala Moana and Ala Moana Makai Exit',
      city: 'Hawaii',
      country: 'US',
      feed_url: 'https://cctv.cdn.goakamai.org/SnapShot/320x240/TL-0001.jpg',
      stream_url: 'https://cdn3.wowza.com/5/SXBEWXZIK3ZOTG5U/W1CCHNL_A/TL-0001_Ala_Moana_and_Ala_Moana_Makai_Exit.stream/playlist.m3u8',
      stream_type: 'hls',
      source: 'GoAkamai',
    });
  });

  it('keeps a camera with no stream on its still', () => {
    const cam = mapGoAkamaiCamera(beretania);
    expect(cam).toMatchObject({ id: 'hdot-TL-0191', stream_type: 'jpg', feed_url: 'https://cctv.cdn.goakamai.org/SnapShot/320x240/TL-0191.jpg' });
    expect(cam?.stream_url).toBeUndefined();
  });

  it('upgrades only its own still host to https', () => {
    expect(mapGoAkamaiCamera({ ...beretania, cameraImageURL: 'http://example.com/TL-0191.jpg' })).toBeNull();
    expect(mapGoAkamaiCamera({ ...alaMoana, cameraImageURL: 'http://example.com/TL-0001.jpg' })?.feed_url).toBeUndefined();
  });

  it('drops rows with no media, a bad id or unusable coordinates', () => {
    expect(mapGoAkamaiCamera({ ...beretania, cameraImageURL: '' })).toBeNull();
    expect(mapGoAkamaiCamera({ ...alaMoana, id: null })).toBeNull();
    expect(mapGoAkamaiCamera({ ...alaMoana, id: '../TL-0001' })).toBeNull();
    expect(mapGoAkamaiCamera({ ...alaMoana, lat: 0, lon: 0 })).toBeNull();
    expect(mapGoAkamaiCamera({ ...alaMoana, lat: null })).toBeNull();
    expect(mapGoAkamaiCamera({ ...alaMoana, lat: 37.77, lon: -122.42 })).toBeNull();
    expect(mapGoAkamaiCamera(null)).toBeNull();
  });

  it('falls back to the id when the description is blank', () => {
    expect(mapGoAkamaiCamera({ ...alaMoana, description: ' ' })?.name).toBe('HDOT Camera TL-0001');
  });
});

describe('fetchGoAkamaiCameras', () => {
  it('sends the headers the service requires and dedupes by id', async () => {
    const fetchMock = vi.fn(async () => Response.json([alaMoana, beretania, alaMoana]));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'log').mockImplementation(() => {});

    const cams = await fetchGoAkamaiCameras();
    expect(cams.map(c => c.id)).toEqual(['hdot-TL-0001', 'hdot-TL-0191']);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://a.cameraservice.goakamai.org/cameras/?format=mapPage');
    const headers = init.headers as Record<string, string>;
    expect(headers.Origin).toBe('https://goakamai.org');
    expect(headers['x-icx-copyright']).toBe('ICxTransportationGroup');
    expect(headers['x-icx-ts']).toMatch(/^\d{13}$/);
  });

  it('throws on an HTTP error or an unexpected body', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('Forbidden', { status: 403 })));
    await expect(fetchGoAkamaiCameras()).rejects.toThrow('HTTP 403');
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: 'x' })));
    await expect(fetchGoAkamaiCameras()).rejects.toThrow('unexpected response');
  });
});

// Live integration test — opt in with RUN_LIVE_TESTS=1.
const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

describe('fetchGoAkamaiCameras (live)', () => {
  liveIt('fetches the Hawaii cameras', async () => {
    const cams = await fetchGoAkamaiCameras();
    expect(cams.length).toBeGreaterThan(250);
    const b = GOAKAMAI_BOUNDS;
    for (const c of cams) {
      expect(c.lat > b.minLat && c.lat < b.maxLat && c.lng > b.minLng && c.lng < b.maxLng).toBe(true);
      expect(c.feed_url ?? c.stream_url).toMatch(/^https:\/\//);
    }
  }, 20_000);
});
