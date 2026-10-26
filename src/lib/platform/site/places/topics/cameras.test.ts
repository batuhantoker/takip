import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Place } from '../place';
import { CAMERA_TILE_ZOOM, CAMERAS, camerasData } from './cameras';

const centre: [number, number] = [10, 50];
const town: Place = { id: 1, kind: 'city', slug: 'testville', name: 'Testville', cc: 'DE', at: centre, pop: 50_000 };
const roadside: Place = { ...town, id: 2, slug: 'roadside', at: [20, 50] };
// 0.001° of latitude is about 111 m.
const cam = (id: string, north: number, extra: Record<string, unknown>) =>
  ({ id, name: `Cam ${id}`, lat: centre[1] + north, lng: centre[0], source: 'Roads', ...extra });

beforeAll(() => {
  const file = join(mkdtempSync(join(tmpdir(), 'takip-cameras-')), 'cctv-catalog.json');
  writeFileSync(file, JSON.stringify({ version: 2, builtAt: Date.UTC(2026, 9, 26), regions: { test: [
    cam('a', 0.001, { stream_type: 'hls', stream_url: 'https://cams.test/a.m3u8' }),
    cam('b', 0.002, { feed_url: 'https://cams.test/b.jpg' }),
    cam('c', 0.0025, { feed_url: 'https://cams.test/c.jpg' }),
    cam('d', 0.01, { feed_url: 'https://cams.test/d.jpg', offline: true }),
    cam('e', 0.02, { feed_url: 'https://www.nvroads.com/map/Cctv/7' }),
    cam('f', 0.03, { stream_type: 'iframe', stream_url: 'https://www.youtube.com/embed/f' }),
    cam('g', 0.04, { feed_url: 'https://cams.test/g.jpg' }),
    { ...cam('h', 0.001, { stream_type: 'hls', stream_url: 'https://cams.test/h.m3u8' }), lng: 20 },
    { ...cam('i', 0.002, { stream_type: 'mjpeg', stream_url: 'https://cams.test/i.mjpg' }), lng: 20 },
  ] } }));
  vi.stubEnv('TAKIP_CCTV_SNAPSHOT', file);
});
afterAll(() => vi.unstubAllEnvs());

describe('camera pages', () => {
  it('show stills only from cameras on air, one per junction, never a known placeholder', () => {
    const data = camerasData(town)!;
    expect(data.frames.map(f => [f.name, f.frame])).toEqual([['Cam b', 'https://cams.test/b.jpg'], ['Cam g', 'https://cams.test/g.jpg']]);
  });

  it('offer video to play where no camera sends a still, and none beside stills', () => {
    expect(camerasData(roadside)!.streams.map(s => [s.name, s.stream])).toEqual([['Cam h', { kind: 'hls', url: 'https://cams.test/h.m3u8' }]]);
    expect(camerasData(town)!.streams).toEqual([]);
  });

  it('say what each camera shows, and keep the off-air one counted', () => {
    const data = camerasData(town)!;
    expect(Object.fromEntries(data.picks.map(p => [p.name, p.look ?? null]))).toMatchObject({ 'Cam a': 'stream', 'Cam b': 'still', 'Cam e': null, 'Cam f': 'player' });
    expect([data.onAir, data.offAir]).toEqual([6, 1]);
  });

  it('open the map where the nearest camera is drawn as a picture', () => {
    const page = CAMERAS.pages(town)[0];
    expect(CAMERAS.open(town, page)).toEqual({ layers: ['cctv', 'cctv_previews'], view: { lat: 50.001, lon: 10, zoom: CAMERA_TILE_ZOOM } });
    // A country's overview asks without a page.
    expect(CAMERAS.open(town, undefined as never)).toEqual({ layers: ['cctv', 'cctv_previews'], zoom: 11 });
  });
});
