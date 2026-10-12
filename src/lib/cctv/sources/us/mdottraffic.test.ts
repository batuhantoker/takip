import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchMdotTrafficCameras, mapMdotTrafficCamera, MDOTTRAFFIC_BOUNDS, parseSiteViews, siteNumber,
  type MdotTrafficSite,
} from './mdottraffic';

// Verbatim from www.mdottraffic.com/default.aspx/LoadCameraData (`d[0]`).
const site: MdotTrafficSite = {
  __type: 'mdottraffic.mapMarker', markerid: 'camsite_1', tooltip: 'I-55 at Lakeland Dr', lat: 32.33378, lon: -90.16269,
  framehtml: '<iframe class="cameraBubble"  id="ifrmMapBubble" name="ifrmMapBubble" scrolling="auto" frameborder="0"  webkitallowfullscreen="true" mozallowfullscreen="true" allowfullscreen="true" src="mapbubbles/camerasite.aspx?site=1" ></iframe>',
  markergroup: 'map-cameras', icontype: 'cameras', dialogurl: null, zindex: 0,
} as MdotTrafficSite;

// Verbatim from www.mdottraffic.com/mapbubbles/camerasite.aspx?site=1, the camera list only.
const site1Html = `<p id="camViews" class="camera-views">Camera: <a class='button_inbubble selected' title='I-55 N at Lakeland Dr PTZ' href='#' onclick="javascript:switchImage('https://streamingjxn1.mdottraffic.com/thumbnail?application=rtplive&streamname=010406.stream&size=352x240&format=jpg&fitmode=stretch', '010406', 'I-55 N at Lakeland Dr PTZ','', this, false, false,' Save Camera','true');" id='cambutton_010406'>N</a><a class='button_inbubble' title='I-55 S at Lakeland Dr PTZ' href='#' onclick="javascript:switchImage('https://streamingjxn2.mdottraffic.com/thumbnail?application=rtplive&streamname=010501.stream&size=352x240&format=jpg&fitmode=stretch', '010501', 'I-55 S at Lakeland Dr PTZ','', this, false, false,' Save Camera','true');" id='cambutton_010501'>S</a><a class='button_inbubble' title='Lakeland Dr N at I-55 NB Ramp' href='#' onclick="javascript:switchImage('https://streamingjxn2.mdottraffic.com/thumbnail?application=rtplive&streamname=010408.stream&size=352x240&format=jpg&fitmode=stretch', '010408', 'Lakeland Dr N at I-55 NB Ramp','', this, false, false,' Save Camera','true');" id='cambutton_010408'>N</a><a class='button_inbubble' title='Lakeland Dr N at I-55 SB Ramp' href='#' onclick="javascript:switchImage('https://streamingjxn1.mdottraffic.com/thumbnail?application=rtplive&streamname=010407.stream&size=352x240&format=jpg&fitmode=stretch', '010407', 'Lakeland Dr N at I-55 SB Ramp','', this, false, false,' Save Camera','true');" id='cambutton_010407'>N</a><a class='button_inbubble' title='Lakeland Dr S at I-55' href='#' onclick="javascript:switchImage('https://streamingjxn1.mdottraffic.com/thumbnail?application=rtplive&streamname=010307.stream&size=352x240&format=jpg&fitmode=stretch', '010307', 'Lakeland Dr S at I-55','', this, false, false,' Save Camera','true');" id='cambutton_010307'>S</a> </p>`;

