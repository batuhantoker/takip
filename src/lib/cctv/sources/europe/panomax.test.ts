import { afterEach, describe, it, expect, vi } from 'vitest';
import {
  mapPanomaxInstance, liveInstanceIds, fetchPanomaxCameras, type PanomaxInstance, type PanomaxMap,
} from './panomax';

afterEach(() => vi.unstubAllGlobals());

// Trimmed instances from api.panomax.com/1.0/instances/lists/public (2026-10-12).
const grossglockner: PanomaxInstance = {
  id: 7, name: 'Großglockner - KFJ-Höhe', camId: 7, latitude: '47.075826', longitude: '12.750602',
  countryName: 'Austria', city: 'Heiligenblut', webcamUrl: 'https://grossglockner.panomax.com',
  images: [
    { url: 'https://live-image.panomax.com/cams/7/recent_thumb.jpg' },
    { url: 'https://live-image.panomax.com/cams/7/recent_reduced.jpg' },
  ],
  tourCam: false,
};
const gerlos: PanomaxInstance = {
  id: 4058929, name: 'Zillertal Arena - Gerlos Ebenfeldteich', camId: 14273, latitude: '47.244347', longitude: '12.024753',
  countryName: 'Austria', city: 'Gerlos', webcamUrl: 'https://panocam.zillertalarena.com/gerlos-ebenfeldteich',
  images: [
    { url: 'https://live-image.panomax.com/cams/14273/recent_thumb.jpg' },
    { url: 'https://live-image.panomax.com/cams/14273/recent_reduced.jpg' },
  ],
  tourCam: false,
};
// Listed, but not on the map: its last image is from February.
const badersee: PanomaxInstance = {
  id: 474, name: 'Grainau - Hotel am Badersee', camId: 334, latitude: '47.473616', longitude: '11.015458',
  countryName: 'Germany', city: 'Grainau', webcamUrl: 'https://badersee.panomax.com',
  images: [
    { url: 'https://live-image.panomax.com/cams/334/recent_thumb.jpg' },
    { url: 'https://live-image.panomax.com/cams/334/recent_reduced.jpg' },
  ],
  tourCam: false,
};
const msEuropa: PanomaxInstance = {
  id: 1369, name: 'Hapag-Lloyd Cruises – MS EUROPA', camId: 1007, latitude: '35.343056', longitude: '25.145278',
  countryName: null, city: null, webcamUrl: 'https://hlkf.panomax.com/ms-europa',
  images: [
    { url: 'https://live-image.panomax.com/cams/1007/recent_thumb.jpg' },
    { url: 'https://live-image.panomax.com/cams/1007/recent_reduced.jpg' },
  ],
  tourCam: true,
};

// Trimmed from api.panomax.com/1.0/maps/panomaxweb (2026-10-12).
const MAP: PanomaxMap = {
  instances: {
    7: { id: 7 },
    1369: { id: 1369 },
    4058929: { id: 4058929 },
  },
};
const LIVE = liveInstanceIds(MAP);

describe('liveInstanceIds', () => {
  it('collects the instance ids on the map', () => {
    expect([...LIVE]).toEqual([7, 1369, 4058929]);
    expect(liveInstanceIds(null).size).toBe(0);
  });
});

describe('mapPanomaxInstance', () => {
  it('maps a live instance to its newest reduced panorama', () => {
    expect(mapPanomaxInstance(grossglockner, LIVE)).toEqual({
      id: 'panomax-7',
      lat: 47.075826,
      lng: 12.750602,
      name: 'Großglockner - KFJ-Höhe',
      city: 'Heiligenblut',
      country: 'Austria',
      feed_url: 'https://live-image.panomax.com/cams/7/recent_reduced.jpg',
      external_url: 'https://grossglockner.panomax.com',
      source: 'Panomax',
    });
  });

  it('keys the still by camera id, not instance id', () => {
    expect(mapPanomaxInstance(gerlos, LIVE)).toMatchObject({
      id: 'panomax-4058929',
      feed_url: 'https://live-image.panomax.com/cams/14273/recent_reduced.jpg',
    });
  });

  it('drops instances off the map and moving cameras', () => {
    expect(mapPanomaxInstance(badersee, LIVE)).toBeNull();
    expect(mapPanomaxInstance(msEuropa, LIVE)).toBeNull();
  });

  it('drops records without the reduced still or usable coordinates', () => {
    expect(mapPanomaxInstance({ ...grossglockner, images: grossglockner.images!.slice(0, 1) }, LIVE)).toBeNull();
    expect(mapPanomaxInstance({ ...grossglockner, camId: null }, LIVE)).toBeNull();
    expect(mapPanomaxInstance({ ...grossglockner, latitude: null }, LIVE)).toBeNull();
    expect(mapPanomaxInstance({ ...grossglockner, latitude: 'n/a' }, LIVE)).toBeNull();
    expect(mapPanomaxInstance({ ...grossglockner, latitude: '0', longitude: '0' }, LIVE)).toBeNull();
    expect(mapPanomaxInstance({ ...grossglockner, latitude: '-75' }, LIVE)).toBeNull();
  });

  it('omits a non-https page link', () => {
    expect(mapPanomaxInstance({ ...grossglockner, webcamUrl: 'http://grossglockner.panomax.com' }, LIVE))
      .not.toHaveProperty('external_url');
  });
});

describe('fetchPanomaxCameras', () => {
  const respond = (list: unknown, map: unknown) =>
    vi.fn(async (url: string) => new Response(JSON.stringify(url.includes('/maps/') ? map : list), { status: 200 }));

  it('keeps the listed instances that are on the map', async () => {
    vi.stubGlobal('fetch', respond([grossglockner, badersee, msEuropa, gerlos, grossglockner], MAP));
    expect((await fetchPanomaxCameras()).map(c => c.id)).toEqual(['panomax-7', 'panomax-4058929']);
  });

  it('throws on an HTTP error or an unexpected body', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })));
    await expect(fetchPanomaxCameras()).rejects.toThrow(/HTTP 503/);
    vi.stubGlobal('fetch', respond({}, MAP));
    await expect(fetchPanomaxCameras()).rejects.toThrow(/no instance list/);
    vi.stubGlobal('fetch', respond([grossglockner], {}));
    await expect(fetchPanomaxCameras()).rejects.toThrow(/no instances on the map/);
  });
});

// Live integration test — opt in with RUN_LIVE_TESTS=1.
const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

describe('fetchPanomaxCameras (live)', () => {
  liveIt('fetches the cameras on Panomax’s map', async () => {
    const cams = await fetchPanomaxCameras();
    expect(cams.length).toBeGreaterThan(400);
    expect(new Set(cams.map(c => c.id)).size).toBe(cams.length);
    for (const c of cams) expect(c.feed_url).toMatch(/^https:\/\/live-image\.panomax\.com\/cams\/\d+\/recent_reduced\.jpg$/);
  }, 20000);
});
