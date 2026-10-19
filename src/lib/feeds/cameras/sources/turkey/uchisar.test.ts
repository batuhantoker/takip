import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearLiveness } from '@/lib/feeds/cameras/liveness';
import { UCHISAR_CHANNELS, fetchUchisarCameras, mapUchisarChannel } from './uchisar';

const MERKEZ = UCHISAR_CHANNELS[0];

describe('mapUchisarChannel', () => {
  it('maps a channel to its playlist and the municipality page that plays it', () => {
    expect(mapUchisarChannel(MERKEZ)).toEqual({
      id: 'tr-uchisar-uchisar1',
      lat: 38.62824,
      lng: 34.80361,
      name: 'Uçhisar Merkez',
      city: 'Uçhisar',
      country: 'Turkey',
      stream_url: 'https://player.rade.com.tr/live/uchisar1.stream/playlist.m3u8',
      stream_type: 'hls',
      external_url: 'https://www.uchisar.bel.tr/uchisar-canli-kamera-merkez/',
      source: 'Uçhisar Belediyesi',
    });
  });

  it('drops malformed channels and positions outside the bounds', () => {
    expect(mapUchisarChannel({ ...MERKEZ, stream: '../x' })).toBeNull();
    expect(mapUchisarChannel({ ...MERKEZ, lng: 34.71 })).toBeNull();
  });
});

describe('fetchUchisarCameras', () => {
  beforeEach(() => clearLiveness());
  afterEach(() => vi.unstubAllGlobals());

  it('flags a channel off air when its playlist answers 404, and keeps a running one on air', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 404 })));
    expect((await fetchUchisarCameras()).every(c => c.offline)).toBe(true);
    clearLiveness();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 200 })));
    expect((await fetchUchisarCameras()).some(c => c.offline)).toBe(false);
  });
});

// Live integration test — opt in with RUN_LIVE_TESTS=1.
const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

describe('fetchUchisarCameras (live)', () => {
  liveIt('lists every channel', async () => {
    const cams = await fetchUchisarCameras();
    expect(cams).toHaveLength(UCHISAR_CHANNELS.length);
  }, 30_000);
});
