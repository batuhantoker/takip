import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  TRAFFIC_SCOTLAND_BOUNDS, extractTrafficScotlandFrame, fetchTrafficScotlandCameras, mapTrafficScotlandCamera,
} from './traffic-scotland';

// Verbatim from www.traffic.gov.scot/tsis/cameras, 2026-10-12.
const row = { sid: '1', title: 'M8 Kingston Br', lat: '55.852826000000', lng: '-4.270806100000', roadname: 'M8', images: '16', region: 'Strathclyde' };

// The fragment's shape, verbatim except the base64 (a 4-byte JPEG header stands in for the frame).
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
const fragment = (b64: string) =>
  `<div class="iw-holder"><div class="iw-header"><img src="/themes/ud/img/tsis-cameras.png"><span></span></div><div class="camera-image" tid="16"><img src="data:image/jpeg;base64,${b64}" /></div></div>`;

describe('mapTrafficScotlandCamera', () => {
  it('maps a camera to our frame route', () => {
    expect(mapTrafficScotlandCamera(row)).toEqual({
      id: 'trafficscot-1',
      lat: 55.852826,
      lng: -4.2708061,
      name: 'M8 Kingston Br',
      city: 'Strathclyde',
      country: 'United Kingdom',
      feed_url: '/api/cctv/traffic-scotland/frame?sid=1',
      stream_type: 'jpg',
      external_url: 'https://www.traffic.gov.scot/traffic-cameras',
      source: 'Traffic Scotland',
    });
  });

  it('drops rows without a numeric sid or a position in Scotland', () => {
    expect(mapTrafficScotlandCamera({ ...row, sid: '1; drop' })).toBeNull();
    expect(mapTrafficScotlandCamera({ ...row, lat: '0', lng: '0' })).toBeNull();
    expect(mapTrafficScotlandCamera({ ...row, lat: '' })).toBeNull();
  });
});

describe('extractTrafficScotlandFrame', () => {
  it('decodes the embedded JPEG', () => {
    expect(extractTrafficScotlandFrame(fragment(JPEG.toString('base64')))).toEqual(JPEG);
  });

  it('refuses a page with no frame, or one that is not a JPEG', () => {
    expect(extractTrafficScotlandFrame('<div class="iw-holder"></div>')).toBeNull();
    expect(extractTrafficScotlandFrame(fragment(Buffer.from('<html>').toString('base64')))).toBeNull();
  });
});

describe('GET /api/cctv/traffic-scotland/frame', () => {
  afterEach(() => vi.unstubAllGlobals());
  const get = async (sid: string) => (await import('@/app/api/(feeds)/cctv/traffic-scotland/frame/route')).GET(new Request(`http://x/api/cctv/traffic-scotland/frame?sid=${sid}`));

  it('serves the decoded frame for a numeric sid only', async () => {
    const fetchMock = vi.fn(async () => new Response(fragment(JPEG.toString('base64'))));
    vi.stubGlobal('fetch', fetchMock);
    const res = await get('1');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/jpeg');
    expect(Buffer.from(await res.arrayBuffer())).toEqual(JPEG);
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toBe('https://www.traffic.gov.scot/tsis/camerahtml?sid=1');

    expect((await get('../x')).status).toBe(400);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('answers 404 when the page has no frame and 502 when the upstream fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<div></div>')));
    expect((await get('2')).status).toBe(404);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })));
    expect((await get('2')).status).toBe(502);
  });
});

const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;
liveIt('fetches the Traffic Scotland camera list', async () => {
  const cams = await fetchTrafficScotlandCameras();
  expect(cams.length).toBeGreaterThan(330);
  expect(new Set(cams.map(c => c.id)).size).toBe(cams.length);
  for (const c of cams) expect(c.lat).toBeGreaterThan(TRAFFIC_SCOTLAND_BOUNDS.minLat);
});
