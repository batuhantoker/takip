import { afterEach, describe, it, expect, vi } from 'vitest';
import { mapAirservicesAirport, fetchAirservicesCameras, AIRSERVICES_BOUNDS, type AirservicesAirport } from './airservices';

afterEach(() => vi.unstubAllGlobals());

// Trimmed from weathercams.airservicesaustralia.com/ (2026-10-12).
const homepage = `<script id="main-js-extra">
var asa_airports_public_var = {"nonce":"46b37b0886","ajaxurl":"https://weathercams.airservicesaustralia.com/wp-admin/admin-ajax.php","template_dir":"https://weathercams.airservicesaustralia.com/wp-content/themes/asa","marker":"https://weathercams.airservicesaustralia.com/wp-content/themes/asa/img/camera.png"};
//# sourceURL=main-js-extra
</script>`;

// Trimmed airports from admin-ajax.php?action=get_airports_list (2026-10-12).
const albany: AirservicesAirport = {"id": 45, "title": "Albany Airport", "link": "https://weathercams.airservicesaustralia.com/asa-airports/albany-airport/", "thumbnail": "https://weathercams.airservicesaustralia.com/wp-content/uploads/airports/009999/009999_045.jpg?v=1791830736", "state": "WA", "state_full": "Western Australia", "lat": "-34.945143", "long": "117.801381", "img_camera": "https://weathercams.airservicesaustralia.com/wp-content/themes/asa/img/camera.png", "name": "albany-airport"} as AirservicesAirport;
const christmas: AirservicesAirport = {"id": 667, "title": "Christmas Island Aero", "link": "https://weathercams.airservicesaustralia.com/asa-airports/christmas-island-aero/", "thumbnail": "https://weathercams.airservicesaustralia.com/wp-content/uploads/airports/200790/200790_090.jpg?v=1791830736", "state": "CHRISTMAS ISLAND", "state_full": null, "lat": "-10.4509", "long": "105.6888", "img_camera": "https://weathercams.airservicesaustralia.com/wp-content/themes/asa/img/camera.png", "name": "christmas-island-aero"} as AirservicesAirport;
const wattsBridge: AirservicesAirport = {"id": 262, "title": "Watts Bridge Memorial Airfield", "link": "https://weathercams.airservicesaustralia.com/asa-airports/watts-bridge-memorial-airfield/", "thumbnail": "https://weathercams.airservicesaustralia.com/wp-content/uploads/airports/wattsbridge/north.jpg?v=1791830736", "state": "QLD", "state_full": "Queensland", "lat": "-27.0979637", "long": "152.4551914", "img_camera": "https://weathercams.airservicesaustralia.com/wp-content/themes/asa/img/camera.png", "name": "watts-bridge-memorial-airfield"} as AirservicesAirport;
const bunbury: AirservicesAirport = {"id": 398, "title": "Bunbury Airport", "link": "https://weathercams.airservicesaustralia.com/asa-airports/bunbury-airport/", "thumbnail": "https://weathercams.airservicesaustralia.com/wp-content/uploads/2018/02/Camera-Unavailable.png", "state": "WA", "state_full": "Western Australia", "lat": "-33.3743906", "long": "115.6833745", "img_camera": "https://weathercams.airservicesaustralia.com/wp-content/themes/asa/img/camera.png", "name": "bunbury-airport"} as AirservicesAirport;
const yulara: AirservicesAirport = {"id": 654, "title": "Yulara Airport", "link": "https://weathercams.airservicesaustralia.com/?post_type=asa-airports&p=654", "thumbnail": "https://weathercams.airservicesaustralia.com/wp-content/uploads/2018/02/Camera-Unavailable.png", "state": "NT", "state_full": "Northern Territory", "lat": "", "long": "", "img_camera": "https://weathercams.airservicesaustralia.com/wp-content/themes/asa/img/camera.png", "name": "yulara-airport"} as AirservicesAirport;

