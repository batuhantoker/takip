import { afterEach, describe, it, expect, vi } from 'vitest';
import { mapRiverCamera, loadMlitRiverCameras, type RiverFeature } from './mlit-river';

// One verbatim entry: 221320003's master file names its still cctv_130001_31C03351 (2026-10-12).
vi.mock('@/lib/cctv/generated/mlit-river-cctv.generated', () => ({ MLIT_RIVER_CCTV: { 221320003: 'cctv_130001_31C03351' } }));

afterEach(() => vi.unstubAllGlobals());

// Trimmed from www.river.go.jp/kawabou/file/gjson/scam/1301.json and 102.json (2026-10-12).
const PREFECTURAL = `{"type":"Feature","geometry":{"type":"Point","coordinates":[139.731902778,35.647244444]},"properties":{"id":303329013,"name":"四ノ橋","name_kana":"","ofc_cd":13,"sys_id":3,"sys_cam_id":"3329013","pause":0,"date_type":0,"cam_kind":2,"own_cd":3329}}`;
const SIMPLE = `{"type":"Feature","geometry":{"type":"Point","coordinates":[139.766954,35.816306]},"properties":{"id":102817028,"name":"毛長川舎人観測局","name_kana":"","ofc_cd":83,"sys_id":1,"sys_cam_id":"2817028","pause":0,"date_type":1,"cam_kind":4,"own_cd":2817}}`;
// MLIT office CCTV: the still is cctv_130001_31C03351.jpg, which this index does not carry.
const OFFICE = `{"type":"Feature","geometry":{"type":"Point","coordinates":[139.672005556,35.582930556]},"properties":{"id":221320003,"name":"田園調布出張所2","name_kana":"","ofc_cd":83,"sys_id":2,"sys_cam_id":"21320003","pause":0,"date_type":0,"cam_kind":2,"own_cd":21320}}`;
const PAUSED = `{"type":"Feature","geometry":{"type":"Point","coordinates":[142.373327778,44.223333333]},"properties":{"id":100257215,"name":"新タヨロマ川  1.5Kp","name_kana":"","ofc_cd":81,"sys_id":1,"sys_cam_id":"257215","pause":1,"date_type":2,"cam_kind":4,"own_cd":257}}`;

const COLLECTION = `{"type":"FeatureCollection","crs":{"type":"name","properties":{"name":"EPSG:4326"}},"features":[${[PREFECTURAL, OFFICE, SIMPLE, PAUSED, PREFECTURAL].join(',')}]}`;

const feature = (s: string): RiverFeature => JSON.parse(s);
const at = (f: RiverFeature, coordinates: (number | null)[] | null): RiverFeature => ({ ...f, geometry: { coordinates } });

describe('mapRiverCamera', () => {
  it('maps a prefectural camera to its current still', () => {
    expect(mapRiverCamera(feature(PREFECTURAL))).toEqual({
      id: 'mlit-river-303329013',
      lat: 35.647244444,
      lng: 139.731902778,
      name: '四ノ橋',
      city: '',
      country: 'Japan',
      feed_url: 'https://cam.river.go.jp/cam/now/303329013.jpg',
      external_url: 'https://www.river.go.jp/kawabou/pc/tm',
      source: 'MLIT 川の防災情報',
    });
  });

  it('maps a simple camera the same way', () => {
    expect(mapRiverCamera(feature(SIMPLE))).toMatchObject({
      id: 'mlit-river-102817028',
      feed_url: 'https://cam.river.go.jp/cam/now/102817028.jpg',
    });
  });

  it('maps office CCTV to its harvested still, and drops one never harvested', () => {
    expect(mapRiverCamera(feature(OFFICE))).toMatchObject({
      id: 'mlit-river-221320003',
      feed_url: 'https://cam.river.go.jp/cam/now/cctv_130001_31C03351.jpg',
    });
    const unharvested = feature(OFFICE);
    expect(mapRiverCamera({ ...unharvested, properties: { ...unharvested.properties, id: 221320999 } })).toBeNull();
  });

  it('drops paused cameras', () => {
    expect(mapRiverCamera(feature(PAUSED))).toBeNull();
    expect(mapRiverCamera({ ...feature(SIMPLE), properties: { ...feature(SIMPLE).properties, pause: null } })).toBeNull();
  });

  it('drops missing, zero, swapped and foreign coordinates', () => {
    const f = feature(PREFECTURAL);
    expect(mapRiverCamera(at(f, null))).toBeNull();
    expect(mapRiverCamera(at(f, [null, null]))).toBeNull();
    expect(mapRiverCamera(at(f, [0, 0]))).toBeNull();
    expect(mapRiverCamera(at(f, [35.647244444, 139.731902778]))).toBeNull();
    // Manila.
    expect(mapRiverCamera(at(f, [120.984, 14.599]))).toBeNull();
  });

  it('drops unusable ids and collapses whitespace in names', () => {
    const f = feature(PREFECTURAL);
    expect(mapRiverCamera({ ...f, properties: { ...f.properties, id: null } })).toBeNull();
    expect(mapRiverCamera({ ...f, properties: { ...f.properties, id: 3.5 } })).toBeNull();
    expect(mapRiverCamera(feature(PAUSED.replace('"pause":1', '"pause":0')))?.name).toBe('新タヨロマ川 1.5Kp');
    expect(mapRiverCamera({ ...f, properties: { ...f.properties, name: ' ' } })?.name).toBe('River camera 303329013');
  });
});

describe('loadMlitRiverCameras', () => {
  it('reads every prefecture, tolerating ones that fail', async () => {
    const fetch = vi.fn(async (url: string) => (url.endsWith('/scam/1301.json')
      ? new Response(COLLECTION, { status: 200 })
      : new Response('', { status: 404 })));
    vi.stubGlobal('fetch', fetch);

    const cams = await loadMlitRiverCameras();
    expect(cams.map(c => c.id)).toEqual(['mlit-river-303329013', 'mlit-river-221320003', 'mlit-river-102817028']);
    expect(fetch).toHaveBeenCalledTimes(50);
    expect(fetch).toHaveBeenCalledWith('https://www.river.go.jp/kawabou/file/gjson/scam/102.json', expect.anything());
    expect(fetch).toHaveBeenCalledWith('https://www.river.go.jp/kawabou/file/gjson/scam/4701.json', expect.anything());
    expect(fetch).not.toHaveBeenCalledWith('https://www.river.go.jp/kawabou/file/gjson/scam/101.json', expect.anything());
  });

  it('throws when no prefecture answers', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })));
    await expect(loadMlitRiverCameras()).rejects.toThrow(/no prefecture answered/);
  });

  it('treats a body without features as a failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })));
    await expect(loadMlitRiverCameras()).rejects.toThrow(/no prefecture answered/);
  });
});

// Live integration test — opt in with RUN_LIVE_TESTS=1. One run is one production refresh: 50 GETs.
const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

describe('loadMlitRiverCameras (live)', () => {
  liveIt('fetches the nationwide set', async () => {
    const cams = await loadMlitRiverCameras();
    expect(cams.length).toBeGreaterThan(4000);
    expect(new Set(cams.map(c => c.id)).size).toBe(cams.length);
    for (const cam of cams) expect(cam.feed_url).toMatch(/^https:\/\/cam\.river\.go\.jp\/cam\/now\/\d+\.jpg$/);
  }, 60000);
});
