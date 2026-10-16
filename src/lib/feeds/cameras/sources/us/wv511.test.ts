import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  describeCamera, fetchWv511Cameras, mapWv511Camera, parseCameraData, parseStreamUrl, WV511_BOUNDS, type Wv511Row,
} from './wv511';

// Verbatim from wv511.org/wsvc/gmap.asmx/buildCamerasJSONjs, abridged to two cams.
const listJs = String.raw`var icon_feed_split2 = {
    scale: 0.75,
    href: "/icons/Cameras_32x32.png"
  }

var camera_data = { "count": 133,
 "cams": [{"origin":"Camera-669fee457101b83b3088bf4c","md5":"CAM117","title":"I-81","description":"\u003cdiv id=\"camDescription\"\u003e[BER]I-81 @ 0.5\u003cspan style=\"float:right\"\u003eWest Virginia DOT\u003c/span\u003e\u003c/div\u003e\u003c!--\u003cdiv id=\"staticCamHolder\"\u003e\u003cp\u003e\u003cimg class=\"webmapcamimg\" id=\"imgCAM117\" src=\"/images/cam_unavailable.jpg?nocache=20261012173037\" /\u003e\u003c/p\u003e\u003c/div\u003e--\u003e\u003c!--STREAMING:1--\u003e\u003cdiv id=\"streamingCamHolder\"\u003e\u003c/div\u003e","start_lat":"39.302863","start_lng":"-78.078892","ev_radius":null,"icon":"icon_feed"},{"origin":"Camera-669ff3ee7101b83b3088bf79","md5":"CAM092","title":"I-79","description":"\u003cdiv id=\"camDescription\"\u003e[MON]I-79 @ .3 I-68 I/C - A\u003cspan style=\"float:right\"\u003eWest Virginia DOT\u003c/span\u003e\u003c/div\u003e\u003c!--\u003cdiv id=\"staticCamHolder\"\u003e\u003cp\u003e\u003cimg class=\"webmapcamimg\" id=\"imgCAM092\" src=\"/images/cam_unavailable.jpg?nocache=20261012173037\" /\u003e\u003c/p\u003e\u003c/div\u003e--\u003e\u003c!--STREAMING:1--\u003e\u003cdiv id=\"streamingCamHolder\"\u003e\u003c/div\u003e","start_lat":"39.579646","start_lng":"-79.968964","ev_radius":null,"icon":"icon_feed"}]
}
`;

const camera = parseCameraData(listJs).cams[0];

// Verbatim from wv511.org/flowplayeri.aspx?CAMID=CAM092, abridged.
const playerHtml = `
				hls.loadSource('https://vtc3.roadsummary.com/rtplive/CAM092/playlist.m3u8');
                hls.attachMedia($video);
			<video id="media-video" autoplay="true" muted playsinline preload="metadata" poster="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"> <!-- Added poster to hide big play icon on Android Webview -->
				<source type="application/x-mpegurl"	src="https://vtc3.roadsummary.com/rtplive/CAM092/playlist.m3u8" />
			</video>
`;

const stream117 = 'https://vtc1.roadsummary.com/rtplive/CAM117/playlist.m3u8';
const label = (text: string) => describeCamera(`<div id="camDescription">${text}<span style="float:right">West Virginia DOT</span></div>`);

describe('parseCameraData', () => {
  it('reads the camera_data object out of the script', () => {
    const { count, cams } = parseCameraData(listJs);
    expect(count).toBe(133);
    expect(cams.map(c => c.md5)).toEqual(['CAM117', 'CAM092']);
    expect(cams[0].description).toMatch(/^<div id="camDescription">\[BER\]I-81 @ 0\.5<span/);
  });

  it('stops at the matching brace, not at braces inside strings or later statements', () => {
    const js = 'var camera_data = {"count":1,"cams":[{"md5":"CAM001","title":"a } { \\" }"}]};\nvar next = { x: 1 };';
    expect(parseCameraData(js)).toEqual({ count: 1, cams: [{ md5: 'CAM001', title: 'a } { " }' }] });
  });

  it('falls back to the cams length when count is missing', () => {
    expect(parseCameraData('var camera_data = {"cams":[{"md5":"CAM001"}]}').count).toBe(1);
  });

  it('throws on a missing, truncated or misshapen object', () => {
    expect(() => parseCameraData('var styles = [];')).toThrow('camera_data');
    expect(() => parseCameraData(listJs.slice(0, 400))).toThrow('camera_data');
    expect(() => parseCameraData('var camera_data = {"count":1,"cams":{}}')).toThrow('no cams');
    expect(() => parseCameraData('var camera_data = {"count":1,"cams":[,]}')).toThrow();
  });
});

