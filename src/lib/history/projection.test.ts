import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createReplayClock } from '@/lib/map/replay/clock';
import { createCountryView } from './countries/view';
import { allProjectedAt, baseCode, isProjectionCode, labelAt, lastStart, mayProject, projectedAt, projectionEnd, projectionPlan, startsTogether, startText, withProjection } from './projection';
import { countryReading, readingAt, readingText, type SeriesPayload, type ShapePoint } from './series';
import { createHistorySession } from './session';

const source = { code: 'wpp-2024', name: 'UN World Population Prospects 2024', attribution: null };
const est: SeriesPayload = {
  metric: { code: 'wpp:MedianAgePop', name: 'Median age', unit: 'years', topic: 'population' },
  source,
  sources: [{ code: 'wpp-2024', name: source.name, points: 3 }],
  values: { JPN: [[2022, 48.6], [2023, 49]], NER: [[2023, 14.8]], XKX: [[2023, 30]] },
  names: {},
  years: [2022, 2023],
};
const series = (code: string, values: Record<string, ShapePoint[]>, years: [number, number]): SeriesPayload => ({
  ...est, metric: { ...est.metric, code }, values, years,
});
const proj = series('wpp:MedianAgePop.proj', { JPN: [[2024, 49.4], [2025, 49.8], [2030, 51], [2100, 53]], NER: [[2024, 15]], SSD: [[2024, 19]] }, [2024, 2100]);
const high = series('wpp:MedianAgePop.proj.high', { JPN: [[2024, 49.3], [2100, 50]] }, [2024, 2100]);
const lo = series('wpp:MedianAgePop.proj.lo', { JPN: [[2024, 49.1], [2025, 49.2]] }, [2024, 2025]);
const hi = series('wpp:MedianAgePop.proj.hi', { JPN: [[2024, 49.7], [2025, 50.4]] }, [2024, 2025]);
const LISTED = new Set(['wpp:MedianAgePop', 'wpp:MedianAgePop.proj', 'wpp:MedianAgePop.proj.high', 'wpp:MedianAgePop.proj.lo', 'wpp:MedianAgePop.proj.hi']);
const at = (iso: string) => Date.parse(iso);

describe('projection codes', () => {
  it('looks for projections only where the source publishes them', () => {
    expect(mayProject('wpp:TFR')).toBe(true);
    expect(mayProject('wpp:TFR.proj')).toBe(false);
    expect(mayProject('wdi:SP.DYN.TFRT.IN')).toBe(false);
    expect(baseCode('wpp:TFR.proj')).toBe('wpp:TFR');
    expect(baseCode('wpp:TFR.proj.high.lo')).toBe('wpp:TFR');
    expect(baseCode('wdi:SP.DYN.TFRT.IN')).toBe('wdi:SP.DYN.TFRT.IN');
    expect(isProjectionCode('wpp:CNMR.proj.zero-migration')).toBe(true);
    expect(isProjectionCode('wpp:CNMR')).toBe(false);
  });

  it('plans the scenario asked for if the catalogue lists it, with its range', () => {
    expect(projectionPlan('wpp:MedianAgePop', undefined, LISTED)).toMatchObject({
      main: 'wpp:MedianAgePop.proj', lo: 'wpp:MedianAgePop.proj.lo', hi: 'wpp:MedianAgePop.proj.hi', range: '95% prediction interval',
      scenario: { id: '' }, scenarios: [{ id: '', label: 'medium variant' }, { id: 'high', label: 'high variant' }],
    });
    const h = projectionPlan('wpp:MedianAgePop', 'high', LISTED)!;
    expect(h.main).toBe('wpp:MedianAgePop.proj.high');
    expect(h.lo).toBeUndefined();
    expect(projectionPlan('wpp:MedianAgePop', 'low', LISTED)!.main).toBe('wpp:MedianAgePop.proj');
    expect(projectionPlan('wpp:TFR', undefined, LISTED)).toBeNull();
    expect(projectionPlan('wpp:TFR', 'high', null)).toMatchObject({ main: 'wpp:TFR.proj', scenarios: [{ id: '' }] });
    expect(projectionPlan('wdi:X', undefined, LISTED)).toBeNull();
  });
});

