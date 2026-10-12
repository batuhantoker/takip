import { describe, expect, it } from 'vitest';
import { createReplayClock } from '@/lib/replay/clock';
import { busyFrom, createCountryView } from './country-view';
import { formatAt, formatValue, msAt, readingAt, readingText, scaleFor, type SeriesPayload, type ShapePoint, yearAt } from './series';

const at = (iso: string) => Date.parse(iso);

describe('yearAt', () => {
  it('turns a time into a fractional calendar year, BCE included', () => {
    expect(yearAt(at('1950-01-01T00:00:00Z'))).toBe(1950);
    expect(yearAt(at('1950-07-02T12:00:00Z'))).toBeCloseTo(1950.5, 2);
    const d = new Date(0);
    d.setUTCFullYear(-499, 0, 1);
    expect(yearAt(d.getTime())).toBe(-499);
  });
});

describe('readingAt', () => {
  const points: ShapePoint[] = [[1950, 50], [1955, 60], [1990, 70, 'hist:SUN'], [1991, 72]];

  it('prints the recorded value in a year that has one, and moves the colour smoothly towards the next', () => {
    const r = readingAt(points, 1950.5)!;
    expect(r).toMatchObject({ kind: 'recorded', year: 1950, shown: 50, v: 50 });
    expect(readingAt(points, 1950.9)!.v).toBeCloseTo(50.8, 5);
    expect(readingAt(points, 1950.9)!.shown).toBe(50);
  });

  it('estimates between points up to ten years apart, and leaves longer gaps empty', () => {
    expect(readingAt(points, 1953.5)).toMatchObject({ kind: 'interpolated', between: [1950, 1955], v: 56 });
    expect(readingAt(points, 1970)).toBeNull();
  });

  it('keeps a lone year to itself and never extrapolates', () => {
    expect(readingAt(points, 1949.9)).toBeNull();
    expect(readingAt(points, 1991.8)).toMatchObject({ kind: 'recorded', shown: 72 });
    expect(readingAt(points, 1992.1)).toBeNull();
    expect(readingAt([[2000, 1]], 2000.1)).toMatchObject({ kind: 'recorded', shown: 1 });
  });

  it('reads a weekly series at its dates: the recorded value for half a week either side', () => {
    const weeks = ['2020-03-29', '2020-04-05', '2020-04-12'].map(d => yearAt(at(`${d}T00:00:00Z`)));
    const weekly: ShapePoint[] = [[weeks[0], 2], [weeks[1], 9], [weeks[2], 16]];
    const r = readingAt(weekly, yearAt(at('2020-04-06T12:00:00Z')), 'day')!;
    expect(r).toMatchObject({ kind: 'recorded', shown: 9, year: weeks[1] });
    expect(r.v).toBeCloseTo(10.5, 5);
    expect(readingText(r, 'deaths per million', {}, 'day')).toBe('9.0 on 5 Apr 2020');
    expect(readingAt(weekly, yearAt(at('2020-03-20T00:00:00Z')), 'day')).toBeNull();
    expect(readingAt(weekly, yearAt(at('2020-04-15T00:00:00Z')), 'day')).toMatchObject({ kind: 'recorded', shown: 16 });
    expect(readingAt(weekly, yearAt(at('2020-04-17T00:00:00Z')), 'day')).toBeNull();
  });

  it('leaves weeks more than eight weeks apart unjoined', () => {
    const far: ShapePoint[] = [[yearAt(at('2021-01-03T00:00:00Z')), 1], [yearAt(at('2021-04-04T00:00:00Z')), 5]];
    expect(readingAt(far, yearAt(at('2021-02-14T00:00:00Z')), 'day')).toBeNull();
  });

  it('carries the historical polity a value came from', () => {
    const r = readingAt(points, 1990.4)!;
    expect(r.via).toBe('hist:SUN');
    expect(readingText(r, 'years', { 'hist:SUN': 'Soviet Union' })).toBe('70.0 years in 1990 · Soviet Union value');
  });
});

describe('scaleFor', () => {
  it('is linear for bounded metrics and clips to the 2nd–98th percentile', () => {
    const values = { A: Array.from({ length: 100 }, (_, i): ShapePoint => [1900 + i, i]) };
    const s = scaleFor(values)!;
    expect(s.log).toBe(false);
    expect([s.lo, s.hi]).toEqual([2, 97]);
    expect(s.norm(-10)).toBe(0);
    expect(s.norm(49.5)).toBeCloseTo(0.5, 5);
    expect(s.norm(1000)).toBe(1);
  });

  it('goes log for heavy tails, keeping zero at the bottom', () => {
    const values = { A: [0, 1, 10, 100, 1000, 10_000, 100_000].map((v, i): ShapePoint => [2000 + i, v]) };
    const s = scaleFor(values)!;
    expect(s.log).toBe(true);
    expect(s.norm(0)).toBe(0);
    expect(s.at(1)).toBeCloseTo(s.hi, 6);
    expect(s.norm(s.at(0.5))).toBeCloseTo(0.5, 6);
  });

  it('goes log when half the values sit at the floor', () => {
    const values = { A: [0, 0, 0, 0, 0, 0, 1, 5, 20, 45].map((v, i): ShapePoint => [2020 + i / 52, v]) };
    expect(scaleFor(values)!.log).toBe(true);
  });

  it('has nothing to scale without values', () => {
    expect(scaleFor({})).toBeNull();
  });
});

