import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CctvCamera } from './types';
import { clearLiveness, markMissingMedia, markOfflineEmbeds } from './liveness';

const offIds = (cams: CctvCamera[]) => cams.filter(c => c.offline).map(c => c.id);

const cam = (id: string, extra: Partial<CctvCamera>): CctvCamera => ({ id, lat: 37.87, lng: 32.49, name: id, city: '', country: 'Turkey', source: 'Test', ...extra });
const tvkur = (id: string) => cam(id, { stream_url: `https://player.tvkur.com/l/${id}`, stream_type: 'iframe' });
const playerIm = (kamera: string, uid: string) =>
  cam(kamera, { stream_url: `https://play.player.im/player/kamera/playif.php?kamera=${kamera}&uid=${uid}&sid=892`, stream_type: 'iframe' });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

beforeEach(() => clearLiveness());
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('markOfflineEmbeds', () => {
  it('flags tvkur channels whose status carries an error, sending the embed as Referer', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/passive1')) return json({ player: {}, error: 'Live stream status is passive' }, 404);
      if (url.endsWith('/notyet1')) return json({ player: {}, error: 'Live stream not started yet.' });
      return json({ player: {}, source: 'https://example.invalid/live.m3u8' });
    });
    vi.stubGlobal('fetch', fetchMock);

    const cams = await markOfflineEmbeds([tvkur('passive1'), tvkur('notyet1'), tvkur('onair1')]);

    expect(cams.map(c => c.id)).toEqual(['passive1', 'notyet1', 'onair1']);
    expect(offIds(cams)).toEqual(['passive1', 'notyet1']);
    expect(cams[0].stream_url).toBe('https://player.tvkur.com/l/passive1');
    const [url, init] = fetchMock.mock.calls.find(([u]) => u.endsWith('/onair1'))! as unknown as [string, RequestInit];
    expect(url).toBe('https://content.tvkur.com/l/onair1');
    expect((init.headers as Record<string, string>).Referer).toBe('https://player.tvkur.com/l/onair1');
  });

  it('leaves a channel as it was when tvkur gives no readable answer', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('/forbidden1')) return new Response('<html>403 Forbidden</html>', { status: 403 });
      throw new TypeError('fetch failed');
    }));

    const cams = [tvkur('forbidden1'), tvkur('unreachable1')];
    expect(await markOfflineEmbeds(cams)).toEqual(cams);
  });

  it('asks player.im once per account and flags every camera of a lapsed one', async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.includes('uid=529')
        ? new Response("var uyari = 'Panel Üzerinden Lütfen Playerinizi Güncelleyin...';")
        : new Response('document.write("<html lang=\\"tr\\">");var kamera = "karaburunteras";'),
    );
    vi.stubGlobal('fetch', fetchMock);

    const cams = await markOfflineEmbeds([playerIm('towncenter', '529'), playerIm('townstreet', '529'), playerIm('karaburunteras', '523')]);

    expect(offIds(cams)).toEqual(['towncenter', 'townstreet']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('leaves other cameras alone without asking anyone', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const cams = [
      cam('yt', { stream_url: 'https://www.youtube.com/embed/abc', stream_type: 'iframe' }),
      cam('hls', { stream_url: 'https://player.tvkur.com/l/notaniframe', stream_type: 'hls' }),
    ];
    expect(await markOfflineEmbeds(cams)).toEqual(cams);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('leaves a camera whose check outlasts the budget, then uses the late answer next time', async () => {
    vi.useFakeTimers();
    let answer!: (r: Response) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => { answer = resolve; })));

    const first = markOfflineEmbeds([tvkur('slow1')]);
    await vi.advanceTimersByTimeAsync(6_000);
    expect(offIds(await first)).toEqual([]);

    answer(json({ error: 'Live stream status is passive' }, 404));
    await vi.advanceTimersByTimeAsync(0);
    expect(offIds(await markOfflineEmbeds([tvkur('slow1')]))).toEqual(['slow1']);
  });

  it('never changes the list it was given', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: 'Live stream status is passive' }, 404)));
    const cams = [tvkur('passive2')];
    await markOfflineEmbeds(cams);
    expect(cams[0].offline).toBeUndefined();
  });
});

describe('markMissingMedia', () => {
  it('flags only streams and stills that answer 404, with one HEAD each', async () => {
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async url => {
      if (url.includes('gone')) return new Response(null, { status: 404 });
      if (url.includes('busy')) return new Response(null, { status: 503 });
      if (url.includes('down')) throw new TypeError('fetch failed');
      return new Response(null, { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const cams = await markMissingMedia([
      cam('gone', { stream_url: 'https://broadcast.example.invalid/memfs/gone.m3u8', stream_type: 'hls' }),
      cam('still-gone', { feed_url: 'https://live.example.invalid/gone.jpg', stream_type: 'jpg' }),
      cam('ok', { stream_url: 'https://broadcast.example.invalid/memfs/ok.m3u8', stream_type: 'hls' }),
      cam('busy', { stream_url: 'https://broadcast.example.invalid/memfs/busy.m3u8', stream_type: 'hls' }),
      cam('down', { feed_url: 'https://live.example.invalid/down.jpg', stream_type: 'jpg' }),
    ]);

    expect(offIds(cams)).toEqual(['gone', 'still-gone']);
    expect(fetchMock.mock.calls.every(([, init]) => init?.method === 'HEAD')).toBe(true);
  });
});