describe('withProjection', () => {
  const plan = projectionPlan('wpp:MedianAgePop', undefined, LISTED)!;
  const joined = withProjection(est, proj, plan, { lo, hi });

  it('joins each country’s projections after its estimates and keeps where they start', () => {
    expect(joined.values.JPN).toEqual([[2022, 48.6], [2023, 49], [2024, 49.4], [2025, 49.8], [2030, 51], [2100, 53]]);
    expect(joined.values.XKX).toEqual([[2023, 30]]);
    expect(joined.values.SSD).toEqual([[2024, 19]]);
    expect(joined.years).toEqual([2022, 2100]);
    expect(joined.projection).toMatchObject({ code: 'wpp:MedianAgePop.proj', label: 'UN projection (medium variant)', short: 'UN projection', from: 2024, to: 2100, scenario: '' });
    expect(startsTogether(joined.projection!)).toBe(true);
    expect(joined.metric).toEqual(est.metric);
    expect(new Date(projectionEnd(joined.projection!)).toISOString()).toBe('2100-12-31T23:59:59.999Z');
  });

  it('lets each country start its projections where its own do', () => {
    const late = series('wpp:MedianAgePop.proj', { JPN: [[2024, 49.4]], NER: [[2009, 14]] }, [2009, 2024]);
    const mixed = withProjection(series('wpp:MedianAgePop', { NER: [[2007, 13], [2008, 13.5], [2009, 14.1], [2010, 14.2]] }, [2007, 2010]), late, plan);
    expect(mixed.values.NER).toEqual([[2007, 13], [2008, 13.5], [2009, 14]]);
    expect(mixed.projection).toMatchObject({ from: 2009, starts: { JPN: 2024, NER: 2009 } });
    expect(startsTogether(mixed.projection!)).toBe(false);
    expect(lastStart(mixed.projection!)).toBe(2024);
    expect(startText(mixed.projection!)).toBe('projected from 2009–2024 by country');
    expect(startText(joined.projection!)).toBe('projected from 2024');
    expect(projectedAt(mixed.projection, Date.UTC(2015, 0, 1))).toBe(true);
    expect(allProjectedAt(mixed.projection, Date.UTC(2015, 0, 1))).toBe(false);
    expect(allProjectedAt(mixed.projection, Date.UTC(2024, 0, 1))).toBe(true);
    expect(countryReading(mixed, 'NER', 2009.6)).toMatchObject({ projected: true });
    expect(countryReading(mixed, 'NER', 2008.6)?.projected).toBeUndefined();
  });

  it('never borrows another source’s projections', () => {
    const other = { ...est, source: { code: 'owid-pop', name: 'OWID', attribution: null } };
    expect(withProjection(other, proj, plan)).toBe(other);
  });

  it('marks a simulated past like the projections, and names each part', () => {
    const cckp = (code: string, values: Record<string, ShapePoint[]>, years: [number, number]): SeriesPayload => ({
      ...series(code, values, years), source: { code: 'wb-cckp', name: 'CCKP', attribution: null },
    });
    const listed = new Set(['cckp:hd35', 'cckp:hd35.proj', 'cckp:hd35.proj.lo', 'cckp:hd35.proj.hi']);
    const plan = projectionPlan('cckp:hd35', undefined, listed)!;
    const run = withProjection(
      cckp('cckp:hd35', { IND: [[2013, 80], [2014, 80.6]] }, [2013, 2014]),
      cckp('cckp:hd35.proj', { IND: [[2015, 81], [2100, 112]] }, [2015, 2100]),
      plan,
      { lo: cckp('cckp:hd35.proj.lo', { IND: [[2015, 70]] }, [2015, 2015]), hi: cckp('cckp:hd35.proj.hi', { IND: [[2015, 95]] }, [2015, 2015]) },
    );
    expect(run.projection).toMatchObject({ from: 2013, starts: { IND: 2013 }, simulated: { label: 'CMIP6 historical run, model median', to: 2014 } });
    const past = countryReading(run, 'IND', 2014.5)!;
    expect(past).toMatchObject({ projected: true, note: 'CMIP6 historical run, model median' });
    expect(readingText(past, 'days', {}, 'year', run.projection!.label)).toBe('80.6 days in 2014 · CMIP6 historical run, model median');
    expect(readingText(countryReading(run, 'IND', 2015.5)!, 'days', {}, 'year', run.projection!.label))
      .toBe('81.0 days in 2015 · CMIP6 model median (SSP2-4.5, middle of the road), models’ 10th–90th percentile 70.0–95.0');
    expect(labelAt(run.projection!, 2000)).toBe('CMIP6 historical run, model median');
    expect(labelAt(run.projection!, 2050)).toBe('CMIP6 model median (SSP2-4.5, middle of the road)');
  });

  it('names the scenario', () => {
    expect(withProjection(est, high, projectionPlan('wpp:MedianAgePop', 'high', LISTED)!).projection).toMatchObject({ label: 'UN projection (high variant)', scenario: 'high' });
  });

  it('holds the last estimate until the first projected year, never blending the two', () => {
    const points = joined.values.JPN;
    expect(readingAt(points, 2023.9, 'year', 2024)).toMatchObject({ kind: 'recorded', year: 2023, v: 49 });
    expect(readingAt(points, 2023.9, 'year', 2024)?.projected).toBeUndefined();
    expect(readingAt(points, 2024.1, 'year', 2024)).toMatchObject({ kind: 'recorded', year: 2024, v: 49.4, projected: true });
    expect(readingAt(points, 2028, 'year', 2024)).toMatchObject({ kind: 'interpolated', between: [2025, 2030], v: 50.4, projected: true });
    expect(countryReading(joined, 'JPN', 2050)).toBeNull();
  });

  it('says so in words, with the published range', () => {
    const r = countryReading(joined, 'JPN', 2025.5)!;
    expect(r.range).toEqual({ lo: 49.2, hi: 50.4, label: '95% prediction interval' });
    expect(readingText(r, 'years', {}, 'year', joined.projection!.label)).toBe('49.8 years in 2025 · UN projection (medium variant), 95% prediction interval 49.2–50.4');
    expect(countryReading(joined, 'NER', 2024.5)?.range).toBeUndefined();
    expect(readingText(countryReading(joined, 'JPN', 2023.5)!, 'years', {})).toBe('49.0 years in 2023');
    expect(projectedAt(joined.projection, at('2023-12-31T23:00:00Z'))).toBe(false);
    expect(projectedAt(joined.projection, at('2024-01-01T00:00:00Z'))).toBe(true);
    expect(projectedAt(est.projection, at('2050-01-01T00:00:00Z'))).toBe(false);
  });
});

