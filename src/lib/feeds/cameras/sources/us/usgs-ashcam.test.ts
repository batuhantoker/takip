import { afterEach, describe, it, expect, vi } from 'vitest';
import { mapAshcam, fetchAshcamCameras, ASHCAM_BOUNDS, type AshcamWebcam } from './usgs-ashcam';

afterEach(() => vi.unstubAllGlobals());

// Trimmed rows from volcview.wr.usgs.gov/ashcam-api/webcamApi/webcams (2026-10-12).
const akutan: AshcamWebcam = {
  webcamCode: 'akutan_aksd', webcamName: 'Akutan [AKS, 720 ft]', latitude: 54.11047, longitude: -165.6969,
  faaInd: 'N', hasImages: 'Y', lastImageTimestamp: 1791824400,
  currentImageUrl: 'https://volcview.wr.usgs.gov/ashcam-api/images/webcams/akutan_aksd/current.jpg',
};
const bakerSouth: AshcamWebcam = {
  webcamCode: 'baker-south', webcamName: 'CVO Baker (PAUL, Easton Glacier)', latitude: 46.92756, longitude: -122.07961,
  faaInd: 'N', hasImages: 'Y', lastImageTimestamp: 1791684507,
  currentImageUrl: 'https://volcview.wr.usgs.gov/ashcam-api/images/webcams/baker-south/current.jpeg',
};
const kilaueaF1: AshcamWebcam = {
  webcamCode: 'kilauea-f1-cam', webcamName: 'Kilauea - F1 Cam', latitude: 19.421, longitude: -155.287,
  faaInd: 'N', hasImages: 'Y', lastImageTimestamp: 1791826742,
  currentImageUrl: 'https://volcview.wr.usgs.gov/ashcam-api/images/webcams/kilauea-f1-cam/current.jpg',
};
// An FAA WeatherCams view USGS relays.
const anchorPoint: AshcamWebcam = {
  webcamCode: 'anchorPoint-N', webcamName: 'Anchor Point - N', latitude: 59.75539, longitude: -151.77345,
  faaInd: 'Y', hasImages: 'Y', lastImageTimestamp: 1791827386,
  currentImageUrl: 'https://volcview.wr.usgs.gov/ashcam-api/images/webcams/anchorPoint-N/current.jpg',
};
const chignikLagoon: AshcamWebcam = {
  webcamCode: 'chignikLagoon-SE', webcamName: 'chignikLagoon-SE', latitude: 0, longitude: 0,
  faaInd: 'N', hasImages: 'Y', lastImageTimestamp: 1791827596,
  currentImageUrl: 'https://volcview.wr.usgs.gov/ashcam-api/images/webcams/chignikLagoon-SE/current.jpg',
};
const semisopochnoi: AshcamWebcam = {
  webcamCode: 'semi_cepe', webcamName: 'Semisopochnoi [CEPE, 1113 ft]', latitude: 51.96442, longitude: 179.6474,
  faaInd: 'N', hasImages: 'Y', lastImageTimestamp: 1791825060,
  currentImageUrl: 'https://volcview.wr.usgs.gov/ashcam-api/images/webcams/semi_cepe/current.jpg',
};
const amka: AshcamWebcam = {
  webcamCode: 'AMKA_CAM', webcamName: 'AMKA_CAM', latitude: 0, longitude: 0,
  faaInd: 'N', hasImages: 'N', lastImageTimestamp: 0, currentImageUrl: null,
};
const anchorPointOld: AshcamWebcam = {
  webcamCode: 'Anchor Point-N', webcamName: 'Anchor Point North', latitude: 59.75539, longitude: -151.77345,
  faaInd: 'Y', hasImages: 'N', lastImageTimestamp: 0, currentImageUrl: null,
};

const NOW_S = Date.parse('2026-10-12T18:00:00Z') / 1000;

