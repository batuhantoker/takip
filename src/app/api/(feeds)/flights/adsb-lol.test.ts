import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ADSBLOL_MIL, TYPE_BATCHES, adsbLolTypeSnapshot, collectTypeSnapshot, fetchAdsbLolMil, resetAdsbLolSnapshot, retryAfterMs,
  typeBatchUrl, withAircraftType,
} from './adsb-lol';

// Trimmed from api.adsb.lol/v2/mil, 2026-10-12.
const C17 = { hex: 'ae07e7', type: 'adsb_icao', flight: 'RCH121  ', r: '95-0104', t: 'C17', dbFlags: 1, alt_baro: 'ground', gs: 19.5, lat: 61.253155, lon: -149.816717, nac_p: 9 };
const noSleep = async () => {};
const answer = (ac: unknown[]) => new Response(JSON.stringify({ ac, msg: 'No error', total: ac.length }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
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
    expect(sleeps).toEqual([5000, 5000, 4000, 5000, 5000]);
  });

  it('waits as long as Retry-After says', async () => {
    let n = 0;
    vi.stubGlobal('fetch', vi.fn(async () => (++n === 1 ? new Response('', { status: 429, headers: { 'Retry-After': '3' } }) : answer([C17]))));
    const sleeps: number[] = [];
    await collectTypeSnapshot(async ms => { sleeps.push(ms); });
    expect(sleeps.slice(0, 2)).toEqual([5000, 3000]);
  });

  it('gives up after 20 s of backing off and reports what was refused and never asked', async () => {
    let n = 0;
    vi.stubGlobal('fetch', vi.fn(async () => (++n === 1 ? answer([C17]) : new Response('', { status: 429 }))));
    const sleeps: number[] = [];
    const snap = await collectTypeSnapshot(async ms => { sleeps.push(ms); });
    expect(snap).toMatchObject({ answered: ['mainline'], refused: ['regional'], skipped: ['bizjet', 'ga'], failed: [] });
    expect(sleeps).toEqual([5000, 5000, 4000, 8000]);
  });

  it('cools adsb.lol down after giving up, so /v2/mil is not asked either', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 429 })));
    await collectTypeSnapshot(async () => {});
    const fetchMock = vi.fn(async () => answer([C17]));
    vi.stubGlobal('fetch', fetchMock);
    expect(await fetchAdsbLolMil()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await fetchAdsbLolMil(Date.now() + 61_000)).toEqual([C17]);
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
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn(async () => answer([C17])));
    expect(adsbLolTypeSnapshot()).toBeNull();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(adsbLolTypeSnapshot()?.answered).toEqual(['mainline', 'regional', 'bizjet', 'ga']);
  });
});

describe('withAircraftType', () => {
  it('adds the type to a fresher position row without moving it', () => {
    const os = { hex: 'ae07e7', lat: 61.3, lon: -149.9, gs: 400, category_os: 0 };
    expect(withAircraftType(os, C17)).toEqual({ ...os, t: 'C17', r: '95-0104', dbFlags: 1 });
    expect(withAircraftType(os, undefined)).toBe(os);
  });
});

describe('retryAfterMs', () => {
  it('reads seconds and ignores dates and junk', () => {
    expect(retryAfterMs('3')).toBe(3000);
    expect(retryAfterMs('Wed, 21 Oct 2026 07:28:00 GMT')).toBeNull();
    expect(retryAfterMs(null)).toBeNull();
  });
});

const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;
liveIt('reads live military aircraft', async () => {
  const ac = await fetchAdsbLolMil();
  expect(ac?.length).toBeGreaterThan(20);
}, 30_000);
