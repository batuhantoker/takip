import { describe, expect, it } from 'vitest';
import { bboxView, embedHref, embedLayers, embedQuery, parseEmbedSpec, resolveWindow, type EmbedSpec } from './spec';

const NOW = Date.parse('2026-10-19T12:00:00Z');
const parse = (q: string) => parseEmbedSpec(new URLSearchParams(q), NOW);

describe('parseEmbedSpec', () => {
  it('reads the map link names, keeping only layers it knows', () => {
    expect(parse('layers=earthquakes,nope,earthquakes&lat=39&lon=35.2&zoom=5&track=satellite:25544')).toEqual({
      layers: ['earthquakes'], view: { lat: 39, lon: 35.2, zoom: 5 }, track: 'satellite:25544',
    });
  });

  it('leaves out what is malformed rather than refusing the spec', () => {
    expect(parse('lat=95&lon=10&track=plane:1&minmag=12&bbox=1,2,3')).toEqual({ layers: [] });
    expect(parse('lat=10&lon=20').view).toEqual({ lat: 10, lon: 20, zoom: 3 });
  });

  it('reads an area, across the antimeridian too', () => {
    expect(parse('bbox=-125,24,-66,50').bbox).toEqual([-125, 24, -66, 50]);
    expect(parse('bbox=172,51,-129,72').bbox).toEqual([172, 51, -129, 72]);
    expect(parse('bbox=10,50,20,40').bbox).toBeUndefined();
  });

  it('reads a relative window or fixed dates', () => {
    expect(parse('last=10y').window).toEqual({ last: { n: 10, unit: 'y' } });
    expect(parse('last=30d').window).toEqual({ last: { n: 30, unit: 'd' } });
    expect(parse('from=1926&to=2026-01-01').window).toEqual({ from: Date.UTC(1926, 0, 1), to: Date.UTC(2026, 0, 1) });
    expect(parse('from=2023-02-30').window).toBeUndefined();
    expect(parse('from=2027-01-01').window).toBeUndefined();
    expect(parse('last=0y').window).toBeUndefined();
  });

  it('reads a magnitude floor to one decimal', () => {
    expect(parse('minmag=4.55').minMag).toBe(4.6);
  });
});

describe('embedQuery', () => {
  it('writes a spec that reads back the same', () => {
    const specs: EmbedSpec[] = [
      { layers: ['earthquakes'], bbox: [26, 35.8, 45, 42.1], window: { last: { n: 100, unit: 'y' } }, minMag: 4 },
      { layers: ['sat_science'], view: { lat: 0, lon: 0, zoom: 2 }, track: 'satellite:25544' },
      { layers: ['earthquakes'], window: { from: Date.UTC(1999, 7, 17), to: Date.UTC(1999, 7, 18) } },
    ];
    for (const spec of specs) expect(parse(embedQuery(spec))).toEqual(spec);
  });

  it('keeps commas and colons readable', () => {
    expect(embedHref({ layers: ['flights', 'jets'], track: 'aircraft:4bb1c2' })).toBe('/embed?layers=flights,jets&track=aircraft:4bb1c2');
    expect(embedHref({ layers: [] })).toBe('/embed');
  });
});

describe('resolveWindow', () => {
  it('ends a relative window at the close of today, so one day shares one ask', () => {
    const end = Date.UTC(2026, 9, 20);
    expect(resolveWindow({ last: { n: 10, unit: 'y' } }, NOW)).toEqual({ from: Date.UTC(2016, 9, 20), to: end });
    expect(resolveWindow({ last: { n: 30, unit: 'd' } }, NOW + 3600_000)).toEqual({ from: end - 30 * 86_400_000, to: end });
  });
});

describe('embedLayers', () => {
  it('draws the page layers over day and night and the sky, and nothing else', () => {
    const on = Object.entries(embedLayers({ layers: ['earthquakes'] })).filter(([k, v]) => v && !k.startsWith('ships_')).map(([k]) => k);
    expect(on.sort()).toEqual(['day_night', 'earthquakes', 'sky_stars']);
  });

  it('keeps the vessel filters unless the spec names one', () => {
    expect(embedLayers({ layers: ['maritime'] }).ships_cargo).toBe(true);
    expect(embedLayers({ layers: ['maritime', 'ships_tanker'] }).ships_cargo).toBe(false);
  });

  it('under a past window, drops the layers that can only show now, and day and night', () => {
    const layers = embedLayers({ layers: ['earthquakes', 'flights'], window: { last: { n: 1, unit: 'y' } } });
    expect([layers.earthquakes, layers.flights, layers.day_night, layers.sky_stars]).toEqual([true, false, false, true]);
  });
});

describe('bboxView', () => {
  it('centres on the area, across the antimeridian too', () => {
    expect(bboxView([-125, 24, -66, 50])).toMatchObject({ lat: 37, lon: -95.5 });
    expect(bboxView([170, -20, -170, 0]).lon).toBe(-180);
    expect(bboxView([37.5, 37.8, 39.3, 39.4]).zoom).toBeGreaterThan(7);
  });
});
