import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('LL2 collect', () => {
  it('holds off for a while after both hosts fail, instead of retrying every minute', async () => {
    vi.resetModules();
    const fetchMock = vi.fn(async () => new Response('{"detail":"Request was throttled."}', { status: 429 }));
    vi.stubGlobal('fetch', fetchMock);
    const { collect } = await import('./route');

    await expect(collect()).rejects.toThrow('LL2 HTTP 429');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await expect(collect()).rejects.toThrow('on hold');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('tries again once the hold has passed', async () => {
    vi.resetModules();
    vi.useFakeTimers();
    const fetchMock = vi.fn(async () => new Response('', { status: 503 }));
    vi.stubGlobal('fetch', fetchMock);
    const { collect } = await import('./route');

    await expect(collect()).rejects.toThrow();
    vi.advanceTimersByTime(16 * 60_000);
    await expect(collect()).rejects.toThrow('LL2 HTTP 503');
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