const ok = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
const missing = () => Promise.resolve(new Response(JSON.stringify({ error: 'not_found' }), { status: 404 }));
const settle = () => new Promise(r => setTimeout(r, 0));
const BY_CODE: Record<string, SeriesPayload> = Object.fromEntries([est, proj, high, lo, hi].map(p => [p.metric.code, p]));
/** The api as History sees it: the catalogue, and each listed metric's series. */
const api = (listed: ReadonlySet<string> = LISTED, urls: string[] = []) => ((url: string) => {
  urls.push(url);
  const code = decodeURIComponent(url.split('/series/')[1] ?? '').split('?')[0];
  if (!code) return ok({ metrics: [...listed].map(c => ({ code: c, name: c, unit: null, topic: null, subjects: 200 })) });
  return listed.has(code) && BY_CODE[code] ? ok(BY_CODE[code]) : missing();
}) as unknown as typeof fetch;

describe('a country view with projections', () => {
  const opts = { now: () => at('2026-10-15T00:00:00Z'), frame: () => 0, cancelFrame: () => {} };
  const clock = () => createReplayClock(at('2023-03-01T00:00:00Z'), opts);

  it('fetches the projections and their range beside the estimates and opens the horizon to their end', async () => {
    const urls: string[] = [];
    const view = createCountryView(clock(), api(LISTED, urls));
    view.select('wpp:MedianAgePop.proj');
    await settle();
    expect(urls.sort()).toEqual([
      '/api/replay/history/series',
      '/api/replay/history/series/wpp%3AMedianAgePop',
      '/api/replay/history/series/wpp%3AMedianAgePop.proj',
      '/api/replay/history/series/wpp%3AMedianAgePop.proj.hi',
      '/api/replay/history/series/wpp%3AMedianAgePop.proj.lo',
    ]);
    expect(view.state()).toMatchObject({ status: 'ready', code: 'wpp:MedianAgePop', data: { projection: { from: 2024 } } });
    expect(view.projection()).toMatchObject({ from: 2024, to: 2100, range: { label: '95% prediction interval' } });
    view.select(null);
    expect(view.projection()).toBeNull();
  });

  it('switches scenario, and keeps it through a snapshot', async () => {
    const view = createCountryView(clock(), api());
    view.select('wpp:MedianAgePop');
    await settle();
    view.select('wpp:MedianAgePop', undefined, 'high');
    await settle();
    expect(view.projection()).toMatchObject({ scenario: 'high', label: 'UN projection (high variant)' });
    const snap = view.snapshot()!;
    expect(snap).toMatchObject({ coloured: 'wpp:MedianAgePop', scenario: 'high' });
    view.select(null);
    view.restore(snap);
    await settle();
    expect(view.projection()).toMatchObject({ scenario: 'high' });
  });

  it('keeps the projection while the next metric loads, and drops it for one without', async () => {
    let hold = false;
    const inner = api(new Set([...LISTED, 'wdi:X']));
    const view = createCountryView(clock(), (url => (hold ? new Promise(() => {}) : String(url).includes('wdi') ? ok({ ...est, metric: { ...est.metric, code: 'wdi:X' } }) : inner(url))) as typeof fetch);
    view.select('wpp:MedianAgePop');
    await settle();
    hold = true;
    view.select('wpp:TFR');
    expect(view.state().status).toBe('loading');
    expect(view.projection()).toMatchObject({ to: 2100 });
    hold = false;
    view.select('wdi:X');
    await settle();
    expect(view.state().status).toBe('ready');
    expect(view.projection()).toBeNull();
  });

  it('shows the estimates alone when the catalogue lists no projections for the metric', async () => {
    const view = createCountryView(clock(), api(new Set(['wpp:MedianAgePop'])));
    view.select('wpp:MedianAgePop');
    await settle();
    expect(view.state()).toMatchObject({ status: 'ready' });
    expect(view.state().status === 'ready' && view.state()).not.toHaveProperty('data.projection');
    expect(view.projection()).toBeNull();
  });
});

