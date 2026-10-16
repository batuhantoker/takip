import { afterEach, describe, it, expect, vi } from 'vitest';
import { mapOsmWebcam, loadOsmWebcams, type OsmElement } from './osm-webcams';

afterEach(() => vi.unstubAllGlobals());

// Trimmed from overpass-api.de, `nwr["contact:webcam"]; out tags center;` (2026-10-12); elements verbatim, tags trimmed.
const tallinn: OsmElement = {"type": "node", "id": 8244685419, "lat": 59.4223942, "lon": 24.7737102, "tags": {"contact:webcam": "https://ristmikud.tallinn.ee/last/cam050.jpg", "man_made": "surveillance", "surveillance": "public", "surveillance:type": "camera"}};
const brandenburg: OsmElement = {"type": "way", "id": 81105358, "center": {"lat": 52.409041, "lon": 12.5633013}, "tags": {"contact:webcam": "https://stg-brb.de/webcam/home/neumarkt.jpg", "name": "Neustädtischer Markt"}};
const merkur: OsmElement = {"type": "node", "id": 549940487, "lat": 48.7647992, "lon": 8.2798968, "tags": {"contact:webcam": "https://www.youtube.com/watch?v=RqLv2bZFYEM", "man_made": "surveillance", "name": "Merkur-Webcam", "operator": "Stadtwerke Baden-Baden", "surveillance": "webcam", "surveillance:type": "camera"}};
const moscow: OsmElement = {"type": "node", "id": 1560167307, "lat": 55.7720243, "lon": 37.6480776, "tags": {"contact:webcam": "https://rtsp.me/embed/7b49D38G/", "man_made": "surveillance", "surveillance": "outdoor"}};
const wales: OsmElement = {"type": "node", "id": 14156166681, "lat": 51.8069539, "lon": -3.1946658, "tags": {"contact:webcam": "https://members.traffic.wales/cctvimages/a465camera2528.jpg", "man_made": "surveillance", "name": "A465 - Highest Point", "operator": "Traffic Wales", "surveillance": "outdoor", "surveillance:type": "camera"}};
// Each of these must be dropped.
const madrid: OsmElement = {"type": "node", "id": 3273985788, "lat": 40.4077039, "lon": -3.6786925, "tags": {"contact:webcam": "https://informo.madrid.es/cameras/Camara03302.jpg", "man_made": "surveillance", "name": "Mariano de Cavia - M. Pelayo", "operator": "Ayuntamiento de Madrid", "surveillance": "public", "surveillance:type": "camera"}};
const fritz: OsmElement = {"type": "node", "id": 11121976896, "lat": 53.5600812, "lon": 10.125492, "tags": {"contact:webcam": "http://qugmueeupavkxxfq.myfritz.net/auto.jpg?usr=admin&pwd=visitors&/cam_1.jpg", "man_made": "surveillance", "operator": "Miron", "surveillance": "webcam", "surveillance:type": "camera"}};
const rawIp: OsmElement = {"type": "node", "id": 946352815, "lat": 48.1439153, "lon": 13.5199834, "tags": {"contact:webcam": "http://213.174.252.115:4007/view/index.shtml", "name": "Adam", "surveillance": "webcam"}};
const indoor: OsmElement = {"type": "node", "id": 4377358211, "lat": 49.6832749, "lon": 8.6134105, "tags": {"contact:webcam": "http://www.edw.ggew.de/webcam/bad_i.jpg", "man_made": "surveillance", "surveillance": "indoor", "surveillance:type": "camera"}};
const archived: OsmElement = {"type": "node", "id": 10893395555, "lat": 40.946927, "lon": -4.1168644, "tags": {"contact:webcam": "https://web.archive.org/web/20260824113409if_/https://streetcomplete.app/p/366533.jpg", "man_made": "surveillance", "operator": "Policía Local de Segovia;MasOrange;INNOVASUR", "surveillance": "public", "surveillance:type": "camera"}};
const port8080: OsmElement = {"type": "node", "id": 6173810704, "lat": -3.4130386, "lon": 114.8493945, "tags": {"contact:webcam": "https://stream2.banjarkab.go.id:8080/cctv/hls/simpangempatsekumpul.m3u8", "man_made": "surveillance", "name": "POSKO PEMENANGAN HABIB HASYIM ARSAL ALHABSI", "surveillance": "public", "surveillance:type": "camera"}};

const withUrl = (el: OsmElement, url: string): OsmElement => ({ ...el, tags: { ...el.tags, 'contact:webcam': url } });