describe('formatValue', () => {
  it('keeps numbers short and short units inline', () => {
    expect(formatValue(1_412_000_000, 'people')).toBe('1.41 B people');
    expect(formatValue(54.32, '%')).toBe('54.3%');
    expect(formatValue(7321, 'constant 2005 US$')).toBe('7,321');
    expect(formatValue(0.0123, null)).toBe('0.012');
  });
});

describe('formatAt', () => {
  it('prints a year, or a date for a dated series', () => {
    expect(formatAt(1950)).toBe('1950');
    expect(formatAt(yearAt(at('2020-03-11T00:00:00Z')), 'day')).toBe('11 Mar 2020');
    expect(msAt(yearAt(at('2021-07-04T00:00:00Z')))).toBeCloseTo(at('2021-07-04T00:00:00Z'), -1);
  });
});

describe('busyFrom', () => {
  it('is the year by which half the countries have started', () => {
    expect(busyFrom({ SWE: [[1751, 1]], GBR: [[1841, 1]], IND: [[1950, 1]], CHN: [[1950, 1]] })).toBe(1841);
  });
});

describe('createCountryView', () => {
  const payload: SeriesPayload = {
    metric: { code: 'owid:le_0', name: 'Life expectancy at birth', unit: 'years', topic: 'health' },
    source: { code: 'owid-le', name: 'OWID', attribution: null },
    sources: [{ code: 'owid-le', name: 'OWID', points: 3 }],
    values: { SWE: [[1751, 38], [1950, 71]], IND: [[1950, 37]], CHN: [[1950, 44]] },
    names: {},
    years: [1751, 1950],
  };
  const ok = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
  const settle = () => new Promise(r => setTimeout(r, 0));

  it('loads a metric, then moves a clock outside its years to where most countries have data', async () => {
    const clock = createReplayClock(at('2026-10-12T00:00:00Z'), { now: () => at('2026-10-12T00:00:00Z'), frame: () => 0, cancelFrame: () => {} });
    const urls: string[] = [];
    const view = createCountryView(clock, (url => { urls.push(String(url)); return ok(payload); }) as typeof fetch);
    view.select('owid:le_0');
    expect(view.state().status).toBe('loading');
    await settle();
    expect(view.state()).toMatchObject({ status: 'ready', code: 'owid:le_0' });
    expect(urls).toEqual(['/api/replay/history/series/owid%3Ale_0']);
    expect(new Date(clock.time()).getUTCFullYear()).toBe(1950);
    expect(clock.speed()).toBe(365 * 86_400);
  });

  it('leaves the clock alone inside the years, and drops a stale answer', async () => {
    const opts = { now: () => at('2026-10-12T00:00:00Z'), frame: () => 0, cancelFrame: () => {} };
    const inside = createReplayClock(at('1900-06-01T00:00:00Z'), opts);
    const view = createCountryView(inside, (() => ok(payload)) as typeof fetch);
    view.select('owid:le_0');
    await settle();
    expect(view.state().status).toBe('ready');
    expect(new Date(inside.time()).getUTCFullYear()).toBe(1900);
    expect(inside.speed()).toBe(60);

    const outside = createReplayClock(at('1960-06-01T00:00:00Z'), opts);
    const stale = createCountryView(outside, (() => ok(payload)) as typeof fetch);
    stale.select('owid:le_0');
    stale.select(null);
    await settle();
    expect(stale.state().status).toBe('off');
    expect(new Date(outside.time()).getUTCFullYear()).toBe(1960);
  });

  it('moves into a weekly series at a week a second', async () => {
    const clock = createReplayClock(at('1939-09-01T00:00:00Z'), { now: () => at('2026-10-12T00:00:00Z'), frame: () => 0, cancelFrame: () => {} });
    const jan = yearAt(at('2020-01-12T00:00:00Z'));
    const weekly: SeriesPayload = { ...payload, values: { DEU: [[jan, 0]], FRA: [[jan, 0]] }, years: [jan, jan + 0.5], step: 'day' };
    const view = createCountryView(clock, (() => ok(weekly)) as typeof fetch);
    view.select('owid:covid_weekly_deaths_pm');
    await settle();
    expect(new Date(clock.time()).toISOString().slice(0, 10)).toBe('2020-01-12');
    expect(clock.speed()).toBe(7 * 86_400);
  });

  it('reports an error from the api', async () => {
    const clock = createReplayClock(0, { now: () => 0, frame: () => 0, cancelFrame: () => {} });
    const view = createCountryView(clock, (() => Promise.resolve(new Response(JSON.stringify({ error: 'not_mappable', message: 'monthly' }), { status: 422 }))) as typeof fetch);
    view.select('fred:UNRATE');
    await settle();
    await settle();
    expect(view.state()).toEqual({ status: 'error', code: 'fred:UNRATE', message: 'monthly' });
  });
});
