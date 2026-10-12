import { afterEach, describe, it, expect, vi } from 'vitest';
import { lambert72ToWgs84, mapTrafiroutesCamera, fetchTrafiroutesCameras, type TrafiroutesCamera } from './trafiroutes';

afterEach(() => vi.unstubAllGlobals());

// Trimmed from trafiroutes.wallonie.be/trafiroutes/Rest/api/viewer/object/CAMERA (2026-10-12); rows verbatim.
const SAMPLE = `[{"x":null,"y":null,"url":"https://trafiroutes.wallonie.be/images_uploaded/cameras/436.jpg","libelle":"A supprimer doublon","idCamera":436,"libelleLong":"A26 TILFF 2","direction":null},
{"x":138606.602520857,"y":131792.721767361,"url":"https://trafiroutes.wallonie.be/images_uploaded/cameras/313.jpg","libelle":"A15 BOIS D'HAINE (> Lg)","idCamera":313,"libelleLong":"A15 BOIS D'HAINE (> Lg)","direction":null},
{"x":186265.188302109,"y":134311.756964883,"url":"https://trafiroutes.wallonie.be/images_uploaded/cameras/519.jpg","libelle":"A15 DAUSSOULX (> Lg)","idCamera":519,"libelleLong":"A15 DAUSSOULX (> Lg)","direction":null},
{"x":247359.162040681,"y":105224.598085644,"url":"https://trafiroutes.wallonie.be/images_uploaded/cameras/410.jpg","libelle":"A26 Baraque-Fraiture PTZ","idCamera":410,"libelleLong":"A26 Baraque-Fraiture","direction":null},
{"x":null,"y":null,"url":"https://trafiroutes.wallonie.be/images_uploaded/cameras/34.jpg","libelle":"A15 FRANC WARET PTZ","idCamera":34,"libelleLong":"A15 FRANC WARET PTZ","direction":null}]`;

const rows = (): TrafiroutesCamera[] => JSON.parse(SAMPLE);
const byId = (id: number) => rows().find(r => r.idCamera === id)!;

describe('lambert72ToWgs84', () => {
  // References from PROJ 9.8 (pyproj 3.8), EPSG:31370 → EPSG:4326.
  it.each([
    [138606.602520857, 131792.721767361, 50.4968219, 4.2081635],
    [186265.188302109, 134311.756964883, 50.5184526, 4.8801224],
    [247359.162040681, 105224.598085644, 50.2500194, 5.7339296],
  ])('converts (%f, %f)', (x, y, lat, lng) => {
    const p = lambert72ToWgs84(x, y);
    expect(p.lat).toBeCloseTo(lat, 6);
    expect(p.lng).toBeCloseTo(lng, 6);
  });
});

describe('mapTrafiroutesCamera', () => {
  it('maps a camera, projecting Lambert 72 to WGS 84', () => {
    expect(mapTrafiroutesCamera(byId(519))).toEqual({
      id: 'trafiroutes-519',
      lat: 50.518453,
      lng: 4.880122,
      name: 'A15 DAUSSOULX (> Lg)',
      city: '',
      country: 'Belgium',
      feed_url: 'https://trafiroutes.wallonie.be/images_uploaded/cameras/519.jpg',
      external_url: 'https://trafiroutes.wallonie.be/trafiroutes/maptempsreel/',
      source: 'SPW Trafiroutes',
    });
  });

  it('prefers the long label', () => {
    expect(mapTrafiroutesCamera(byId(410))?.name).toBe('A26 Baraque-Fraiture');
    expect(mapTrafiroutesCamera({ ...byId(410), libelleLong: null })?.name).toBe('A26 Baraque-Fraiture PTZ');
  });

  it('drops cameras without a position and duplicates marked for removal', () => {
    expect(mapTrafiroutesCamera(byId(34))).toBeNull();
    expect(mapTrafiroutesCamera({ ...byId(436), x: 138606.602520857, y: 131792.721767361 })).toBeNull();
  });

  it('drops bad ids and positions outside Wallonia', () => {
    expect(mapTrafiroutesCamera({ ...byId(313), idCamera: null })).toBeNull();
    expect(mapTrafiroutesCamera({ ...byId(313), idCamera: 1.5 })).toBeNull();
    expect(mapTrafiroutesCamera({ ...byId(313), x: 0, y: 0 })).toBeNull();
    // Antwerp, in Lambert 72.
    expect(mapTrafiroutesCamera({ ...byId(313), x: 152000, y: 212000 })).toBeNull();
    expect(mapTrafiroutesCamera(null)).toBeNull();
  });
});

describe('fetchTrafiroutesCameras', () => {
  it('fetches, maps and dedupes the list', async () => {
    const body = JSON.stringify([...rows(), byId(313)]);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status: 200 })));
    expect((await fetchTrafiroutesCameras()).map(c => c.id)).toEqual(['trafiroutes-313', 'trafiroutes-519', 'trafiroutes-410']);
  });

  it('throws on an HTTP error or a non-list', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 500 })));
    await expect(fetchTrafiroutesCameras()).rejects.toThrow(/HTTP 500/);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })));
    await expect(fetchTrafiroutesCameras()).rejects.toThrow(/unexpected response/);
  });
});

// Live integration test — opt in with RUN_LIVE_TESTS=1.
const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

describe('fetchTrafiroutesCameras (live)', () => {
  liveIt('fetches the camera list', async () => {
    const cams = await fetchTrafiroutesCameras();
    expect(cams.length).toBeGreaterThan(150);
    expect(new Set(cams.map(c => c.id)).size).toBe(cams.length);
  }, 20000);
});