// Verbatim from camerasite.aspx?site=74: a district-style stream id.
const site74Html = `<p id="camViews" class="camera-views">Camera: <a class='button_inbubble selected' title='US 49 N at US 90 PTZ' href='#' onclick="javascript:switchImage('https://streaminglym3.mdottraffic.com/thumbnail?application=rtplive&streamname=D6-0042.stream&size=352x240&format=jpg&fitmode=stretch', 'D6-0042', 'US 49 N at US 90 PTZ','', this, false, false,' Save Camera','true');" id='cambutton_D6-0042'>N</a><a class='button_inbubble' title='US 90 E at US 49 PTZ' href='#' onclick="javascript:switchImage('https://streaminglym3.mdottraffic.com/thumbnail?application=rtplive&streamname=050204.stream&size=352x240&format=jpg&fitmode=stretch', '050204', 'US 90 E at US 49 PTZ','', this, false, false,' Save Camera','true');" id='cambutton_050204'>E</a> </p>`;

// Verbatim from camerasite.aspx?site=17: every view offline.
const site17Html = `<p id="camViews" class="camera-views">Camera: <a class='button_inbubble selected' title='US 49 N at Middle St' href='#' onclick="javascript:switchImage('https://www.MDOTtraffic.com/images/novideo.jpg?type=1', '051607', 'US 49 N at Middle St','', this, false, false,' Save Camera','true');" id='cambutton_051607'>N</a><a class='button_inbubble' title='US 49 S at Middle Dr PTZ' href='#' onclick="javascript:switchImage('https://www.MDOTtraffic.com/images/novideo.jpg?type=1', '051608', 'US 49 S at Middle Dr PTZ','', this, false, false,' Save Camera','true');" id='cambutton_051608'>S</a><a class='button_inbubble' title='US 49 S at Middle St' href='#' onclick="javascript:switchImage('https://www.MDOTtraffic.com/images/novideo.jpg?type=1', '051606', 'US 49 S at Middle St','', this, false, false,' Save Camera','true');" id='cambutton_051606'>S</a> </p>`;

const [view] = parseSiteViews(site1Html)!;

describe('parseSiteViews', () => {
  it('reads every view out of the camera list', () => {
    const views = parseSiteViews(site1Html)!;
    expect(views.map(v => v.streamId)).toEqual(['010406', '010501', '010408', '010407', '010307']);
    expect(views[0]).toEqual({
      snapshot: 'https://streamingjxn1.mdottraffic.com/thumbnail?application=rtplive&streamname=010406.stream&size=352x240&format=jpg&fitmode=stretch',
      streamId: '010406',
      title: 'I-55 N at Lakeland Dr PTZ',
    });
    expect(parseSiteViews(site74Html)!.map(v => v.streamId)).toEqual(['D6-0042', '050204']);
  });

  it('unescapes quotes and entities in titles', () => {
    const html = `<p id="camViews">x <a onclick="javascript:switchImage('s', '1', 'O\\'Neal &amp; Main  Rd','', this);">N</a></p>`;
    expect(parseSiteViews(html)![0].title).toBe("O'Neal & Main Rd");
  });

  it('returns an empty list for a list with no views, and null for a page with no list', () => {
    expect(parseSiteViews('<p id="camViews" class="camera-views">Camera:  </p>')).toEqual([]);
    expect(parseSiteViews('<html>Runtime Error</html>')).toBeNull();
    expect(parseSiteViews(null)).toBeNull();
  });
});

describe('siteNumber', () => {
  it('reads n from camsite_n', () => {
    expect(siteNumber(site)).toBe('1');
    expect(siteNumber({ markerid: 'camsite_x' })).toBeNull();
    expect(siteNumber({ markerid: null })).toBeNull();
    expect(siteNumber(null)).toBeNull();
  });
});

