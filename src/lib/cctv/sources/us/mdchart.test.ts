import { describe, it, expect } from 'vitest';
import { chartLabel, fetchMdChartCameras, mapMdChartCamera, MDCHART_BOUNDS, type MdChartCamera } from './mdchart';

// Verbatim from chartexp1.sha.maryland.gov/CHARTExportClientService/getCameraMapDataJSON.do.
const camera: MdChartCamera = {
  cameraCategories: ['Wash. DC'], cctvIp: 'strmr5.sha.maryland.gov', commMode: 'ONLINE',
  description: 'I-270 & Old Hundred Rd (MD 109)(CAM 165)', id: '7a00a1dc01250075004d823633235daa',
  lat: 39.2773, lon: -77.3236, name: 'I-270 & Old Hundred Rd (MD 109)', opStatus: 'OK',
};

// Verbatim: a row whose name is only a device number.
const coded: MdChartCamera = {
  cameraCategories: ['Annapolis'], cctvIp: 'strmr3.sha.maryland.gov', commMode: 'ONLINE',
  description: 'I-97 S OF EXIT 7 MD 32', id: '3b009d0700e600e30051fa36c4235c0a',
  lat: 39.056686, lon: -76.63118, name: '502023', opStatus: 'COMM_FAILURE',
};

describe('mapMdChartCamera', () => {
  it('maps a camera to the HLS playlist on its streaming edge', () => {
    expect(mapMdChartCamera(camera)).toEqual({
      id: 'mdsha-7a00a1dc01250075004d823633235daa',
      lat: 39.2773,
      lng: -77.3236,
      name: 'I-270 & Old Hundred Rd (MD 109)',
      city: 'Washington DC area',
      country: 'US',
      stream_url: 'https://strmr5.sha.maryland.gov/rtplive/7a00a1dc01250075004d823633235daa/playlist.m3u8',
      stream_type: 'hls',
      source: 'MDOT SHA',
    });
  });

  it('keeps marginal links and drops failed or offline ones', () => {
    expect(mapMdChartCamera({ ...coded, opStatus: 'COMM_MARGINAL' })?.city).toBe('Annapolis');
    expect(mapMdChartCamera(coded)).toBeNull();
    expect(mapMdChartCamera({ ...camera, commMode: 'OFFLINE' })).toBeNull();
    expect(mapMdChartCamera({ ...camera, opStatus: null })).toBeNull();
  });

  it('drops coordinates outside Maryland', () => {
    expect(mapMdChartCamera({ ...camera, lat: 0, lon: 0 })).toBeNull();
    expect(mapMdChartCamera({ ...camera, lon: null })).toBeNull();
  });

  it('drops rows without a well-formed id or a CHART streaming host', () => {
    expect(mapMdChartCamera({ ...camera, id: null })).toBeNull();
    expect(mapMdChartCamera({ ...camera, id: '../x' })).toBeNull();
    expect(mapMdChartCamera({ ...camera, cctvIp: '10.0.0.5' })).toBeNull();
    expect(mapMdChartCamera({ ...camera, cctvIp: 'evil.example.com' })).toBeNull();
    expect(mapMdChartCamera(null)).toBeNull();
  });

  it('falls back when the area is missing', () => {
    expect(mapMdChartCamera({ ...camera, cameraCategories: [] })?.city).toBe('Maryland');
    expect(mapMdChartCamera({ ...camera, cameraCategories: ['Baltimore'] })?.city).toBe('Baltimore');
  });
});

describe('chartLabel', () => {
  it('uses the description when the name is a device number', () => {
    expect(chartLabel(coded)).toBe('I-97 S OF EXIT 7 MD 32');
    expect(chartLabel({ name: '710002', description: 'I-270 & Old Hundred Rd (MD 109)(CAM 165)' })).toBe('I-270 & Old Hundred Rd (MD 109)');
  });

  it('prefers a readable name', () => {
    expect(chartLabel(camera)).toBe('I-270 & Old Hundred Rd (MD 109)');
    expect(chartLabel({ name: null, description: ' ' })).toBeNull();
  });
});

const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

describe('fetchMdChartCameras (live)', () => {
  liveIt('fetches the online cameras', async () => {
    const cams = await fetchMdChartCameras();
    expect(cams.length).toBeGreaterThan(400);
    expect(new Set(cams.map(c => c.id)).size).toBe(cams.length);
    const b = MDCHART_BOUNDS;
    for (const c of cams) {
      expect(c.id).toMatch(/^mdsha-[0-9a-f]{32}$/);
      expect(c.lat > b.minLat && c.lat < b.maxLat && c.lng > b.minLng && c.lng < b.maxLng).toBe(true);
      expect(c.stream_url).toMatch(/^https:\/\/strmr\d+\.sha\.maryland\.gov\/rtplive\/[0-9a-f]{32}\/playlist\.m3u8$/);
      expect(c.feed_url).toBeUndefined();
    }
  }, 20_000);
});
