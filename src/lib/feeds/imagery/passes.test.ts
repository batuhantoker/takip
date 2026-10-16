import { describe, it, expect } from 'vitest';
import { parseTLE, propagateSatrec } from '@/lib/feeds/satellites/orbit';
import { areaAround, samplePoints } from './area';
import { IMAGERS, clearestMix, groundKm, groupPasses, nextPasses, normalizePlatform, parseScenes, tilesFromTilejson, type Scene } from './passes';

// Sentinel-2A as CelesTrak gave it on 2026-10-15.
const S2A = [
  '1 40697U 15028A   26288.63421278  .00000117  00000+0  61078-4 0  9995',
  '2 40697  98.5638   1.7275 0001037  91.0114 269.1188 14.30822612590958',
] as const;
const KHARKIV = { lat: 49.99, lng: 36.23 };
const FROM = Date.parse('2026-10-15T12:00:00Z');

describe('normalizePlatform', () => {
  it('reads every spelling Planetary Computer uses', () => {
    expect(normalizePlatform('Sentinel-2B')).toBe('sentinel-2b');
    expect(normalizePlatform('sentinel-1c')).toBe('sentinel-1c');
    expect(normalizePlatform('LANDSAT 9')).toBe('landsat-9');
    expect(IMAGERS[normalizePlatform('Sentinel-2C')].norad).toBe('60989');
  });
});

describe('parseScenes', () => {
  const tilejson = 'https://planetarycomputer.microsoft.com/api/data/v1/item/tilejson.json?collection=landsat-c2-l2&item=LC09&assets=red&color_formula=gamma%20RGB%202.7';
  const fc = { features: [
    { id: 'LC09', geometry: { type: 'Point', coordinates: [36, 50] } as GeoJSON.Point, properties: { datetime: '2026-10-09T08:24:00Z', platform: 'landsat-9', 'eo:cloud_cover': 8.1 },
      assets: { tilejson: { href: tilejson }, rendered_preview: { href: 'https://x/preview.png' } } },
    { id: 'bad', properties: { datetime: 'never' } },
  ] };

  it('keeps the rendering of the tilejson link in the tile template', () => {
    expect(tilesFromTilejson(tilejson)).toBe('https://planetarycomputer.microsoft.com/api/data/v1/item/tiles/WebMercatorQuad/{z}/{x}/{y}@1x?collection=landsat-c2-l2&item=LC09&assets=red&color_formula=gamma%20RGB%202.7');
  });

  it('reads a scene and drops one without a time', () => {
    const [scene, ...rest] = parseScenes(fc, 'landsat-c2-l2');
    expect(rest).toEqual([]);
    expect(scene.imager?.name).toBe('Landsat 9');
    expect(scene.time).toBe(Date.parse('2026-10-09T08:24:00Z'));
    expect(scene.cloud).toBe(8.1);
    expect(scene.tiles).toContain('/tiles/WebMercatorQuad/{z}/{x}/{y}@1x?');
    expect(scene.preview).toBe('https://x/preview.png');
  });
});

// A 0.4° square footprint from its south-west corner.
const square = (lng: number, lat: number, size = 0.4): GeoJSON.Polygon =>
  ({ type: 'Polygon', coordinates: [[[lng, lat], [lng + size, lat], [lng + size, lat + size], [lng, lat + size], [lng, lat]]] });

const scene = (id: string, platform: string, time: string, cloud: number | null, footprint: GeoJSON.Polygon = square(36, 49.8)): Scene =>
  ({ id, collection: 'c', platform, imager: IMAGERS[platform], time: Date.parse(time), cloud, tiles: `https://x/${id}/{z}/{x}/{y}`, preview: null, footprint });

// 20 km around Kharkiv: 49.9–50.08 N, 36.09–36.37 E.
const AREA = areaAround(KHARKIV.lat, KHARKIV.lng, 20);
const SAMPLES = samplePoints(AREA);

