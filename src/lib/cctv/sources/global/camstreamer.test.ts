import { afterEach, describe, it, expect, vi } from 'vitest';
import { mapCamStreamerVideo, fetchCamStreamerCameras, CAMSTREAMER_BOUNDS, type CamStreamerVideo } from './camstreamer';

afterEach(() => vi.unstubAllGlobals());

// Trimmed videos from camstreamer.com/live/update-search-map (2026-10-12).
const keyWest: CamStreamerVideo = {"camera": "P5655-E", "cameraLink": "https://www.axis.com/products/axis-p5655-e/", "name": "[LIVE] Key West Butterfly & Nature Conservatory", "iframe_url": "https://camstreamer.com/embed/EJGrqnnD69EYKwJAoUixaQTvQYVpISgBrso3NwhQ", "lat": 24.5475638, "lng": -81.7968249, "detail_link": "/live/stream/918205502-live-key-west-butterfly-nature", "hasCamOverlay": false, "hasCamSwitcher": false, "hasCamScripter": false, "streamerLink": null, "partnerLink": null} as CamStreamerVideo;
const mareIsland: CamStreamerVideo = {"camera": "M5525-E", "cameraLink": "https://www.axis.com/products/axis-m5525-e/", "name": "Copy: Mare Island Osprey Cam", "iframe_url": "https://camstreamer.com/embed/8yB8Pjt1lkKhu5Qer3ROPxqz25h8QGDoaNedsZC1", "lat": -21.5367107, "lng": 167.9510209, "detail_link": "/live/stream/757188010-copy-mare-island-osprey-cam", "hasCamOverlay": false, "hasCamSwitcher": false, "hasCamScripter": false, "streamerLink": null, "partnerLink": null} as CamStreamerVideo;
const ohio: CamStreamerVideo = {"camera": "P1468-LE", "cameraLink": "https://www.axis.com/products/axis-p1468-le", "name": "🔴 LIVE Bird Feeder Cam in Ohio (#dateus) - Cardinals, Goldfinches, Woodpeckers, Blue Jays", "iframe_url": "https://camstreamer.com/embed/5tlcVPQgIrfngJT2Z2ABuvHDiog2eqLVTcfgtGyG", "lat": 41.081199, "lng": -81.5188377, "detail_link": "/live/stream/896047086-live-bird-feeder-cam-in-ohio-dateus", "hasCamOverlay": true, "hasCamSwitcher": false, "hasCamScripter": false, "streamerLink": null, "partnerLink": null} as CamStreamerVideo;
// Older streams use a two-part embed path.
const harstad: CamStreamerVideo = {"camera": "P1405-E", "cameraLink": "https://www.axis.com/products/axis-p1405-e/", "name": "Harstad port, Norway", "iframe_url": "https://camstreamer.com/embed/bf1bef18e5dbf16/S-30686", "lat": 68.80344508046595, "lng": 16.548510709539794, "detail_link": "/live/stream/10166-harstad-port-norway", "hasCamOverlay": false, "hasCamSwitcher": false, "hasCamScripter": false, "streamerLink": "", "partnerLink": ""} as CamStreamerVideo;
const brtTest: CamStreamerVideo = {"camera": "P1455-LE", "cameraLink": "https://www.axis.com/products/axis-p1455-le", "name": "BRT Test", "iframe_url": "https://camstreamer.com/embed/9xwPmMti3myB0Ewxqi8L4F01tdPbuMDGxLpPOlzY", "lat": 68.8521981, "lng": 16.4877315, "detail_link": "/live/stream/651092979-brt-test", "hasCamOverlay": false, "hasCamSwitcher": false, "hasCamScripter": false, "streamerLink": null, "partnerLink": null} as CamStreamerVideo;
const backyard: CamStreamerVideo = {"camera": "P1448-LE", "cameraLink": "https://www.axis.com/products/axis-p1448-le/", "name": "Pennsylvania Backyard Birdfeeder (cardinals, nuthatches, woodpeckers, and cheeky squirrels)", "iframe_url": "https://camstreamer.com/embed/d3348754bb25d8f/S-55463", "lat": 41.2033216, "lng": -77.1945247, "detail_link": "/live/stream/21739-pennsylvania-backyard-birdfeeder", "hasCamOverlay": false, "hasCamSwitcher": false, "hasCamScripter": false, "streamerLink": "", "partnerLink": null} as CamStreamerVideo;
// From the same endpoint with ?country[0]=Sweden: sweden.ts carries it.
const norrby: CamStreamerVideo = {"camera": "P3275-LVE", "cameraLink": "https://www.axis.com/products/axis-p3275-lve", "name": "Norrbyströmmen Live Fly Fishing in Home Pool", "iframe_url": "https://camstreamer.com/embed/jDdxPrkdNJg6ua3lPTI85LqHPO1dRtzn0CtKNpY7", "lat": 58.5545052, "lng": 15.3136348, "detail_link": "/live/stream/901061951-norrbystroemmen-live-fly-fishing-in-home", "hasCamOverlay": false, "hasCamSwitcher": false, "hasCamScripter": false, "streamerLink": null, "partnerLink": null} as CamStreamerVideo;

