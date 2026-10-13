import { describe, it, expect, vi } from 'vitest';
import { validateHost } from '@/lib/ssrf-guard';
import { IBB_HLS_PATH, fetchIbbHls, type IbbHlsResponse } from './ibb-hls';

vi.mock('@/lib/ssrf-guard', async importOriginal => {
  const real = await importOriginal<typeof import('@/lib/ssrf-guard')>();
  return { ...real, validateHost: vi.fn(real.validateHost) };
});

describe('IBB_HLS_PATH', () => {
  it('accepts a playlist and the files beside it', () => {
    expect(IBB_HLS_PATH.test('tkm2/hls/4.stream/playlist.m3u8')).toBe(true);
    expect(IBB_HLS_PATH.test('tkm2/hls/4.stream/chunklist_w120835415.m3u8')).toBe(true);
    expect(IBB_HLS_PATH.test('tkm2/hls/4.stream/media-u2impxdim_1139.ts')).toBe(true);
  });

  it('refuses anything else on the host', () => {
    for (const path of ['', 'tkm2/hls/4.stream/', 'tkm2/hls/4.stream/../../x.m3u8', '/tkm2/hls/4.stream/playlist.m3u8',
      'tkm2/hls/4.stream/playlist.m3u8?x=1', 'admin/hls/4.stream/playlist.m3u8', 'tkm2/hls/4.stream/index.html']) {
      expect(IBB_HLS_PATH.test(path), path).toBe(false);
    }
  });
});

describe('fetchIbbHls', () => {
  it('fetches nothing outside the stream paths', async () => {
    await expect(fetchIbbHls('tkm2/hls/4.stream/../../etc')).rejects.toThrow(/Not an İBB stream path/);
  });

  it('rejects, rather than crashing the process, when connect() fails at once', async () => {
    // A broadcast address fails in the connect() call itself, as a lost route does.
    vi.mocked(validateHost).mockResolvedValueOnce({ ok: true, resolved: ['255.255.255.255'] });
    await expect(fetchIbbHls('tkm2/hls/4.stream/playlist.m3u8')).rejects.toThrow();
  });
});

// Live integration test — opt in with RUN_LIVE_TESTS=1.
const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

describe('fetchIbbHls (live)', () => {
  liveIt('reaches a playlist and its newest segment', async () => {
    // Single cameras drop out for days, so take the first of several that plays.
    let dir = '';
    let playlist: IbbHlsResponse = { status: 0, body: Buffer.alloc(0) };
    for (const n of ['tkm2/hls/584', 'tkm2/hls/931', 'tkm1/hls/174', 'tkm1/hls/156', 'tkm2/hls/4']) {
      dir = `${n}.stream/`;
      playlist = await fetchIbbHls(`${dir}playlist.m3u8`);
      if (playlist.status === 200) break;
    }
    expect(playlist.status).toBe(200);
    const text = playlist.body.toString('utf8');
    expect(text).toMatch(/^#EXTM3U/);
    const name = text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#')).at(-1)!;
    expect(name).not.toMatch(/^https?:/);

    const media = name.endsWith('.m3u8') ? (await fetchIbbHls(dir + name)).body.toString('utf8') : null;
    const segment = media ? media.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#')).at(-1)! : name;
    const ts = await fetchIbbHls(dir + segment);
    expect(ts.status).toBe(200);
    expect(ts.body[0]).toBe(0x47); // MPEG-TS sync byte
  }, 40_000);
});
