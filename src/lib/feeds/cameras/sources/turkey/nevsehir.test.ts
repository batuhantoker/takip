import { describe, expect, it } from 'vitest';
import {
  NEVSEHIR_BOUNDS, fetchNevsehirCameras, loadNevsehirCameras, mapNevsehirCard, mapNevsehirCards, parseNevsehirCards,
} from './nevsehir';

// Verbatim from https://belsis.nevsehir.bel.tr/kameracanli/canli (2026-10-19), two of four cards, indentation trimmed.
const PAGE = `
<div class="grid" id="grid">
    <div class="card cam" data-key="X8o7aXINdylwjstgvjyPjSJn" data-name="Meydan - PTZ"
        data-thumb="">
        <div class="thumb  has-ph ">
            <div class="skel"></div>
            <div class="grad"></div>
            <button type="button" class="watch" data-open data-open>İzle</button>
        </div>
        <div class="meta">
            <h3 class="name" title="Meydan - PTZ">Meydan - PTZ</h3>
        </div>
    </div>
    <div class="card cam" data-key="3YMi7G2HrU4bK7FITLRKJQZN" data-name="Kayaşehir - PTZ"
        data-thumb="">
        <div class="thumb  has-ph ">
            <div class="skel"></div>
            <div class="grad"></div>
            <button type="button" class="watch" data-open data-open>İzle</button>
        </div>
        <div class="meta">
            <h3 class="name" title="Kayaşehir - PTZ">Kayaşehir - PTZ</h3>
        </div>
    </div>
</div>
<script>
    const BASE = "https://belsis.nevsehir.bel.tr/hls/live"; // /hls/live/<key>/index.m3u8
</script>
`;

const SABIT = { key: 'wWJLT6Oldt7negopFoOmJYPm', name: 'Kayaşehir - Sabit' };

describe('parseNevsehirCards', () => {
  it('reads each card key and name in page order', () => {
    expect(parseNevsehirCards(PAGE)).toEqual([
      { key: 'X8o7aXINdylwjstgvjyPjSJn', name: 'Meydan - PTZ' },
      { key: '3YMi7G2HrU4bK7FITLRKJQZN', name: 'Kayaşehir - PTZ' },
    ]);
  });

  it('drops repeated cards and finds nothing in a page without them', () => {
    expect(parseNevsehirCards(PAGE + PAGE)).toHaveLength(2);
    expect(parseNevsehirCards('<main><h1>Canlı Yayınlar</h1></main>')).toEqual([]);
  });
});

describe('mapNevsehirCard', () => {
  it('maps a placed card to its stream and the city page', () => {
    expect(mapNevsehirCard({ key: '3YMi7G2HrU4bK7FITLRKJQZN', name: 'Kayaşehir - PTZ' })).toEqual({
      id: 'tr-nevsehir-3YMi7G2HrU4bK7FITLRKJQZN',
      lat: 38.62028,
      lng: 34.71445,
      name: 'Kayaşehir - PTZ',
      city: 'Nevşehir',
      country: 'Turkey',
      stream_url: 'https://belsis.nevsehir.bel.tr/hls/live/3YMi7G2HrU4bK7FITLRKJQZN/index.m3u8',
      stream_type: 'hls',
      external_url: 'https://canli.nevsehir.bel.tr/',
      source: 'Nevşehir Belediyesi',
    });
  });

  it('leaves out cameras it cannot place, and bad keys', () => {
    expect(mapNevsehirCard({ key: 'X8o7aXINdylwjstgvjyPjSJn', name: 'Meydan - PTZ' })).toBeNull();
    expect(mapNevsehirCard({ key: '../../x', name: 'Kayaşehir - PTZ' })).toBeNull();
    expect(mapNevsehirCard(SABIT, -1)).toBeNull();
    expect(mapNevsehirCard(SABIT, 1000)).toBeNull();
  });

  it('spreads cameras at one place onto distinct points inside the bounds', () => {
    const [a, b] = mapNevsehirCards([...parseNevsehirCards(PAGE), SABIT]);
    expect(a.id).toBe('tr-nevsehir-3YMi7G2HrU4bK7FITLRKJQZN');
    expect(b.id).toBe('tr-nevsehir-wWJLT6Oldt7negopFoOmJYPm');
    expect(a.lng).not.toBe(b.lng);
    const bb = NEVSEHIR_BOUNDS;
    expect(b.lat > bb.minLat && b.lat < bb.maxLat && b.lng > bb.minLng && b.lng < bb.maxLng).toBe(true);
  });
});

describe('loadNevsehirCameras', () => {
  const page = (body: string, status = 200) => async (url: string, method: 'GET' | 'HEAD') =>
    url.endsWith('/kameracanli/canli') && method === 'GET' ? { status, body } : { status: 404, body: '' };

  it('flags a camera off air only when its playlist answers 404', async () => {
    const off = await loadNevsehirCameras(page(PAGE));
    expect(off.map(c => [c.id, c.offline])).toEqual([['tr-nevsehir-3YMi7G2HrU4bK7FITLRKJQZN', true]]);

    const unsure = await loadNevsehirCameras(async (url, method) => {
      if (method === 'GET') return { status: 200, body: PAGE };
      throw new Error('socket hang up');
    });
    expect(unsure[0].offline).toBeUndefined();
  });

  it('throws rather than returning nothing', async () => {
    await expect(loadNevsehirCameras(page('Bad Gateway', 502))).rejects.toThrow('HTTP 502');
    await expect(loadNevsehirCameras(page('<main></main>'))).rejects.toThrow('no camera cards');
    const unplaced = PAGE.replace('Kayaşehir - PTZ', 'Otogar - PTZ');
    await expect(loadNevsehirCameras(page(unplaced))).rejects.toThrow('none of the listed cameras is placed');
  });
});

// Live integration test — opt in with RUN_LIVE_TESTS=1.
const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

describe('fetchNevsehirCameras (live)', () => {
  liveIt('reads the city camera page', async () => {
    const cams = await fetchNevsehirCameras();
    expect(cams.length).toBeGreaterThan(0);
    for (const c of cams) {
      expect(c.id).toMatch(/^tr-nevsehir-[A-Za-z0-9]+$/);
      expect(c.stream_url).toMatch(/^https:\/\/belsis\.nevsehir\.bel\.tr\/hls\/live\/[A-Za-z0-9]+\/index\.m3u8$/);
    }
  }, 30_000);
});