describe('mapCamStreamerVideo', () => {
  it('maps a video to CamStreamer\'s embed', () => {
    expect(mapCamStreamerVideo(keyWest)).toEqual({
      id: 'camstreamer-918205502',
      lat: 24.5475638,
      lng: -81.7968249,
      name: 'Key West Butterfly & Nature Conservatory',
      city: '',
      country: '',
      stream_url: 'https://camstreamer.com/embed/EJGrqnnD69EYKwJAoUixaQTvQYVpISgBrso3NwhQ',
      stream_type: 'iframe',
      external_url: 'https://camstreamer.com/live/stream/918205502-live-key-west-butterfly-nature',
      source: 'CamStreamer',
    });
  });

  it('accepts the older two-part embed path', () => {
    expect(mapCamStreamerVideo(harstad)).toMatchObject({
      id: 'camstreamer-10166',
      stream_url: 'https://camstreamer.com/embed/bf1bef18e5dbf16/S-30686',
    });
  });

  it('strips live and copy prefixes from names', () => {
    expect(mapCamStreamerVideo(mareIsland)?.name).toBe('Mare Island Osprey Cam');
    expect(mapCamStreamerVideo(ohio)?.name).toBe('LIVE Bird Feeder Cam in Ohio (#dateus) - Cardinals, Goldfinches, Woodpeckers, Blue Jays');
    expect(mapCamStreamerVideo({ ...keyWest, name: '' })?.name).toBe('CamStreamer live camera');
  });

  it('drops test streams and backyard cameras', () => {
    expect(mapCamStreamerVideo(brtTest)).toBeNull();
    expect(mapCamStreamerVideo(backyard)).toBeNull();
    expect(mapCamStreamerVideo(norrby)).not.toBeNull();
  });

  it('drops embeds off camstreamer.com and unexpected detail links', () => {
    expect(mapCamStreamerVideo({ ...keyWest, iframe_url: 'http://camstreamer.com/embed/EJGrqnnD69EYKwJAoUixaQTvQYVpISgBrso3NwhQ' })).toBeNull();
    expect(mapCamStreamerVideo({ ...keyWest, iframe_url: 'https://camstreamer.com.evil.example/embed/EJGrqnnD69EYKwJAoUixaQTvQYVpISgBrso3NwhQ' })).toBeNull();
    expect(mapCamStreamerVideo({ ...keyWest, iframe_url: 'https://www.youtube.com/embed/5sYbre1LNH4' })).toBeNull();
    expect(mapCamStreamerVideo({ ...keyWest, detail_link: 'https://example.com/live/stream/1-x' })).toBeNull();
    expect(mapCamStreamerVideo({ ...keyWest, detail_link: null })).toBeNull();
  });

  it('drops unusable coordinates', () => {
    expect(mapCamStreamerVideo({ ...keyWest, lat: 0, lng: 0 })).toBeNull();
    expect(mapCamStreamerVideo({ ...keyWest, lat: null })).toBeNull();
    expect(mapCamStreamerVideo({ ...keyWest, lat: -75 })).toBeNull();
    expect(mapCamStreamerVideo(null)).toBeNull();
  });
});

describe('fetchCamStreamerCameras', () => {
  const stub = (sweden: () => Response) =>
    vi.stubGlobal('fetch', vi.fn(async (url: string) =>
      url.includes('country') ? sweden() : Response.json({ videos: [keyWest, norrby, harstad, keyWest, brtTest] })));

  it('leaves the Swedish streams to sweden.ts and dedupes', async () => {
    stub(() => Response.json({ videos: [norrby] }));
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const cams = await fetchCamStreamerCameras();
    expect(cams.map(c => c.id)).toEqual(['camstreamer-918205502', 'camstreamer-10166']);
  });

  it('drops the whole Swedish box when the Swedish list fails', async () => {
    stub(() => new Response('', { status: 503 }));
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const cams = await fetchCamStreamerCameras();
    expect(cams.map(c => c.id)).toEqual(['camstreamer-918205502']);
  });

  it('throws on an HTTP error or an unexpected body', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 500 })));
    await expect(fetchCamStreamerCameras()).rejects.toThrow('HTTP 500');
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: 'x' })));
    await expect(fetchCamStreamerCameras()).rejects.toThrow('unexpected response');
  });
});

// Live integration test — opt in with RUN_LIVE_TESTS=1.
const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

describe('fetchCamStreamerCameras (live)', () => {
  liveIt('fetches the CamStreamer streams outside Sweden', async () => {
    const cams = await fetchCamStreamerCameras();
    expect(cams.length).toBeGreaterThan(1000);
    expect(new Set(cams.map(c => c.id)).size).toBe(cams.length);
    const b = CAMSTREAMER_BOUNDS;
    for (const c of cams) {
      expect(c.lat >= b.minLat && c.lat <= b.maxLat && c.lng >= b.minLng && c.lng <= b.maxLng).toBe(true);
      expect(c.stream_url).toMatch(/^https:\/\/camstreamer\.com\/embed\//);
    }
  }, 30_000);
});
