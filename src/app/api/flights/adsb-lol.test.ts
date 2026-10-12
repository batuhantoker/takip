import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ADSBLOL_MIL, TYPE_BATCHES, adsbLolTypeSnapshot, collectTypeSnapshot, fetchAdsbLolMil, resetAdsbLolSnapshot, typeBatchUrl,
} from './adsb-lol';

// Trimmed from api.adsb.lol/v2/mil, 2026-10-12.
const C17 = { hex: 'ae07e7', type: 'adsb_icao', flight: 'RCH121  ', r: '95-0104', t: 'C17', dbFlags: 1, alt_baro: 'ground', gs: 19.5, lat: 61.253155, lon: -149.816717, nac_p: 9 };
const noSleep = async () => {};
const answer = (ac: unknown[]) => new Response(JSON.stringify({ ac, msg: 'No error', total: ac.length }));

afterEach(() => {
  vi.unstubAllGlobals();
  resetAdsbLolSnapshot();
});

describe('fetchAdsbLolMil', () => {
  it('returns the ac list, or null when adsb.lol does not answer with one', async () => {
    const fetchMock = vi.fn(async () => answer([C17]));
    vi.stubGlobal('fetch', fetchMock);
    expect(await fetchAdsbLolMil()).toEqual([C17]);
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toBe(ADSBLOL_MIL);

    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })));
    expect(await fetchAdsbLolMil()).toBeNull();
  });
});

describe('collectTypeSnapshot', () => {
  it('asks every batch in order and pools the aircraft', async () => {
    const fetchMock = vi.fn(async () => answer([C17]));
    vi.stubGlobal('fetch', fetchMock);
    const snap = await collectTypeSnapshot(noSleep);
    expect(fetchMock.mock.calls.map(c => String((c as unknown[])[0]))).toEqual(TYPE_BATCHES.map(b => typeBatchUrl(b.types)));
    expect(snap.answered).toEqual(['mainline', 'regional', 'bizjet', 'ga']);
    expect(snap.ac).toHaveLength(4);
  });

  it('retries a 429 after backing off', async () => {
    let n = 0;
    vi.stubGlobal('fetch', vi.fn(async () => (++n === 2 ? new Response('', { status: 429 }) : answer([C17]))));
    const sleeps: number[] = [];
    const snap = await collectTypeSnapshot(async ms => { sleeps.push(ms); });
    expect(snap).toMatchObject({ answered: ['mainline', 'regional', 'bizjet', 'ga'], refused: [] });
    expect(sleeps).toEqual([2000, 2000, 2000, 2000, 2000]);
  });

  it('gives up after 20 s of backing off and reports what was refused and never asked', async () => {
    let n = 0;
    vi.stubGlobal('fetch', vi.fn(async () => (++n === 1 ? answer([C17]) : new Response('', { status: 429 }))));
    const sleeps: number[] = [];
    const snap = await collectTypeSnapshot(async ms => { sleeps.push(ms); });
    expect(snap).toMatchObject({ answered: ['mainline'], refused: ['regional'], skipped: ['bizjet', 'ga'], failed: [] });
    expect(sleeps).toEqual([2000, 2000, 2000, 4000, 8000]);
  });

  it('carries on past a batch that times out', async () => {
    let n = 0;
    vi.stubGlobal('fetch', vi.fn(async () => { if (++n === 1) throw new Error('timeout'); return answer([C17]); }));
    const snap = await collectTypeSnapshot(noSleep);
    expect(snap).toMatchObject({ failed: ['mainline'], answered: ['regional', 'bizjet', 'ga'], refused: [] });
  });
});

describe('adsbLolTypeSnapshot', () => {
  it('starts a background refresh and serves nothing until it lands', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => answer([C17])));
    expect(adsbLolTypeSnapshot()).toBeNull();
    await vi.waitFor(() => expect(adsbLolTypeSnapshot()).not.toBeNull(), { timeout: 10_000, interval: 50 });
  }, 15_000);
});

const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;
liveIt('reads live military aircraft', async () => {
  const ac = await fetchAdsbLolMil();
  expect(ac?.length).toBeGreaterThan(20);
}, 30_000);
