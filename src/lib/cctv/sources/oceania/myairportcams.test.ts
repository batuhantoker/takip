import { afterEach, describe, it, expect, vi } from 'vitest';
import { mapMyAirportCamsRow, fetchMyAirportCamsCameras, MYAIRPORTCAMS_BOUNDS } from './myairportcams';

afterEach(() => vi.unstubAllGlobals());

// Trimmed rows from myairportcams.com/data.csv (2026-10-12).
const williamCreek = '4,William Creek - Skycam.net.au,-28.9065223,136.3368453,North,https://view.myairportcams.com/YWMC/showimagecamera1.php,West,https://view.myairportcams.com/YWMC/showimagecamera3.php,South,https://view.myairportcams.com/YWMC/showimagecamera4.php,East,https://view.myairportcams.com/YWMC/showimagecamera5.php,,,,,,,,';
const yarrawonga = '127,Yarrawonga - YYWG,-36.0288845,146.0264224,North East,https://view.myairportcams.com/YYWG/showimagecamera1.php,TBA,https://view.onlyweathercams.com/engine/airports/YYWG/camera1.jpg,TBA,https://view.onlyweathercams.com/engine/airports/YYWG/camera2.jpg,,,,,,,,,,';
const ashburton = '241,NZAS - Ashburton,-43.9017545,171.7961089,Facing North-West,https://view.myairportcams.com/NZSite1/showimagecamera1.php,Facing SSE,https://view.myairportcams.com/NZSite1/showimagecamera2.php,Facing West,https://view.myairportcams.com/NZSite1/showimagecamera3.php,Facing East,https://view.myairportcams.com/NZSite1/showimagecamera4.php,,,,,,,,';
const bige = '291,AYBB - Bige,-5.9488288,141.1307431,Facing North-East,https://view.onlyweathercams.com/engine/airports/Bige/camera2.jpg,Facing South,https://view.onlyweathercams.com/engine/airports/Bige/camera1.jpg,,,,,,,,,,,,';
const frogsHollow = '190,YFGS - Frogs Hollow,-36.7614413,149.8016814,Facing North,http://view.myairportcams.com/YFGS/showimagecamera1.php,Facing South,http://view.myairportcams.com/YFGS/showimagecamera2.php,,,,,,,,,,,,';
const jindabyne = '182,Jindabyne,-36.3364416,148.6518941,Facing South-West,https://view.myairportcams.com/Jindabyne/showimagecamera1.php,Jindabyne Township,https://view.myairportcams.com/Jindabyne/windsock.php,,,,,,,,,,,,';
const carrumDowns = '198,Carrum Downs - Melbourne,-38.0771281,145.1192676,Facing West,https://azer.com.au/weather/image.jpg,,,,,,,,,,,,,,';
const esperance = '30,Esperance Airport,-33.682728,121.8282456,045 deg,https://weathercams.airservicesaustralia.com/wp-content/uploads/airports/009542/009542_045.jpg?v=1595470790,135 deg,https://weathercams.airservicesaustralia.com/wp-content/uploads/airports/009542/009542_135.jpg?v=1595470790,225 deg,https://weathercams.airservicesaustralia.com/wp-content/uploads/airports/009542/009542_225.jpg?v=1595470790,315 deg,https://weathercams.airservicesaustralia.com/wp-content/uploads/airports/009542/009542_315.jpg?v=1595470790,,,,,,,,';

describe('mapMyAirportCamsRow', () => {
  it('maps each still of a site to its own camera', () => {
    const cams = mapMyAirportCamsRow(williamCreek);
    expect(cams.map(c => c.id)).toEqual([
      'myairportcams-mac-YWMC-showimagecamera1',
      'myairportcams-mac-YWMC-showimagecamera3',
      'myairportcams-mac-YWMC-showimagecamera4',
      'myairportcams-mac-YWMC-showimagecamera5',
    ]);
    expect(cams[1]).toEqual({
      id: 'myairportcams-mac-YWMC-showimagecamera3',
      lat: -28.9065223,
      lng: 136.3368453,
      name: 'William Creek - Skycam.net.au — West',
      city: '',
      country: 'Australia',
      feed_url: 'https://view.myairportcams.com/YWMC/showimagecamera3.php',
      external_url: 'https://myairportcams.com/',
      source: 'Aus Web Cams',
    });
  });

  it('keeps onlyweathercams stills and tags them apart', () => {
    expect(mapMyAirportCamsRow(yarrawonga).map(c => c.id)).toEqual([
      'myairportcams-mac-YYWG-showimagecamera1',
      'myairportcams-owc-YYWG-camera1',
      'myairportcams-owc-YYWG-camera2',
    ]);
  });

  it('reads the country from the site code', () => {
    expect(mapMyAirportCamsRow(ashburton)[0].country).toBe('New Zealand');
    expect(mapMyAirportCamsRow(bige)[0].country).toBe('Papua New Guinea');
  });

  it('upgrades its own http stills to https', () => {
    expect(mapMyAirportCamsRow(frogsHollow).map(c => c.feed_url)).toEqual([
      'https://view.myairportcams.com/YFGS/showimagecamera1.php',
      'https://view.myairportcams.com/YFGS/showimagecamera2.php',
    ]);
  });

  it('drops other operators\' stills and non-aviation sites', () => {
    expect(mapMyAirportCamsRow(carrumDowns)).toEqual([]);
    expect(mapMyAirportCamsRow(jindabyne)).toEqual([]);
    expect(mapMyAirportCamsRow(esperance)).toEqual([]);
  });

  it('drops unusable coordinates', () => {
    expect(mapMyAirportCamsRow(williamCreek.replace('-28.9065223,136.3368453', '0,0'))).toEqual([]);
    expect(mapMyAirportCamsRow(williamCreek.replace('-28.9065223,136.3368453', '51.5,-0.12'))).toEqual([]);
    expect(mapMyAirportCamsRow(williamCreek.replace('-28.9065223', 'x'))).toEqual([]);
    expect(mapMyAirportCamsRow('')).toEqual([]);
  });
});

describe('fetchMyAirportCamsCameras', () => {
  it('maps the CRLF list and dedupes stills listed twice', async () => {
    const csv = [williamCreek, carrumDowns, yarrawonga, williamCreek].join('\r\n') + '\r\n';
    vi.stubGlobal('fetch', vi.fn(async () => new Response(csv)));
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const cams = await fetchMyAirportCamsCameras();
    expect(cams).toHaveLength(7);
    expect(new Set(cams.map(c => c.id)).size).toBe(7);
  });

  it('throws on an HTTP error or a body with no cameras', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 500 })));
    await expect(fetchMyAirportCamsCameras()).rejects.toThrow('HTTP 500');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>Server Error</html>')));
    await expect(fetchMyAirportCamsCameras()).rejects.toThrow('unexpected response');
  });
});

// Live integration test — opt in with RUN_LIVE_TESTS=1.
const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

describe('fetchMyAirportCamsCameras (live)', () => {
  liveIt('fetches the Aus Web Cams aviation cameras', async () => {
    const cams = await fetchMyAirportCamsCameras();
    expect(cams.length).toBeGreaterThan(300);
    const b = MYAIRPORTCAMS_BOUNDS;
    for (const c of cams) {
      expect(c.lat >= b.minLat && c.lat <= b.maxLat && c.lng >= b.minLng && c.lng <= b.maxLng).toBe(true);
      expect(c.feed_url).toMatch(/^https:\/\/view\.(myairportcams|onlyweathercams)\.com\//);
    }
  }, 20_000);
});