describe('the History clock and projections', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', () => 1);
    vi.stubGlobal('cancelAnimationFrame', () => {});
  });
  afterEach(() => vi.unstubAllGlobals());

  it('stops at today, runs to 2100 while projections are shown, and comes back when they go', async () => {
    const s = createHistorySession(Date.UTC(2023, 5, 1), api());
    s.clock.seek(Date.UTC(2060, 0, 1));
    expect(s.clock.time()).toBeLessThanOrEqual(Date.now());
    s.countries.select('wpp:MedianAgePop');
    await settle();
    s.clock.seek(Date.UTC(2060, 0, 1));
    expect(new Date(s.clock.time()).getUTCFullYear()).toBe(2060);
    s.clock.seek(Date.UTC(2200, 0, 1));
    expect(new Date(s.clock.time()).toISOString()).toBe('2100-12-31T23:59:59.999Z');
    s.countries.select(null);
    expect(s.clock.time()).toBeLessThanOrEqual(Date.now());
    expect(Date.now() - s.clock.time()).toBeLessThan(1000);
    s.dispose();
  });

  it('comes back to today when borders take the map', async () => {
    const s = createHistorySession(Date.UTC(2023, 5, 1), api());
    s.countries.select('wpp:MedianAgePop');
    await settle();
    s.clock.seek(Date.UTC(2060, 0, 1));
    s.setLayer('world-borders', true);
    expect(s.clock.time()).toBeLessThanOrEqual(Date.now());
    s.dispose();
  });
});