describe('groupPasses', () => {
  it('merges one pass\'s tiles behind the clearest, and keeps other passes', () => {
    const out = groupPasses([
      scene('a', 'sentinel-2b', '2026-10-12T08:46:00Z', 20, square(35.8, 49.8)),
      scene('b', 'sentinel-2b', '2026-10-12T08:46:30Z', 0, square(36.2, 49.8)),
      scene('c', 'sentinel-2a', '2026-10-12T08:46:10Z', 5),
      scene('d', 'sentinel-2b', '2026-10-09T08:46:00Z', 36),
    ], SAMPLES);
    expect(out.map(p => p.id)).toEqual(['b', 'c', 'd']);
    expect(out[0].tiles.map(t => t.id)).toEqual(['a', 'b']);
    expect(out[0].cloud).toBe(10);
    expect(out[1].tiles).toHaveLength(1);
  });

  it('chains a strip of frames longer than the gap into one pass', () => {
    const frames = [0, 25, 50, 75, 100, 125, 150].map(s => scene(`f${s}`, 'landsat-9', new Date(Date.parse('2026-10-09T08:24:00Z') + s * 1000).toISOString(), 3));
    expect(groupPasses(frames, SAMPLES)).toHaveLength(1);
  });

  it('measures how much of the area a pass covers and drops one that misses it', () => {
    const [half, ...rest] = groupPasses([
      scene('west', 'sentinel-2a', '2026-10-12T08:46:00Z', 0, square(35.8, 49.8, 0.43)),
      scene('away', 'sentinel-2b', '2026-10-10T08:46:00Z', 0, square(30, 40)),
    ], SAMPLES);
    expect(half.coverage).toBeCloseTo(0.5, 1);
    expect(rest).toEqual([]);
  });
});

describe('clearestMix', () => {
  it('covers the area from the clearest tiles of different passes', () => {
    const mix = clearestMix([
      scene('west-clear', 'sentinel-2a', '2026-10-12T08:46:00Z', 1, square(35.8, 49.8, 0.43)),
      scene('east-clear', 'landsat-9', '2026-10-01T08:24:00Z', 2, square(36.2, 49.8)),
      scene('all-cloudy', 'sentinel-2b', '2026-10-14T08:46:00Z', 90, square(35.8, 49.6, 1)),
      scene('radar', 'sentinel-1c', '2026-10-13T04:05:00Z', null, square(35.8, 49.6, 1)),
    ], SAMPLES)!;
    expect(mix.tiles.map(t => t.id)).toEqual(['east-clear', 'west-clear']);
    expect(mix.coverage).toBe(1);
    expect(mix.mix).toEqual({ passes: 2, from: Date.parse('2026-10-01T08:24:00Z'), to: Date.parse('2026-10-12T08:46:00Z') });
  });

  it('is nothing when one pass already covers the area', () => {
    expect(clearestMix([scene('all', 'sentinel-2a', '2026-10-12T08:46:00Z', 0, square(35.8, 49.6, 1))], SAMPLES)).toBeNull();
  });
});

describe('groundKm', () => {
  it('measures a degree of latitude as about 111 km', () => {
    expect(groundKm(0, 0, 1, 0)).toBeCloseTo(111.2, 0);
  });
});

describe('nextPasses', () => {
  const passes = nextPasses(S2A[0], S2A[1], KHARKIV.lat, KHARKIV.lng, IMAGERS['sentinel-2a'].swathKm, FROM);

  it('finds overflights within half a swath, in order', () => {
    expect(passes.length).toBeGreaterThan(0);
    for (const p of passes) expect(p.offsetKm).toBeLessThanOrEqual(145);
    for (let i = 1; i < passes.length; i++) expect(passes[i].time).toBeGreaterThan(passes[i - 1].time);
  });

  it('times each one at the closest approach', () => {
    const satrec = parseTLE(S2A[0], S2A[1])!;
    const at = (t: number) => { const q = propagateSatrec(satrec, new Date(t))!; return groundKm(KHARKIV.lat, KHARKIV.lng, q.lat, q.lng); };
    for (const p of passes) {
      expect(at(p.time)).toBeLessThanOrEqual(at(p.time - 60_000));
      expect(at(p.time)).toBeLessThanOrEqual(at(p.time + 60_000));
    }
  });

  it('flags whether the sun is up, which an optical image needs', () => {
    expect(passes.some(p => p.daylit)).toBe(true);
    expect(passes.every(p => typeof p.daylit === 'boolean')).toBe(true);
  });

  it('predicts the real Sentinel-2A scene of Kharkiv on 2026-10-09 at 08:46 UTC', () => {
    const [first] = nextPasses(S2A[0], S2A[1], KHARKIV.lat, KHARKIV.lng, 290, Date.parse('2026-10-09T00:00:00Z'));
    expect(new Date(first.time).toISOString().slice(0, 16)).toBe('2026-10-09T08:46');
    expect(first.daylit).toBe(true);
  });

  it('gives nothing for a bad element set', () => {
    expect(nextPasses('1 bad', '2 bad', 0, 0, 290, FROM)).toEqual([]);
  });
});