describe('mapAirservicesAirport', () => {
  it('maps an airport to its listed view, without the cache-buster', () => {
    expect(mapAirservicesAirport(albany)).toEqual({
      id: 'airservices-albany-airport',
      lat: -34.945143,
      lng: 117.801381,
      name: 'Albany Airport',
      city: 'Albany Airport',
      country: 'Australia',
      feed_url: 'https://weathercams.airservicesaustralia.com/wp-content/uploads/airports/009999/009999_045.jpg',
      external_url: 'https://weathercams.airservicesaustralia.com/?airport=albany-airport',
      source: 'Airservices Australia',
    });
  });

  it('keeps the external territories and named stills', () => {
    expect(mapAirservicesAirport(christmas)?.id).toBe('airservices-christmas-island-aero');
    expect(mapAirservicesAirport(wattsBridge)?.feed_url)
      .toBe('https://weathercams.airservicesaustralia.com/wp-content/uploads/airports/wattsbridge/north.jpg');
  });

  it('drops unavailable cameras and airports without coordinates', () => {
    expect(mapAirservicesAirport(bunbury)).toBeNull();
    expect(mapAirservicesAirport(yulara)).toBeNull();
    expect(mapAirservicesAirport({ ...albany, lat: '0', long: '0' })).toBeNull();
    expect(mapAirservicesAirport({ ...albany, lat: '51.47', long: '-0.45' })).toBeNull();
    expect(mapAirservicesAirport(null)).toBeNull();
  });

  it('drops stills off the site and unsafe slugs', () => {
    expect(mapAirservicesAirport({ ...albany, thumbnail: 'http://weathercams.airservicesaustralia.com/wp-content/uploads/airports/009999/009999_045.jpg' })).toBeNull();
    expect(mapAirservicesAirport({ ...albany, thumbnail: 'https://example.com/wp-content/uploads/airports/009999/009999_045.jpg' })).toBeNull();
    expect(mapAirservicesAirport({ ...albany, name: '../albany' })).toBeNull();
  });
});

describe('fetchAirservicesCameras', () => {
  it('reads the nonce, then maps the list', async () => {
    const fetchMock = vi.fn(async (url: string) => url.includes('admin-ajax')
      ? Response.json({ airport_list: [albany, bunbury, albany, yulara, christmas], max_num_pages: 0 })
      : new Response(homepage));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const cams = await fetchAirservicesCameras();
    expect(cams.map(c => c.id)).toEqual(['airservices-albany-airport', 'airservices-christmas-island-aero']);
    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://weathercams.airservicesaustralia.com/wp-admin/admin-ajax.php?action=get_airports_list&filter=all&type=map&filter_type=normal&nonce=46b37b0886',
    );
  });

  it('throws without a nonce, on an HTTP error or an unexpected body', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html></html>')));
    await expect(fetchAirservicesCameras()).rejects.toThrow('no nonce');
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.includes('admin-ajax') ? new Response('-1', { status: 403 }) : new Response(homepage)));
    await expect(fetchAirservicesCameras()).rejects.toThrow('HTTP 403');
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.includes('admin-ajax') ? Response.json(0) : new Response(homepage)));
    await expect(fetchAirservicesCameras()).rejects.toThrow('unexpected response');
  });
});

// Live integration test — opt in with RUN_LIVE_TESTS=1.
const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

describe('fetchAirservicesCameras (live)', () => {
  liveIt('fetches the Airservices weather cameras', async () => {
    const cams = await fetchAirservicesCameras();
    expect(cams.length).toBeGreaterThan(25);
    const b = AIRSERVICES_BOUNDS;
    for (const c of cams) {
      expect(c.lat >= b.minLat && c.lat <= b.maxLat && c.lng >= b.minLng && c.lng <= b.maxLng).toBe(true);
      expect(c.feed_url).toMatch(/^https:\/\/weathercams\.airservicesaustralia\.com\/wp-content\/uploads\/airports\//);
    }
  }, 30_000);
});
