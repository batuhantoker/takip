import { afterEach, describe, it, expect, vi } from 'vitest';
import { mapFotoWebcam, fetchFotoWebcamCameras, type FotoWebcam } from './foto-webcam';

afterEach(() => vi.unstubAllGlobals());

// Trimmed cams from foto-webcam.eu/webcam/include/metadata.php (2026-10-12).
const bardolino: FotoWebcam = { id: 'bardolino', name: 'Bardolino', title: 'Color Hotel - Bardolino - Lago di Garda', offline: false, hidden: false, partner: false, imgurl: 'https://www.foto-webcam.eu/webcam/bardolino/current/400.jpg', link: 'https://www.foto-webcam.eu/webcam/bardolino/', modtime: 1791829848, country: 'it', latitude: 45.542968, longitude: 10.725714 };
const berlinerhuette: FotoWebcam = { id: 'berlinerhuette', name: 'Berliner Hütte', title: 'Berliner Hütte - Blick nach Südwesten zum Waxeggkees', offline: false, hidden: false, partner: false, imgurl: 'https://www.foto-webcam.eu/webcam/berlinerhuette/current/400.jpg', link: 'https://www.foto-webcam.eu/webcam/berlinerhuette/', modtime: 1791829867, country: '??', latitude: 47.025049, longitude: 11.813689 };
const gnesau: FotoWebcam = { id: 'gnesau', name: 'Gnesau', title: 'Gnesau - Blick nach Südosten', offline: true, hidden: false, partner: false, imgurl: 'https://www.foto-webcam.eu/webcam/gnesau/current/400.jpg', link: 'https://www.foto-webcam.eu/webcam/gnesau/', modtime: 1791816017, country: 'at', latitude: 46.779738, longitude: 14.005642 };
const thermenschuss: FotoWebcam = { id: 'thermenschuss', name: 'BKK - Römerbad', title: 'Bad Kleinkirchheim / Thermal Römerbad', offline: false, hidden: true, partner: false, imgurl: 'https://www.foto-webcam.eu/webcam/thermenschuss/current/400.jpg', link: 'https://www.foto-webcam.eu/webcam/thermenschuss/', modtime: 1791829874, country: 'at', latitude: 46.808375, longitude: 13.799116 };
const attersee: FotoWebcam = { id: 'attersee', name: 'Attersee-Salzkammergut', title: 'terra-hd.com: Attersee-Salzkammergut', offline: false, partner: true, imgurl: 'https://terra-hd.com/attersee/img/current/400.jpg', link: 'https://terra-hd.com/attersee/', modtime: 1791829897, country: 'at', latitude: 47.91355, longitude: 13.59553 };
const zugspitze: FotoWebcam = { id: 'zugspitze', name: 'Zugspitze Gipfel', title: 'Wetterwarte Zugspitze - Blick über den Gipfel nach Osten', offline: false, hidden: false, partner: false, imgurl: 'https://www.foto-webcam.eu/webcam/zugspitze/current/400.jpg', link: 'https://www.foto-webcam.eu/webcam/zugspitze/', modtime: 1791829835, country: 'de', latitude: 47.42083, longitude: 10.98473 };

const NOW_S = Date.parse('2026-10-12T19:00:00Z') / 1000;

describe('mapFotoWebcam', () => {
  it('maps a camera to its current still', () => {
    expect(mapFotoWebcam(bardolino, NOW_S)).toEqual({
      id: 'fotowebcam-bardolino',
      lat: 45.542968,
      lng: 10.725714,
      name: 'Color Hotel - Bardolino - Lago di Garda',
      city: 'Bardolino',
      country: 'Italy',
      feed_url: 'https://www.foto-webcam.eu/webcam/bardolino/current/400.jpg',
      external_url: 'https://www.foto-webcam.eu/webcam/bardolino/',
      source: 'Foto-Webcam.eu',
    });
  });

  it('leaves an unknown country blank', () => {
    expect(mapFotoWebcam(berlinerhuette, NOW_S)).toMatchObject({ id: 'fotowebcam-berlinerhuette', country: '' });
  });

  it('drops offline, unlisted, partner and stale cameras', () => {
    expect(mapFotoWebcam(gnesau, NOW_S)).toBeNull();
    expect(mapFotoWebcam(thermenschuss, NOW_S)).toBeNull();
    expect(mapFotoWebcam(attersee, NOW_S)).toBeNull();
    expect(mapFotoWebcam({ ...bardolino, modtime: NOW_S - 3 * 86_400 }, NOW_S)).toBeNull();
    expect(mapFotoWebcam({ ...bardolino, modtime: null }, NOW_S)).toBeNull();
  });

  it('drops foreign stills, unsafe ids and unusable coordinates', () => {
    expect(mapFotoWebcam({ ...bardolino, imgurl: 'https://terra-hd.com/attersee/img/current/400.jpg' }, NOW_S)).toBeNull();
    expect(mapFotoWebcam({ ...bardolino, id: '../bardolino' }, NOW_S)).toBeNull();
    expect(mapFotoWebcam({ ...bardolino, latitude: null }, NOW_S)).toBeNull();
    expect(mapFotoWebcam({ ...bardolino, latitude: 0, longitude: 0 }, NOW_S)).toBeNull();
    expect(mapFotoWebcam({ ...bardolino, latitude: 74.38248, longitude: -20.78783 }, NOW_S)).toBeNull();
  });
});

describe('fetchFotoWebcamCameras', () => {
  it('fetches, filters and dedupes the list', async () => {
    vi.useFakeTimers({ now: NOW_S * 1000, toFake: ['Date'] });
    const body = JSON.stringify({ cams: [bardolino, gnesau, thermenschuss, attersee, zugspitze, bardolino] });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status: 200 })));
    try {
      expect((await fetchFotoWebcamCameras()).map(c => c.id)).toEqual(['fotowebcam-bardolino', 'fotowebcam-zugspitze']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('throws on an HTTP error or an unexpected body', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })));
    await expect(fetchFotoWebcamCameras()).rejects.toThrow(/HTTP 503/);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })));
    await expect(fetchFotoWebcamCameras()).rejects.toThrow(/no cams/);
  });
});

// Live integration test — opt in with RUN_LIVE_TESTS=1.
const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

describe('fetchFotoWebcamCameras (live)', () => {
  liveIt('fetches the network’s own live cameras', async () => {
    const cams = await fetchFotoWebcamCameras();
    expect(cams.length).toBeGreaterThan(200);
    expect(new Set(cams.map(c => c.id)).size).toBe(cams.length);
    for (const c of cams) expect(c.feed_url).toMatch(/^https:\/\/www\.foto-webcam\.eu\/webcam\/[\w-]+\/current\/\d+\.jpg$/);
  }, 20000);
});