describe('mapMdotTrafficCamera', () => {
  it('maps a view to its HLS stream and still on the same Wowza host', () => {
    expect(mapMdotTrafficCamera(site, view)).toEqual({
      id: 'msdot-010406',
      lat: 32.33378,
      lng: -90.16269,
      name: 'I-55 N at Lakeland Dr PTZ',
      city: 'Mississippi',
      country: 'US',
      feed_url: 'https://streamingjxn1.mdottraffic.com/thumbnail?application=rtplive&streamname=010406.stream&size=352x240&format=jpg&fitmode=stretch',
      stream_url: 'https://streamingjxn1.mdottraffic.com/rtplive/010406.stream/playlist.m3u8',
      stream_type: 'hls',
      source: 'MDOTtraffic',
    });
    const d6 = parseSiteViews(site74Html)![0];
    expect(mapMdotTrafficCamera(site, d6)?.stream_url).toBe('https://streaminglym3.mdottraffic.com/rtplive/D6-0042.stream/playlist.m3u8');
  });

  it('drops offline views, which show the novideo image', () => {
    for (const v of parseSiteViews(site17Html)!) expect(mapMdotTrafficCamera(site, v)).toBeNull();
  });

  it("drops a still that is not https, not on a streaming host or another view's", () => {
    expect(mapMdotTrafficCamera(site, { ...view, snapshot: view.snapshot.replace('https:', 'http:') })).toBeNull();
    expect(mapMdotTrafficCamera(site, { ...view, snapshot: view.snapshot.replace('streamingjxn1', 'evil') })).toBeNull();
    expect(mapMdotTrafficCamera(site, { ...view, snapshot: view.snapshot.replace('mdottraffic.com', 'example.com') })).toBeNull();
    expect(mapMdotTrafficCamera(site, { ...view, streamId: '010501' })).toBeNull();
    expect(mapMdotTrafficCamera(site, { ...view, streamId: '01 0406' })).toBeNull();
    expect(mapMdotTrafficCamera(site, { ...view, streamId: '' })).toBeNull();
    expect(mapMdotTrafficCamera(site, null)).toBeNull();
  });

  it('drops coordinates outside Mississippi', () => {
    expect(mapMdotTrafficCamera({ ...site, lat: 0, lon: 0 }, view)).toBeNull();
    expect(mapMdotTrafficCamera({ ...site, lat: null }, view)).toBeNull();
    expect(mapMdotTrafficCamera({ ...site, lon: 90.16269 }, view)).toBeNull();
    expect(mapMdotTrafficCamera({ ...site, lat: 35.15, lon: -90.05 }, view)).toBeNull(); // Memphis
    expect(mapMdotTrafficCamera(null, view)).toBeNull();
  });

  it('falls back to the site name, then the stream id', () => {
    expect(mapMdotTrafficCamera(site, { ...view, title: '' })?.name).toBe('I-55 at Lakeland Dr');
    expect(mapMdotTrafficCamera({ ...site, tooltip: ' ' }, { ...view, title: '' })?.name).toBe('MDOTtraffic Camera 010406');
  });
});