describe('parseStreamUrl', () => {
  it('finds the playlist in a player page', () => {
    expect(parseStreamUrl(playerHtml)).toBe('https://vtc3.roadsummary.com/rtplive/CAM092/playlist.m3u8');
  });

  it('ignores the default host an unknown CAMID gets, and pages without a playlist', () => {
    expect(parseStreamUrl(playerHtml.replaceAll('vtc3', 'sfs1'))).toBeNull();
    expect(parseStreamUrl(playerHtml.replaceAll('https:', 'http:'))).toBeNull();
    expect(parseStreamUrl('<html></html>')).toBeNull();
    expect(parseStreamUrl(null)).toBeNull();
  });
});

describe('describeCamera', () => {
  it('turns a bare milepost into MM and the county code into a county', () => {
    expect(label('[BER]I-81 @ 0.5')).toEqual({ name: 'I-81 @ MM 0.5', county: 'Berkeley County' });
    expect(label('[MON]I-79 @ .3 I-68 I/C - A')).toEqual({ name: 'I-79 @ MM 0.3 I-68 I/C - A', county: 'Monongalia County' });
    expect(label('[BER]I-81 @ 13 King Street').name).toBe('I-81 @ MM 13 King Street');
    expect(label('[KAN]I-77 @  79').name).toBe('I-77 @ MM 79');
    expect(label('[MER]I-77 @12.5').name).toBe('I-77 @ MM 12.5');
    expect(label('[BER]I-81 @ 20 ').name).toBe('I-81 @ MM 20');
  });

  it('leaves exits, existing MMs and plain places alone', () => {
    expect(label('[CAB]I-64 @ 15B ').name).toBe('I-64 @ 15B');
    expect(label('[HAR]I-79 @ MM 119 Clarksburg').name).toBe('I-79 @ MM 119 Clarksburg');
    expect(label('[KAN]I-64 MM 56.4').name).toBe('I-64 MM 56.4');
    expect(label('[KAN]US-119@Jefferson Rd')).toEqual({ name: 'US-119 @ Jefferson Rd', county: 'Kanawha County' });
    expect(label('[MON] Van Voorhis Elmer Prince')).toEqual({ name: 'Van Voorhis Elmer Prince', county: 'Monongalia County' });
    expect(label('[RAL]US-19  Bradley').name).toBe('US-19 Bradley');
  });

  it('decodes entities once and strips stray tags', () => {
    expect(label('[WOO]US-50 &amp; <b>RT 47</b>').name).toBe('US-50 & RT 47');
    expect(label('[WOO]A &amp;lt; B').name).toBe('A &lt; B');
  });

  it('leaves the county empty for an unknown code or no code', () => {
    expect(label('[XYZ]I-64 @ 1')).toEqual({ name: 'I-64 @ MM 1', county: null });
    expect(label('I-64 @ 1')).toEqual({ name: 'I-64 @ MM 1', county: null });
    expect(describeCamera('<p>no description</p>')).toEqual({ name: null, county: null });
    expect(describeCamera(null)).toEqual({ name: null, county: null });
  });
});

describe('mapWv511Camera', () => {
  it('maps a camera to its HLS stream, with no still', () => {
    expect(mapWv511Camera(camera, stream117)).toEqual({
      id: 'wvdot-CAM117',
      lat: 39.302863,
      lng: -78.078892,
      name: 'I-81 @ MM 0.5',
      city: 'Berkeley County',
      country: 'US',
      stream_url: 'https://vtc1.roadsummary.com/rtplive/CAM117/playlist.m3u8',
      stream_type: 'hls',
      source: 'WVDOT',
    });
  });

  it("drops a stream that is missing, not https, not on a vtc host or another camera's", () => {
    expect(mapWv511Camera(camera, null)).toBeNull();
    expect(mapWv511Camera(camera, stream117.replace('https:', 'http:'))).toBeNull();
    expect(mapWv511Camera(camera, stream117.replace('vtc1', 'sfs1'))).toBeNull();
    expect(mapWv511Camera(camera, stream117.replace('CAM117', 'CAM118'))).toBeNull();
    expect(mapWv511Camera(camera, `${stream117}?x=1`)).toBeNull();
  });

  it('drops rows without a CAMnnn id', () => {
    expect(mapWv511Camera({ ...camera, md5: null }, stream117)).toBeNull();
    expect(mapWv511Camera({ ...camera, md5: 'CAM-117' }, stream117)).toBeNull();
    expect(mapWv511Camera(null, stream117)).toBeNull();
  });

  it('drops coordinates outside West Virginia', () => {
    expect(mapWv511Camera({ ...camera, start_lat: '0', start_lng: '0' }, stream117)).toBeNull();
    expect(mapWv511Camera({ ...camera, start_lat: null }, stream117)).toBeNull();
    expect(mapWv511Camera({ ...camera, start_lng: '78.078892' }, stream117)).toBeNull();
  });

  it('falls back to the title and the state', () => {
    const cam = mapWv511Camera({ ...camera, description: '<div>x</div>' }, stream117);
    expect(cam?.name).toBe('I-81');
    expect(cam?.city).toBe('West Virginia');
    expect(mapWv511Camera({ ...camera, description: null, title: ' ' }, stream117)?.name).toBe('WVDOT Camera CAM117');
  });
});