describe('mapAshcam', () => {
  it('maps a webcam to its current still', () => {
    expect(mapAshcam(akutan, NOW_S)).toEqual({
      id: 'ashcam-akutan_aksd',
      lat: 54.11047,
      lng: -165.6969,
      name: 'Akutan [AKS, 720 ft]',
      city: '',
      country: 'US',
      feed_url: 'https://volcview.wr.usgs.gov/ashcam-api/images/webcams/akutan_aksd/current.jpg',
      stream_type: 'jpg',
      external_url: 'https://volcview.wr.usgs.gov/ashcam-gui/webcam.html?webcam=akutan_aksd',
      source: 'USGS Volcano Hazards Program',
    });
  });

  it('keeps a .jpeg still and Hawaii', () => {
    expect(mapAshcam(bakerSouth, NOW_S)?.feed_url).toBe('https://volcview.wr.usgs.gov/ashcam-api/images/webcams/baker-south/current.jpeg');
    expect(mapAshcam(kilaueaF1, NOW_S)?.id).toBe('ashcam-kilauea-f1-cam');
  });

  it('leaves FAA relays to faa-weathercams.ts', () => {
    expect(mapAshcam(anchorPoint, NOW_S)).toBeNull();
    expect(mapAshcam(anchorPointOld, NOW_S)).toBeNull();
  });

  it('drops never-reporting and stale webcams', () => {
    expect(mapAshcam(amka, NOW_S)).toBeNull();
    expect(mapAshcam(akutan, NOW_S + 8 * 86_400)).toBeNull();
    expect(mapAshcam({ ...akutan, lastImageTimestamp: null }, NOW_S)).toBeNull();
  });

  it('drops (0,0), the far side of the antimeridian and out-of-box points', () => {
    expect(mapAshcam(chignikLagoon, NOW_S)).toBeNull();
    expect(mapAshcam(semisopochnoi, NOW_S)).toBeNull();
    expect(mapAshcam({ ...akutan, latitude: null }, NOW_S)).toBeNull();
  });

  it('drops a still that is not this webcam’s current frame', () => {
    expect(mapAshcam({ ...akutan, currentImageUrl: 'https://volcview.wr.usgs.gov/ashcam-api/images/webcams/baker-south/current.jpg' }, NOW_S)).toBeNull();
    expect(mapAshcam({ ...akutan, currentImageUrl: 'http://volcview.wr.usgs.gov/ashcam-api/images/webcams/akutan_aksd/current.jpg' }, NOW_S)).toBeNull();
    expect(mapAshcam({ ...akutan, webcamCode: 'Akun Island-N' }, NOW_S)).toBeNull();
  });
});

describe('fetchAshcamCameras', () => {
  it('parses the text/html-labelled JSON and keeps the live USGS webcams', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW_S * 1000);
    const body = JSON.stringify({ webcams: [akutan, anchorPoint, amka, kilaueaF1, akutan], meta: { webcamTotal: 5 } });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status: 200, headers: { 'Content-Type': 'text/html; charset=UTF-8' } })));
    try {
      expect((await fetchAshcamCameras()).map(c => c.id)).toEqual(['ashcam-akutan_aksd', 'ashcam-kilauea-f1-cam']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('throws on an HTTP error or a body without webcams', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 502 })));
    await expect(fetchAshcamCameras()).rejects.toThrow(/HTTP 502/);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":"x"}', { status: 200 })));
    await expect(fetchAshcamCameras()).rejects.toThrow(/no webcams/);
  });
});

const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

describe('fetchAshcamCameras (live)', () => {
  liveIt('fetches the reporting USGS webcams', async () => {
    const cams = await fetchAshcamCameras();
    expect(cams.length).toBeGreaterThan(50);
    expect(new Set(cams.map(c => c.id)).size).toBe(cams.length);
    const b = ASHCAM_BOUNDS;
    for (const c of cams) {
      expect(c.lat >= b.minLat && c.lat <= b.maxLat && c.lng >= b.minLng && c.lng <= b.maxLng).toBe(true);
      expect(c.feed_url).toMatch(/^https:\/\/volcview\.wr\.usgs\.gov\/ashcam-api\/images\/webcams\/[\w.-]+\/current\.jpe?g$/);
    }
  }, 20000);
});
