import { describe, expect, it } from 'vitest';
import { createReplayClock } from '@/lib/map/replay/clock';
import { createCountryView, MAX_PICKS } from './view';
import type { SeriesPayload } from '../series';

const at = (iso: string) => Date.parse(iso);
const settle = () => new Promise(r => setTimeout(r, 0));

const payload = (code: string, source = 'src'): SeriesPayload => ({
  metric: { code, name: code, unit: null, topic: null },
  source: { code: source, name: source, attribution: null },
  sources: [{ code: source, name: source, points: 2 }],
  values: { SWE: [[1950, 1], [2000, 3]], IND: [[1950, 2]] },
  names: {},
  years: [1950, 2000],
});

/** A view whose fetches are counted; `hold` keeps a code's answer back until released. */
function setup() {
  const clock = createReplayClock(at('1960-06-01T00:00:00Z'), { now: () => at('2026-10-12T00:00:00Z'), frame: () => 0, cancelFrame: () => {} });
  const urls: string[] = [];
  const held = new Map<string, () => void>();
  const hold = new Set<string>();
  const get = ((url: string) => {
    urls.push(url);
    const [, code, query] = /series\/([^?]+)(?:\?source=(.+))?$/.exec(decodeURIComponent(url))!;
    const answer = () => new Response(JSON.stringify(payload(code, query)), { status: 200 });
    if (!hold.has(code)) return Promise.resolve(answer());
    return new Promise<Response>(resolve => held.set(code, () => resolve(answer())));
  }) as typeof fetch;
  return { view: createCountryView(clock, get), urls, hold, release: (code: string) => held.get(code)!() };
}

const summary = (view: ReturnType<typeof setup>['view']) => ({
  coloured: view.state().status === 'off' ? null : (view.state() as { code: string }).code,
  picks: view.picks().map(p => `${p.code}:${p.status}`),
});

describe('country view picks', () => {
  it('colours the latest pick and keeps the earlier ones read beside it', async () => {
    const { view } = setup();
    view.select('a:one');
    await settle();
    view.select('a:two');
    await settle();
    expect(summary(view)).toEqual({ coloured: 'a:two', picks: ['a:one:ready', 'a:two:ready'] });
  });

  it('swaps colouring to a loaded pick without fetching it again, keeping its source', async () => {
    const { view, urls } = setup();
    view.select('a:one', 'other');
    await settle();
    view.select('a:two');
    await settle();
    const before = urls.length;
    view.select('a:one');
    expect(urls.length).toBe(before);
    const s = view.state();
    expect(s.status === 'ready' && s.data.source.code).toBe('other');
    expect(summary(view).picks).toEqual(['a:one:ready', 'a:two:ready']);
  });

  it('colours the latest of the rest when the coloured pick is dropped, and turns off after the last', async () => {
    const { view } = setup();
    for (const c of ['a:one', 'a:two', 'a:three']) view.select(c);
    await settle();
    view.remove('a:three');
    expect(summary(view)).toEqual({ coloured: 'a:two', picks: ['a:one:ready', 'a:two:ready'] });
    view.remove('a:one');
    expect(summary(view)).toEqual({ coloured: 'a:two', picks: ['a:two:ready'] });
    view.remove('a:two');
    expect(summary(view)).toEqual({ coloured: null, picks: [] });
  });

  it('makes room past the cap by dropping the oldest other pick', async () => {
    const { view } = setup();
    for (let i = 0; i <= MAX_PICKS; i++) view.select(`a:${i}`);
    await settle();
    const { coloured, picks } = summary(view);
    expect(coloured).toBe(`a:${MAX_PICKS}`);
    expect(picks).toHaveLength(MAX_PICKS);
    expect(picks[0]).toBe('a:1:ready');
  });

  it('drops every pick on select(null)', async () => {
    const { view } = setup();
    view.select('a:one');
    view.select('a:two');
    await settle();
    view.select(null);
    expect(summary(view)).toEqual({ coloured: null, picks: [] });
  });

  it('keeps loading a pick that stops colouring mid-load, and ignores one dropped mid-load', async () => {
    const { view, hold, release } = setup();
    hold.add('a:slow').add('a:gone');
    view.select('a:slow');
    view.select('a:gone');
    view.select('a:fast');
    view.remove('a:gone');
    release('a:slow');
    release('a:gone');
    await settle();
    expect(summary(view)).toEqual({ coloured: 'a:fast', picks: ['a:slow:ready', 'a:fast:ready'] });
  });

  it('puts the picks back from a snapshot, in order, with the coloured one and its source', async () => {
    const { view } = setup();
    view.select('a:one');
    view.select('a:two', 'other');
    view.select('a:three');
    view.select('a:two', 'other');
    await settle();
    const snap = view.snapshot()!;
    expect(snap).toEqual({ codes: ['a:one', 'a:two', 'a:three'], coloured: 'a:two', source: 'other' });
    view.select(null);
    view.restore(snap);
    await settle();
    expect(summary(view)).toEqual({ coloured: 'a:two', picks: ['a:one:ready', 'a:two:ready', 'a:three:ready'] });
    const s = view.state();
    expect(s.status === 'ready' && s.data.source.code).toBe('other');
  });
});
