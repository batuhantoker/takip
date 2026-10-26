import { describe, expect, it } from 'vitest';
import { engagedTime } from './engaged-time';
import { groupVisits } from './page-visits';

const NOW = Date.UTC(2026, 9, 26, 12);
const S = 1_000;
const MIN = 60 * S;

const view = (visitorId: string, at: number, path: string, engagedMs: number | null) => ({
  visitorId, at, path, engagedMs, locale: 'en', referrer: '', referrerPath: null, fromPath: null, campaign: null,
  country: null, region: null, city: null, latitude: null, longitude: null, browser: 'Chrome', os: 'macOS', device: 'desktop',
  known: 0, userId: null, email: null, mapSince: null, priorAt: null,
});

describe('engaged time on the pages', () => {
  // Alpha: Berlin's weather (a reload folded in) → Paris's weather → the map. Beta: Berlin, then left. Gamma: an old view, no time.
  const visits = groupVisits([
    view('v-alpha-0000000001', NOW, '/city/berlin/weather', 4 * S),
    view('v-alpha-0000000001', NOW + MIN, '/city/berlin/weather', 20 * S),
    view('v-alpha-0000000001', NOW + 2 * MIN, '/city/paris/weather', 90 * S),
    view('v-alpha-0000000001', NOW + 4 * MIN, '/', null),
    view('v-beta-00000000002', NOW, '/city/berlin', 6 * S),
    view('v-gamma-0000000003', NOW, '/compare/berlin-vs-paris/population', null),
  ]);
  const e = engagedTime(visits);

  it('collapses each place into a kind of page, with its median, mean and views under 10 s', () => {
    expect(e.kinds).toEqual([
      { kind: '/city/*/weather', views: 2, medianMs: 57 * S, meanMs: 57 * S, short: 0, landings: 1, landingMedianMs: 24 * S },
      { kind: '/city/*', views: 1, medianMs: 6 * S, meanMs: 6 * S, short: 1, landings: 1, landingMedianMs: 6 * S },
    ]);
    expect(e.all).toEqual({ views: 3, medianMs: 24 * S, meanMs: 40 * S, short: 1 });
  });

  it('times the page a visit landed on, apart for visits that left from it', () => {
    expect(e.landing).toMatchObject({ views: 2, medianMs: 15 * S, short: 1 });
    expect(e.landing.left).toMatchObject({ views: 1, medianMs: 6 * S });
    expect(e.landing.wentOn).toMatchObject({ views: 1, medianMs: 24 * S });
  });

  it('leaves out the map and counts the views that sent no time', () => {
    expect(e.untimed).toBe(1);
    expect(e.kinds.map(k => k.kind)).not.toContain('/');
  });

  it('has nothing to say about an empty range', () => {
    expect(engagedTime([])).toEqual({
      all: { views: 0, medianMs: null, meanMs: null, short: 0 }, untimed: 0,
      landing: { views: 0, medianMs: null, meanMs: null, short: 0, left: { views: 0, medianMs: null, meanMs: null, short: 0 }, wentOn: { views: 0, medianMs: null, meanMs: null, short: 0 } },
      kinds: [],
    });
  });
});