describe('mapOsmWebcam', () => {
  it('maps a node with a direct still', () => {
    expect(mapOsmWebcam(tallinn)).toEqual({
      id: 'osm-node-8244685419',
      lat: 59.4223942,
      lng: 24.7737102,
      name: 'Webcam',
      city: '',
      country: '',
      feed_url: 'https://ristmikud.tallinn.ee/last/cam050.jpg',
      external_url: 'https://www.openstreetmap.org/node/8244685419',
      source: '© OpenStreetMap contributors',
    });
  });

  it('places a way at its center', () => {
    expect(mapOsmWebcam(brandenburg)).toMatchObject({
      id: 'osm-way-81105358', lat: 52.409041, lng: 12.5633013, name: 'Neustädtischer Markt',
      feed_url: 'https://stg-brb.de/webcam/home/neumarkt.jpg',
    });
  });

  it('embeds YouTube and player pages', () => {
    expect(mapOsmWebcam(merkur)).toMatchObject({
      name: 'Merkur-Webcam', stream_url: 'https://www.youtube.com/embed/RqLv2bZFYEM?autoplay=1&mute=1', stream_type: 'iframe',
    });
    expect(mapOsmWebcam(merkur)?.feed_url).toBeUndefined();
    expect(mapOsmWebcam(moscow)).toMatchObject({ stream_url: 'https://rtsp.me/embed/7b49D38G/', stream_type: 'iframe' });
  });

  it('keeps operators TAKIP has no adapter for', () => {
    expect(mapOsmWebcam(wales)?.id).toBe('osm-node-14156166681');
  });

  it('drops networks another adapter carries', () => {
    expect(mapOsmWebcam(madrid)).toBeNull();
    expect(mapOsmWebcam(withUrl(tallinn, 'https://www.trafficnz.info/camera/images/1.jpg'))).toBeNull();
  });

  it('drops private, credentialed and residential-looking cameras', () => {
    expect(mapOsmWebcam(fritz)).toBeNull();
    expect(mapOsmWebcam(withUrl(fritz, 'https://qugmueeupavkxxfq.myfritz.net/auto.jpg'))).toBeNull();
    expect(mapOsmWebcam(withUrl(tallinn, 'https://cam.example.org/snap.jpg?user=admin&pwd=x'))).toBeNull();
    expect(mapOsmWebcam(withUrl(tallinn, 'https://admin:x@cam.example.org/snap.jpg'))).toBeNull();
    expect(mapOsmWebcam(rawIp)).toBeNull();
    expect(mapOsmWebcam(withUrl(rawIp, 'https://192.168.1.20/snap.jpg'))).toBeNull();
    expect(mapOsmWebcam(withUrl(tallinn, 'https://cam.example.org/axis-cgi/jpg/image.jpg'))).toBeNull();
    expect(mapOsmWebcam(withUrl(tallinn, 'https://cam.example.org:8080/video.jpg'))).toBeNull();
    expect(mapOsmWebcam(withUrl(indoor, 'https://www.edw.ggew.de/webcam/bad_i.jpg'))).toBeNull();
    expect(mapOsmWebcam({ ...tallinn, tags: { ...tallinn.tags, access: 'private' } })).toBeNull();
  });

  it('drops http, archived snapshots, streams and pages that are not embeddable', () => {
    expect(mapOsmWebcam(withUrl(tallinn, 'http://ristmikud.tallinn.ee/last/cam050.jpg'))).toBeNull();
    expect(mapOsmWebcam(archived)).toBeNull();
    expect(mapOsmWebcam(port8080)).toBeNull();
    expect(mapOsmWebcam(withUrl(tallinn, 'https://www.example.org/webcam.html'))).toBeNull();
    expect(mapOsmWebcam(withUrl(tallinn, 'https://www.windy.com/webcams/1.jpg'))).toBeNull();
    expect(mapOsmWebcam(withUrl(tallinn, 'not a url'))).toBeNull();
  });

  it('drops unusable elements', () => {
    expect(mapOsmWebcam({ ...tallinn, lat: null })).toBeNull();
    expect(mapOsmWebcam({ ...tallinn, lat: 0, lon: 0 })).toBeNull();
    expect(mapOsmWebcam({ ...tallinn, type: 'area' })).toBeNull();
    expect(mapOsmWebcam({ ...tallinn, id: null })).toBeNull();
    expect(mapOsmWebcam(null)).toBeNull();
  });
});

describe('loadOsmWebcams', () => {
  it('posts the query with an identifying user agent, then maps and dedupes', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify({ elements: [tallinn, madrid, merkur, tallinn] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    expect((await loadOsmWebcams()).map(c => c.id)).toEqual(['osm-node-8244685419', 'osm-node-549940487']);

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://overpass-api.de/api/interpreter');
    expect((init?.headers as Record<string, string>)['User-Agent']).toMatch(/^TAKIP/);
    expect(new URLSearchParams(String(init?.body)).get('data')).toMatch(/^\[out:json\]\[timeout:55\];\nnwr\["contact:webcam"~"\^https:/);
  });

  it('throws on an HTTP error, a missing list or a timed-out query', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 504 })));
    await expect(loadOsmWebcams()).rejects.toThrow(/HTTP 504/);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })));
    await expect(loadOsmWebcams()).rejects.toThrow(/no elements/);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ elements: [tallinn], remark: 'runtime error: Query timed out in "query" at line 2 after 26 seconds.' }),
      { status: 200 })));
    await expect(loadOsmWebcams()).rejects.toThrow(/timed out/);
  });
});

// Live integration test — opt in with RUN_LIVE_TESTS=1. Heavy on a shared community server; run sparingly.
const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

describe('loadOsmWebcams (live)', () => {
  liveIt('fetches the pre-filtered webcams', async () => {
    const cams = await loadOsmWebcams();
    expect(cams.length).toBeGreaterThan(1000);
    expect(new Set(cams.map(c => c.id)).size).toBe(cams.length);
  }, 70000);
});
