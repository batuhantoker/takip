import { afterEach, describe, it, expect, vi } from 'vitest';
import {
  mapBayernInfoWebcam, flattenGroups, fetchBayernInfoCameras, type BayernInfoGroup, type BayernInfoWebcam,
} from './bayerninfo';

afterEach(() => vi.unstubAllGlobals());

// Trimmed from map.bayerninfo.de/cam/listOfWebcamsV3.json (2026-10-12); records verbatim.
const hof: BayernInfoWebcam = {"id": 1034, "lat": 50.383289, "lon": 11.885435, "url": "bi/jpg/si_--b0002_4280_-1322_dinan_vinan_---------toepen_0.jpg", "route": "B2 Hof - Töpen", "direction": "Töpen"};
const ebe4: BayernInfoWebcam = {"id": 1038, "lat": 48.12153, "lon": 11.79206, "url": "bi/jpg/si_--kebe4_-140_-2220_dinan_vinan_-----hergolding_0.jpg", "route": "EBE4 Feldkirchen - Zorneding", "direction": "Osten"};
const lech: BayernInfoWebcam = {"id": 1303, "lat": 48.381687, "lon": 10.902423, "url": "bi/jpg/bi_--b0002_1590_--225_di-sw_vi-sw_----sb-augsburg_0.jpg", "route": "Augsburg Lechbrücke", "direction": "Nordosten"};
const enns: BayernInfoWebcam = {"id": 10159, "lat": 48.203694, "lon": 14.464405, "url": "asfinag/A001_155,750_0_00003978", "route": "bei Anschlussstelle Enns Ost", "direction": "St. Pölten"};

const TREE: BayernInfoGroup[] = [
  { title_de: 'Strecken', groups: [
    { title_de: 'Bayern (Bundesstraße)', groups: [{ title_de: 'B2', webcams: [hof] }] },
    { title_de: 'Bayern (Staats- und Kreisstraße)', groups: [{ title_de: 'Oberbayern', webcams: [ebe4] }] },
    { title_de: 'Österreich (ASFINAG)', groups: [{ title_de: 'A1 West Autobahn', webcams: [enns] }] },
  ] },
  { title_de: 'Städte', groups: [{ title_de: 'Bayern', groups: [{ title_de: 'Stadt Augsburg', webcams: [lech] }] }] },
];

describe('mapBayernInfoWebcam', () => {
  it('maps a road camera to its still', () => {
    expect(mapBayernInfoWebcam(ebe4, 'Oberbayern')).toEqual({
      id: 'bayerninfo-1038',
      lat: 48.12153,
      lng: 11.79206,
      name: 'EBE4 Feldkirchen - Zorneding → Osten',
      city: 'Oberbayern',
      country: 'Germany',
      feed_url: 'https://map.bayerninfo.de/cam/bi/jpg/si_--kebe4_-140_-2220_dinan_vinan_-----hergolding_0.jpg',
      external_url: 'https://www.bayerninfo.de/de/verkehrskameras?feature=camera/1038',
      source: 'Bayern Info',
    });
  });

  it('names the city or falls back to Bavaria, and skips a direction the route already names', () => {
    expect(mapBayernInfoWebcam(lech, 'Stadt Augsburg')).toMatchObject({ city: 'Augsburg', name: 'Augsburg Lechbrücke → Nordosten' });
    expect(mapBayernInfoWebcam(hof, 'B2')).toMatchObject({ city: 'Bavaria', name: 'B2 Hof - Töpen' });
  });

  it('leaves ASFINAG cameras to ./asfinag', () => {
    expect(mapBayernInfoWebcam(enns, 'A1 West Autobahn')).toBeNull();
  });

  it('drops unsafe paths, bad ids and unusable coordinates', () => {
    expect(mapBayernInfoWebcam({ ...hof, url: 'bi/jpg/../../secret.jpg' })).toBeNull();
    expect(mapBayernInfoWebcam({ ...hof, url: 'https://evil.example/a.jpg' })).toBeNull();
    expect(mapBayernInfoWebcam({ ...hof, id: null })).toBeNull();
    expect(mapBayernInfoWebcam({ ...hof, lat: null })).toBeNull();
    expect(mapBayernInfoWebcam({ ...hof, lat: 0, lon: 0 })).toBeNull();
    expect(mapBayernInfoWebcam({ ...hof, lat: 52.52, lon: 13.4 })).toBeNull();
    expect(mapBayernInfoWebcam(null)).toBeNull();
  });
});

describe('flattenGroups', () => {
  it('walks every level and keeps the listing group title', () => {
    expect(flattenGroups(TREE).map(([cam, group]) => [cam.id, group])).toEqual([
      [1034, 'B2'], [1038, 'Oberbayern'], [10159, 'A1 West Autobahn'], [1303, 'Stadt Augsburg'],
    ]);
  });
});

describe('fetchBayernInfoCameras', () => {
  it('fetches, maps and dedupes the list', async () => {
    const body = JSON.stringify({ groups: [...TREE, { title_de: 'Strecken', groups: [{ title_de: 'B2', webcams: [hof] }] }] });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status: 200 })));
    expect((await fetchBayernInfoCameras()).map(c => c.id)).toEqual(['bayerninfo-1034', 'bayerninfo-1038', 'bayerninfo-1303']);
  });

  it('throws on an HTTP error or an unexpected body', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })));
    await expect(fetchBayernInfoCameras()).rejects.toThrow(/HTTP 503/);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })));
    await expect(fetchBayernInfoCameras()).rejects.toThrow(/no groups/);
  });
});

// Live integration test — opt in with RUN_LIVE_TESTS=1.
const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

describe('fetchBayernInfoCameras (live)', () => {
  liveIt('fetches the Bavarian cameras only', async () => {
    const cams = await fetchBayernInfoCameras();
    expect(cams.length).toBeGreaterThan(300);
    expect(new Set(cams.map(c => c.id)).size).toBe(cams.length);
    for (const c of cams) expect(c.feed_url).toMatch(/^https:\/\/map\.bayerninfo\.de\/cam\/bi\/jpg\//);
  }, 20000);
});
