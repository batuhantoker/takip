import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadCameraCatalog, mergeCameraCatalog } from './camera-catalog';
import { encodePins } from './pins';

beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
const at = (id: string) => ({ id, lat: 51.5, lng: -0.1, source: 'TfL' });
const json = (cameras: { id: string }[], pendingRegions: string[] = []) => Response.json({ ...encodePins(cameras.map(c => at(c.id))), pendingRegions });

describe('progressive camera catalogue', () => {
  it('retries only missing regions, preserving cameras already loaded', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(json([{ id: 'london' }], ['canada']))
      .mockResolvedValueOnce(json([{ id: 'ottawa' }]));
    vi.stubGlobal('fetch', fetcher);
    let cameras: { id: string | number }[] = [];
    const stop = loadCameraCatalog(batch => { cameras = mergeCameraCatalog(cameras, batch); }, vi.fn());
    await vi.advanceTimersByTimeAsync(0);
    expect(fetcher.mock.calls[0][0]).toBe('/api/cctv?region=all&format=pins');
    expect(cameras).toEqual([at('london')]);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(fetcher.mock.calls[1][0]).toBe('/api/cctv?region=canada&format=pins');
    expect(cameras).toEqual([at('london'), at('ottawa')]);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(fetcher).toHaveBeenCalledTimes(2);
    stop();
  });

  it('bounds retries of unavailable sources and retries failed initial requests', async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new Error('network down'))
      .mockImplementation(async () => json([], ['canada']));
    vi.stubGlobal('fetch', fetcher);
    const onError = vi.fn();
    const stop = loadCameraCatalog(vi.fn(), onError);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(onError).toHaveBeenCalledTimes(1);
    stop();
  });

  it('cancels queued retries when cameras are switched off', async () => {
    const fetcher = vi.fn(async () => json([], ['canada']));
    vi.stubGlobal('fetch', fetcher);
    const stop = loadCameraCatalog(vi.fn(), vi.fn());
    await vi.advanceTimersByTimeAsync(0);
    stop();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('updates duplicate camera IDs without duplicating dots', () => {
    expect(mergeCameraCatalog([{ id: 'a', name: 'old' }], [{ id: 'a', name: 'new' }, { id: 'b', name: 'second' }]))
      .toEqual([{ id: 'a', name: 'new' }, { id: 'b', name: 'second' }]);
  });
});