describe('fetchWv511Cameras (mocked network)', () => {
  const ids = Array.from({ length: 10 }, (_, i) => `CAM${String(i + 1).padStart(3, '0')}`);
  const list = (rows: Wv511Row[], count = rows.length) =>
    `var icon_feed = {}\nvar camera_data = ${JSON.stringify({ count, cams: rows })}\n`;
  const page = (id: string, host = 'vtc2') =>
    `<source type="application/x-mpegurl" src="https://${host}.roadsummary.com/rtplive/${id}/playlist.m3u8" />`;

  /** `fail` maps a CAMID to how its player page fails. */
  function stub(js: string, fail: Record<string, '404' | 'error' | 'default'> = {}) {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url === 'https://wv511.org/wsvc/gmap.asmx/buildCamerasJSONjs') return new Response(js);
      const id = url.match(/^https:\/\/wv511\.org\/flowplayeri\.aspx\?CAMID=(CAM\d+)$/)?.[1];
      if (!id) return new Response('', { status: 500 });
      if (fail[id] === '404') return new Response('', { status: 404 });
      if (fail[id] === 'error') throw new TypeError('fetch failed');
      return new Response(page(id, fail[id] === 'default' ? 'sfs1' : 'vtc2'));
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  beforeEach(() => { vi.spyOn(console, 'log').mockImplementation(() => {}); });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('looks up each camera once and drops those whose lookup fails', async () => {
    const rows = [...ids.map(md5 => ({ ...camera, md5 })), { ...camera, md5: 'CAM001' }];
    const fetchMock = stub(list(rows), { CAM004: '404' });
    const cams = await fetchWv511Cameras();
    expect(cams.map(c => c.id)).toEqual(ids.filter(id => id !== 'CAM004').map(id => `wvdot-${id}`));
    expect(cams[0].stream_url).toBe('https://vtc2.roadsummary.com/rtplive/CAM001/playlist.m3u8');
    // The list plus one player page per unique camera, and nothing else on gmap.asmx.
    expect(fetchMock).toHaveBeenCalledTimes(11);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('gmap.asmx'))).toHaveLength(1);
  });

  it('throws when fewer than 80% of the cameras resolve a stream host', async () => {
    stub(list(ids.map(md5 => ({ ...camera, md5 }))), { CAM002: '404', CAM005: 'error', CAM009: 'default' });
    await expect(fetchWv511Cameras()).rejects.toThrow('short read, 7 of 10');
  });

  it('throws on an HTTP error, a short list or an empty list', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })));
    await expect(fetchWv511Cameras()).rejects.toThrow('HTTP 503');

    stub(list(ids.map(md5 => ({ ...camera, md5 })), 133));
    await expect(fetchWv511Cameras()).rejects.toThrow('short list, 10 of 133');

    stub(list([{ ...camera, md5: 'nope' }]));
    await expect(fetchWv511Cameras()).rejects.toThrow('no cameras listed');

    stub('<html>maintenance</html>');
    await expect(fetchWv511Cameras()).rejects.toThrow('camera_data');
  });
});

// Live integration test — opt in with RUN_LIVE_TESTS=1.
const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

describe('fetchWv511Cameras (live)', () => {
  liveIt('fetches the streaming cameras', async () => {
    const cams = await fetchWv511Cameras();
    expect(cams.length).toBeGreaterThan(105);
    expect(new Set(cams.map(c => c.id)).size).toBe(cams.length);
    const b = WV511_BOUNDS;
    for (const c of cams) {
      expect(c.id).toMatch(/^wvdot-CAM\d+$/);
      expect(c.source).toBe('WVDOT');
      expect(c.lat > b.minLat && c.lat < b.maxLat && c.lng > b.minLng && c.lng < b.maxLng).toBe(true);
      expect(c.stream_type).toBe('hls');
      expect(c.stream_url).toMatch(/^https:\/\/vtc\d+\.roadsummary\.com\/rtplive\/CAM\d+\/playlist\.m3u8$/);
      expect(c.feed_url).toBeUndefined();
    }
  }, 20_000);
});
