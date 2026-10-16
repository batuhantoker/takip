import { afterEach, describe, it, expect, vi } from 'vitest';
import {
  parseTopisKml, mapTopisCamera, parseTopisStream, fetchSeoulTopisCameras, fetchTopisStreamUrl, SEOUL_TOPIS_BOUNDS,
} from './seoul-topis';

afterEach(() => vi.unstubAllGlobals());

// Trimmed from topis.seoul.go.kr/map/cctvKml.do (2026-10-12).
const kml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<kml>
    <Document>
        <Placemark>
            <name>목동교</name>
            <ExtendedData>
                <Data name="code"><value>367</value></Data>
                <Data name="layerGubn"><value>CCTV</value></Data>
                <Data name="addr"><value>1180035600</value></Data>
            </ExtendedData>
            <Style><IconStyle><Icon><href>/images/map/map_icon_10.png</href></Icon></IconStyle></Style>
            <Point><coordinates>126.89031,37.53069,0</coordinates></Point>
        </Placemark>
        <Placemark>
            <name>동대문구청</name>
            <ExtendedData>
                <Data name="code"><value>896</value></Data>
                <Data name="layerGubn"><value>CCTV</value></Data>
                <Data name="addr"><value>1050008500</value></Data>
            </ExtendedData>
            <Style><IconStyle><Icon><href>/images/map/map_icon_10.png</href></Icon></IconStyle></Style>
            <Point><coordinates>127.03815,37.57378,0</coordinates></Point>
        </Placemark>
    </Document>
</kml>`;

// Verbatim from topis.seoul.go.kr/map/selectCctvInfo.do, camId=367 (2026-10-12).
const info = {
  rows: [{
    chnId: '367', cctvId: '367', cctvName: '목동교', axX: 126.89031, axY: 37.53069, sectionId: '1180035600',
    rtspUrl: 'rtsp://10.1.120.32:554/vurix/100022/0', roadNm: '국회대로', gvrNm: '서울경찰청', gvrCd: 'SMP',
    hlsUrlOri: 'https://topiscctv1.eseoul.go.kr/sd1/ch139.stream/playlist.m3u8',
    remark5: 'https://strm1.spatic.go.kr:443/live/21.stream/playlist.m3u8', timerYn: 'Y',
    hlsUrl: 'https://topiscctv1.eseoul.go.kr/sd1/ch139.stream/playlist.m3u8',
  }],
};

describe('parseTopisKml / mapTopisCamera', () => {
  it('maps a placemark to a camera streamed through our route', () => {
    const [first] = parseTopisKml(kml);
    expect(mapTopisCamera(first)).toEqual({
      id: 'kr-topis-367',
      lat: 37.53069,
      lng: 126.89031,
      name: '목동교',
      city: 'Seoul',
      country: 'South Korea',
      stream_url: '/api/cctv/topis/stream?id=367',
      stream_type: 'hls',
      external_url: 'https://topis.seoul.go.kr/',
      source: 'Seoul TOPIS',
    });
  });

  it('drops odd codes, other layers and points outside Seoul', () => {
    const p = parseTopisKml(kml)[0];
    expect(mapTopisCamera({ ...p, code: '36a' })).toBeNull();
    expect(mapTopisCamera({ ...p, lat: NaN })).toBeNull();
    expect(mapTopisCamera({ ...p, lat: 35.1, lng: 129.0 })).toBeNull();
    expect(parseTopisKml(kml.replace('<value>CCTV</value>', '<value>VMS</value>'))).toHaveLength(1);
    expect(SEOUL_TOPIS_BOUNDS.minLat).toBeLessThan(37.53069);
  });
});

describe('parseTopisStream', () => {
  it('returns the camera\'s https playlist', () => {
    expect(parseTopisStream(info, '367')).toBe('https://topiscctv1.eseoul.go.kr/sd1/ch139.stream/playlist.m3u8');
  });

  it('falls back to hlsUrlOri, and refuses another camera, host or scheme', () => {
    expect(parseTopisStream({ rows: [{ ...info.rows[0], hlsUrl: null }] }, '367')).toMatch(/ch139\.stream/);
    expect(parseTopisStream(info, '368')).toBeNull();
    const elsewhere = { rows: [{ ...info.rows[0], hlsUrl: 'https://evil.example/x.m3u8', hlsUrlOri: null }] };
    expect(parseTopisStream(elsewhere, '367')).toBeNull();
    const plain = { rows: [{ ...info.rows[0], hlsUrl: 'http://topiscctv1.eseoul.go.kr/x.m3u8', hlsUrlOri: null }] };
    expect(parseTopisStream(plain, '367')).toBeNull();
    expect(parseTopisStream({ rows: [] }, '367')).toBeNull();
  });
});

describe('fetchers', () => {
  it('lists cameras from the KML', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(kml, { headers: { 'Content-Type': 'application/json;charset=UTF-8' } })));
    expect((await fetchSeoulTopisCameras()).map(c => c.id)).toEqual(['kr-topis-367', 'kr-topis-896']);
  });

  it('posts the camera id for its stream', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => Response.json(info));
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchTopisStreamUrl('367')).resolves.toMatch(/ch139\.stream\/playlist\.m3u8$/);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://topis.seoul.go.kr/map/selectCctvInfo.do');
    expect(init?.method).toBe('POST');
    expect(String(init?.body)).toBe('camId=367&cctvSourceCd=HP');
  });

  it('throws on an HTTP error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 500 })));
    await expect(fetchSeoulTopisCameras()).rejects.toThrow(/HTTP 500/);
  });
});

const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

describe('Seoul TOPIS (live)', () => {
  liveIt('lists cameras and resolves one stream', async () => {
    const cams = await fetchSeoulTopisCameras();
    expect(cams.length).toBeGreaterThan(400);
    const id = cams[0].id.replace('kr-topis-', '');
    await expect(fetchTopisStreamUrl(id)).resolves.toMatch(/^https:\/\/.+\.m3u8$/);
  }, 20000);
});
