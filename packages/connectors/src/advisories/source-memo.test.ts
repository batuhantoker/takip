import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { memoByKey, memoSource } from './source-memo';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-12T12:00:00Z'));
});
afterEach(() => vi.useRealTimers());

describe('memoSource', () => {
  it('serves from memory until the TTL runs out', async () => {
    const load = vi.fn().mockResolvedValueOnce('a').mockResolvedValueOnce('b');
    const get = memoSource(load, 60_000);
    expect(await get()).toMatchObject({ loaded: true, value: 'a', error: null });
    vi.advanceTimersByTime(59_000);
    expect((await get()).value).toBe('a');
    vi.advanceTimersByTime(2_000);
    expect((await get()).value).toBe('b');
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('reports a first failure as not loaded, and waits before retrying', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('HTTP 503')).mockResolvedValueOnce('ok');
    const get = memoSource(load, 60_000, 10_000);
    expect(await get()).toMatchObject({ loaded: false, value: undefined, error: 'HTTP 503' });
    expect((await get()).error).toBe('HTTP 503');
    expect(load).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(10_000);
    expect(await get()).toMatchObject({ loaded: true, value: 'ok', error: null });
  });

  it('keeps the last good value through a failed refresh', async () => {
    const load = vi.fn().mockResolvedValueOnce('good').mockRejectedValueOnce(new Error('timeout'));
    const get = memoSource(load, 1_000);
    await get();
    vi.advanceTimersByTime(1_000);
    expect(await get()).toMatchObject({ loaded: true, value: 'good', error: 'timeout' });
  });

  it('shares one load between concurrent callers', async () => {
    const load = vi.fn().mockResolvedValue('x');
    const get = memoSource(load, 1_000);
    await Promise.all([get(), get(), get()]);
    expect(load).toHaveBeenCalledTimes(1);
  });
});

describe('memoByKey', () => {
  it('memoises each key on its own, including a null answer', async () => {
    const load = vi.fn(async (k: string) => (k === 'GB' ? null : k));
    const get = memoByKey(load, 60_000);
    expect((await get('UA')).value).toBe('UA');
    expect(await get('GB')).toMatchObject({ loaded: true, value: null });
    await get('GB');
    expect(load).toHaveBeenCalledTimes(2);
  });
});
