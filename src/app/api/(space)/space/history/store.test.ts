import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CraftHistory } from '@/lib/space/replay/flight-history';
import { jdFromMs } from '@/lib/space/horizons';

const collectHistory = vi.fn();
vi.mock('./collect', () => ({ collectHistory: (...args: unknown[]) => collectHistory(...args) }));

const now = () => jdFromMs(Date.now());
const flight = (id: number, over: Partial<CraftHistory> = {}): CraftHistory => ({
  id, name: `Craft ${id}`, start: now() - 1000, end: now() + 2000, fetchedJd: now(),
  coarse: { t0: now() - 1000, step: 1, pos: [] }, encounters: [], phases: [], events: [], ...over,
});
const store = () => import('./store');

let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'takip-history-'));
  process.env.TAKIP_SPACE_HISTORY_DIR = directory;
  collectHistory.mockReset();
  vi.resetModules();
});

afterEach(async () => {
  delete process.env.TAKIP_SPACE_HISTORY_DIR;
  await rm(directory, { recursive: true, force: true });
});

describe('spacecraft history store', () => {
  it('keeps a fetched flight on disk for the next process', async () => {
    collectHistory.mockResolvedValue(flight(-98));
    await (await store()).fetchHistory(-98, 'New Horizons', 'interactive');
    expect(existsSync(join(directory, 'v7', '-98.json'))).toBe(true);

    vi.resetModules();
    expect((await store()).storedHistory(-98)?.name).toBe('Craft -98');
    expect(collectHistory).toHaveBeenCalledTimes(1);
  });

  it('asks Horizons once for concurrent requests, and keeps the stored flight when a refetch fails', async () => {
    const s = await store();
    collectHistory.mockResolvedValue(flight(-31));
    await Promise.all([s.fetchHistory(-31, 'Voyager 1', 'interactive'), s.fetchHistory(-31, 'Voyager 1', 'sweep')]);
    expect(collectHistory).toHaveBeenCalledTimes(1);

    collectHistory.mockResolvedValue(null);
    expect((await s.fetchHistory(-31, 'Voyager 1', 'sweep'))?.id).toBe(-31);
    collectHistory.mockRejectedValue(new Error('Horizons HTTP 503'));
    expect((await s.fetchHistory(-31, 'Voyager 1', 'sweep'))?.id).toBe(-31);
  });

  it('serves a stored flight at once and refetches an aged live one behind it, on the low-priority lane', async () => {
    const s = await store();
    collectHistory.mockResolvedValue(flight(-61, { fetchedJd: now() - 1 }));
    await s.fetchHistory(-61, 'Juno', 'interactive');
    collectHistory.mockClear().mockResolvedValue(flight(-61));

    expect(s.keptHistory(-61)?.id).toBe(-61);
    expect(collectHistory).toHaveBeenCalledWith(-61, 'Craft -61', 'sweep');
    s.keptHistory(-61);
    expect(collectHistory).toHaveBeenCalledTimes(1);
  });

  it('warms missing flights first and never refetches an ended one', async () => {
    const s = await store();
    collectHistory.mockResolvedValue(flight(-82, { end: now() - 3000, fetchedJd: now() - 400 }));
    await s.fetchHistory(-82, 'Cassini', 'interactive');
    collectHistory.mockResolvedValue(flight(-76, { fetchedJd: now() - 30 }));
    await s.fetchHistory(-76, 'Spirit', 'interactive');
    collectHistory.mockClear().mockImplementation(async (id: number) => flight(id));

    await s.warmHistories([{ id: -82, name: 'Cassini' }, { id: -76, name: 'Spirit' }, { id: -98, name: 'New Horizons' }]);
    expect(collectHistory.mock.calls.map(c => c[0])).toEqual([-98, -76]);
    expect(collectHistory.mock.calls.every(c => c[2] === 'sweep')).toBe(true);
  });
});