describe('fetchMdotTrafficCameras (mocked network)', () => {
  const LIST = 'https://www.mdottraffic.com/default.aspx/LoadCameraData';
  const sites = Array.from({ length: 20 }, (_, i) => ({ ...site, markerid: `camsite_${i + 1}` }));
  const page = (n: string) => site1Html.replace(/\b0104(06|07|08)\b|\b010501\b|\b010307\b/g, m => `${n}x${m}`);

  /** `fail` maps a site number to how its page fails; `once` fails only the first request. */
  function stub(rows: unknown, fail: Record<string, '500' | 'error' | 'nolist' | 'once' | 'novideo'> = {}) {
    const seen = new Set<string>();
    const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === LIST) return new Response(JSON.stringify({ d: rows }), { headers: { 'Content-Type': 'application/json' } });
      const n = url.match(/^https:\/\/www\.mdottraffic\.com\/mapbubbles\/camerasite\.aspx\?site=(\d+)$/)?.[1];
      if (!n || init?.method) return new Response('', { status: 500 });
      const how = fail[n];
      if (how === 'once' && !seen.has(n)) {
        seen.add(n);
        return new Response('', { status: 503 });
      }
      if (how === '500') return new Response('', { status: 500 });
      if (how === 'error') throw new TypeError('fetch failed');
      if (how === 'nolist') return new Response('<html>Runtime Error</html>');
      if (how === 'novideo') return new Response(site17Html);
      return new Response(page(n));
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  beforeEach(() => { vi.spyOn(console, 'log').mockImplementation(() => {}); });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('POSTs the list as JSON, reads each site once and keeps every live view', async () => {
    const fetchMock = stub([...sites, sites[0]], { 3: 'novideo' });
    const cams = await fetchMdotTrafficCameras();
    expect(cams).toHaveLength(19 * 5);
    expect(new Set(cams.map(c => c.id)).size).toBe(cams.length);
    expect(cams[0].id).toBe('msdot-1x010406');
    expect(cams.some(c => c.id.startsWith('msdot-3x'))).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(21);
    const [, init] = fetchMock.mock.calls[0];
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe('{}');
    expect((init?.headers as Record<string, string>)['Content-Type']).toMatch(/^application\/json/);
  });

  it('retries failed sites once', async () => {
    const fetchMock = stub(sites, { 4: 'once', 9: 'once' });
    expect(await fetchMdotTrafficCameras()).toHaveLength(20 * 5);
    expect(fetchMock).toHaveBeenCalledTimes(1 + 20 + 2);
  });

  it('skips sites outside the box without fetching them', async () => {
    const fetchMock = stub([...sites, { ...site, markerid: 'camsite_99', lat: 0, lon: 0 }]);
    expect(await fetchMdotTrafficCameras()).toHaveLength(20 * 5);
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('site=99'))).toBe(false);
  });

  it('throws when fewer than 95% of the sites can be read', async () => {
    stub(sites, { 2: '500', 5: 'error' });
    await expect(fetchMdotTrafficCameras()).rejects.toThrow('short read, 18 of 20 sites');

    stub(sites, { 2: 'nolist', 7: '500' });
    await expect(fetchMdotTrafficCameras()).rejects.toThrow('short read, 18 of 20 sites');
  });

  it('throws on an HTTP error, a misshapen or empty list, or no live views', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })));
    await expect(fetchMdotTrafficCameras()).rejects.toThrow('HTTP 503');

    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ d: {} }))));
    await expect(fetchMdotTrafficCameras()).rejects.toThrow('unexpected response');

    stub([{ ...site, markerid: 'nope' }]);
    await expect(fetchMdotTrafficCameras()).rejects.toThrow('no camera sites listed');

    stub(sites.slice(0, 2), { 1: 'novideo', 2: 'novideo' });
    await expect(fetchMdotTrafficCameras()).rejects.toThrow('no live views');
  });
});

// Live integration test — opt in with RUN_LIVE_TESTS=1.
const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

describe('fetchMdotTrafficCameras (live)', () => {
  liveIt('fetches the live MDOT camera views', async () => {
    const t0 = Date.now();
    const cams = await fetchMdotTrafficCameras();
    console.info(`MDOTtraffic: ${cams.length} cameras in ${Date.now() - t0} ms`);
    expect(cams.length).toBeGreaterThan(850);
    expect(new Set(cams.map(c => c.id)).size).toBe(cams.length);
    const b = MDOTTRAFFIC_BOUNDS;
    for (const c of cams) {
      expect(c.id).toMatch(/^msdot-[A-Za-z0-9-]+$/);
      expect(c.source).toBe('MDOTtraffic');
      expect(c.lat > b.minLat && c.lat < b.maxLat && c.lng > b.minLng && c.lng < b.maxLng).toBe(true);
      expect(c.stream_type).toBe('hls');
      expect(c.stream_url).toMatch(/^https:\/\/streaming[a-z]+\d+\.mdottraffic\.com\/rtplive\/[A-Za-z0-9-]+\.stream\/playlist\.m3u8$/);
      expect(c.feed_url).toMatch(/^https:\/\/streaming[a-z]+\d+\.mdottraffic\.com\/thumbnail\?application=rtplive&streamname=/);
    }
  }, 30_000);
});
