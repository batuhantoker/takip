import { describe, expect, it } from 'vitest';
import {
  USGS_URL, emscUrl, mapEmscQuake, mapUsgsQuake, mergeCatalogues, parseFeatures, regionName,
  type EmscFeature, type Quake, type UsgsFeature,
} from './catalog';

// Verbatim from the USGS 2.5_day feed and the EMSC FDSN query, 2026-10-12 (same event; USGS fields trimmed).
const USGS: UsgsFeature = {
  id: 'us6000u1us',
  geometry: { coordinates: [-127.0627, 40.6928, 10] },
  properties: {
    mag: 2.8, place: '237 km W of Ferndale, California', time: 1791830041393,
    url: 'https://earthquake.usgs.gov/earthquakes/eventpage/us6000u1us',
    felt: null, alert: null, tsunami: 0, net: 'us', type: 'earthquake',
  },
};
const EMSC: EmscFeature = {
  id: '20261012_0000363',
  geometry: { coordinates: [-127.0627, 40.6928, -10.0] },
  properties: {
    time: '2026-10-12T18:34:01.393Z', flynn_region: 'OFF COAST OF NORTHERN CALIFORNIA',
    lat: 40.6928, lon: -127.0627, depth: 10.0, evtype: 'ke', auth: 'NEIC', mag: 2.8, unid: '20261012_0000363',
  },
};

describe('mapUsgsQuake', () => {
  it('maps a feed feature', () => {
    expect(mapUsgsQuake(USGS)).toEqual({
      id: 'us6000u1us', lat: 40.6928, lng: -127.0627, depth: 10, magnitude: 2.8,
      place: '237 km W of Ferndale, California', time: 1791830041393,
      url: 'https://earthquake.usgs.gov/earthquakes/eventpage/us6000u1us',
      source: 'USGS', network: 'us', tsunami: 0, type: 'earthquake', felt: null, alert: null,
    });
  });

  it('drops features without a magnitude, time or position', () => {
    expect(mapUsgsQuake({ ...USGS, properties: { ...USGS.properties, mag: null } })).toBeNull();
    expect(mapUsgsQuake({ ...USGS, properties: { ...USGS.properties, time: null } })).toBeNull();
    expect(mapUsgsQuake({ ...USGS, geometry: null })).toBeNull();
    expect(mapUsgsQuake({ ...USGS, geometry: { coordinates: [200, 10, 5] } })).toBeNull();
  });
});

describe('mapEmscQuake', () => {
  it('maps an FDSN feature, with a positive depth and a readable region', () => {
    expect(mapEmscQuake(EMSC)).toEqual({
      id: 'emsc-20261012_0000363', lat: 40.6928, lng: -127.0627, depth: 10, magnitude: 2.8,
      place: 'Off Coast of Northern California', time: Date.parse('2026-10-12T18:34:01.393Z'),
      url: 'https://www.seismicportal.eu/eventdetails.html?unid=20261012_0000363',
      source: 'EMSC', network: 'NEIC',
    });
  });

  it('keeps suspected earthquakes and drops other event types', () => {
    expect(mapEmscQuake({ ...EMSC, properties: { ...EMSC.properties, evtype: 'se' } })).not.toBeNull();
    expect(mapEmscQuake({ ...EMSC, properties: { ...EMSC.properties, evtype: 'qb' } })).toBeNull();
    expect(mapEmscQuake({ ...EMSC, properties: { ...EMSC.properties, time: 'not a date' } })).toBeNull();
  });
});

describe('regionName', () => {
  it('title-cases Flynn regions, keeping short joining words low', () => {
    expect(regionName('NEAR COAST OF NORTHERN CHILE')).toBe('Near Coast of Northern Chile');
    expect(regionName('BIO-BIO, CHILE')).toBe('Bio-Bio, Chile');
    expect(regionName('OFF COAST OF NORTHERN CALIFORNIA')).toBe('Off Coast of Northern California');
  });
});

describe('mergeCatalogues', () => {
  const usgs = mapUsgsQuake(USGS) as Quake;
  const emsc = mapEmscQuake(EMSC) as Quake;

  it('folds a twin into the USGS record and keeps the twin network', () => {
    const { quakes, twins } = mergeCatalogues([usgs], [emsc]);
    expect(twins).toBe(1);
    expect(quakes).toEqual([{
      ...usgs,
      twin: { source: 'EMSC', id: emsc.id, magnitude: 2.8, network: 'NEIC', url: emsc.url },
    }]);
  });

  it('adds EMSC events that USGS does not have, newest first', () => {
    const elsewhere = { ...emsc, id: 'emsc-x', lat: 38, lng: 23, time: usgs.time + 60_000 };
    const { quakes, twins } = mergeCatalogues([usgs], [elsewhere]);
    expect(twins).toBe(0);
    expect(quakes.map(q => q.id)).toEqual(['emsc-x', 'us6000u1us']);
  });

  it('does not pair across the time, distance or magnitude limits', () => {
    for (const shifted of [
      { ...emsc, time: usgs.time + 121_000 },
      { ...emsc, lat: usgs.lat + 0.6 },
      { ...emsc, magnitude: usgs.magnitude + 0.9 },
    ]) expect(mergeCatalogues([usgs], [shifted]).twins).toBe(0);
  });

  it('pairs only mutual nearest events in a swarm', () => {
    const a1 = { ...usgs, id: 'a1', time: 0 };
    const a2 = { ...usgs, id: 'a2', time: 60_000 };
    const b1 = { ...emsc, id: 'b1', time: 55_000 };
    const { quakes } = mergeCatalogues([a1, a2], [b1]);
    expect(quakes.find(q => q.id === 'a2')?.twin?.id).toBe('b1');
    expect(quakes.find(q => q.id === 'a1')?.twin).toBeUndefined();
  });
});

describe('emscUrl', () => {
  it('asks for the last 24 hours at M2.5+', () => {
    expect(emscUrl(Date.parse('2026-10-12T20:00:00Z'))).toBe(
      'https://www.seismicportal.eu/fdsnws/event/1/query?format=json&minmag=2.5&limit=500&starttime=2026-10-11T20:00:00',
    );
  });
});

describe('parseFeatures', () => {
  it('throws on a body without features', () => {
    expect(() => parseFeatures({}, 'EMSC')).toThrow('EMSC');
  });
});

const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;
liveIt('merges the live catalogues', async () => {
  const get = async (url: string) => (await fetch(url, { signal: AbortSignal.timeout(20_000) })).json();
  const usgsRows = parseFeatures<UsgsFeature>(await get(USGS_URL), 'USGS').map(mapUsgsQuake).filter(Boolean) as Quake[];
  const emscRows = parseFeatures<EmscFeature>(await get(emscUrl(Date.now())), 'EMSC').map(mapEmscQuake).filter(Boolean) as Quake[];
  const { quakes, twins } = mergeCatalogues(usgsRows, emscRows);
  expect(usgsRows.length).toBeGreaterThan(10);
  expect(emscRows.length).toBeGreaterThan(50);
  expect(twins).toBeGreaterThan(usgsRows.length / 2);
  expect(new Set(quakes.map(q => q.id)).size).toBe(quakes.length);
});
