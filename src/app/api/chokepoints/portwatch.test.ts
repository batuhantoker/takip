import { describe, expect, it } from 'vitest';
import {
  buildChokepoints,
  dailyQuery,
  disruptionsQuery,
  fetchAllRows,
  groupDaily,
  parseArcgisPage,
  parseDisruptions,
  queryUrl,
  toChokepointRef,
  toDailyRow,
  toDisruption,
  DAILY_LAYER,
  PAGE_SIZE,
  PORTWATCH_BASE,
} from './portwatch';

const NOW = Date.UTC(2026, 9, 12, 20, 0);

// Verbatim attributes from the live layers, 2026-10-12.
const HORMUZ_REF = { portid: 'chokepoint6', portname: 'Strait of Hormuz', fullname: 'Strait of Hormuz', lat: 26.29685349, lon: 56.85984844 };
const DOVER_DAY = { date: '2026-10-04', portid: 'chokepoint9', portname: 'Dover Strait', n_tanker: 48, n_cargo: 122, n_total: 170, capacity_tanker: 750944, capacity: 3498567 };
const HORMUZ_26 = {
  eventid: 10000004, eventtype: 'OT', eventname: 'HORMUZ-26', alertlevel: 'RED', country: null, fromdate: 1772323200000,
  todate: null, severitytext: '', lat: 26.29685, long: 56.85985, affectedports: 'chokepoint6', year: 2019,
};
const RED_SEA = {
  eventid: 1000000, eventtype: 'OT', eventname: 'RED SEA TENSIONS', alertlevel: 'RED', country: null, fromdate: 1702684800000,
  todate: null, severitytext: null, lat: 20.31573, long: 38.73504, affectedports: 'chokepoint4; chokepoint1; chokepoint7',
};
const QUAKE = {
  eventid: 1558059, eventtype: 'EQ', eventname: 'Earthquake in Indonesia', alertlevel: 'RED', country: 'Indonesia',
  fromdate: 1786744701000, todate: 1786744701000, severitytext: 'Magnitude 7.7M, Depth:10km', lat: -8.3101, long: 121.3517,
  affectedports: 'port325',
};

describe('queries', () => {
  it('builds an ArcGIS query URL without geometry', () => {
    const url = new URL(queryUrl(DAILY_LAYER, { where: "date >= DATE '2026-06-04'", resultOffset: 1000 }));
    expect(url.origin + url.pathname).toBe(`${PORTWATCH_BASE}/Daily_Chokepoints_Data/FeatureServer/0/query`);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      f: 'json', returnGeometry: 'false', where: "date >= DATE '2026-06-04'", resultOffset: '1000',
    });
  });

  it('filters daily rows by date and disruptions by end date', () => {
    expect(dailyQuery(NOW).where).toBe("date >= DATE '2026-06-04'");
    expect(disruptionsQuery(NOW).where).toBe("todate IS NULL OR todate >= TIMESTAMP '2026-09-12 20:00:00'");
  });
});

describe('parseArcgisPage', () => {
  it('returns attributes and whether another page follows', () => {
    expect(parseArcgisPage({ features: [{ attributes: DOVER_DAY }], exceededTransferLimit: true })).toEqual({ rows: [DOVER_DAY], more: true });
    expect(parseArcgisPage({ features: [] })).toEqual({ rows: [], more: false });
  });

  it('throws on the HTTP-200 error body and on unknown shapes', () => {
    expect(() => parseArcgisPage({ error: { code: 400, message: 'Invalid query' } })).toThrow('Invalid query (400)');
    expect(() => parseArcgisPage({})).toThrow();
    expect(() => parseArcgisPage(null)).toThrow();
  });
});

describe('fetchAllRows', () => {
  it('pages by offset until the transfer limit clears', async () => {
    const urls: string[] = [];
    const pages = [
      { features: Array(PAGE_SIZE).fill({ attributes: DOVER_DAY }), exceededTransferLimit: true },
      { features: [{ attributes: DOVER_DAY }] },
    ];
    const rows = await fetchAllRows(DAILY_LAYER, { where: '1=1' }, async url => {
      urls.push(url);
      return pages[urls.length - 1];
    });
    expect(rows).toHaveLength(PAGE_SIZE + 1);
    expect(urls.map(u => new URL(u).searchParams.get('resultOffset'))).toEqual(['0', String(PAGE_SIZE)]);
  });

  it('stops on an empty page even if the server claims more', async () => {
    let calls = 0;
    const rows = await fetchAllRows(DAILY_LAYER, {}, async () => { calls++; return { features: [], exceededTransferLimit: true }; });
    expect(rows).toEqual([]);
    expect(calls).toBe(1);
  });
});

describe('reference and daily rows', () => {
  it('maps a chokepoint reference row', () => {
    expect(toChokepointRef(HORMUZ_REF)).toEqual({ id: 'chokepoint6', name: 'Strait of Hormuz', lat: 26.29685349, lng: 56.85984844 });
    expect(toChokepointRef({ ...HORMUZ_REF, lat: null })).toBeNull();
    expect(toChokepointRef({ ...HORMUZ_REF, portid: '' })).toBeNull();
  });

  it('maps a daily row, reading tanker DWT from capacity_tanker', () => {
    expect(toDailyRow(DOVER_DAY)).toEqual({
      portId: 'chokepoint9',
      transit: { date: '2026-10-04', total: 170, tanker: 48, cargo: 122, tankerCapacity: 750944 },
    });
  });

  it('accepts epoch-ms dates and drops rows without a total', () => {
    expect(toDailyRow({ ...DOVER_DAY, date: Date.UTC(2026, 9, 4) })?.transit.date).toBe('2026-10-04');
    expect(toDailyRow({ ...DOVER_DAY, n_total: null })).toBeNull();
    expect(toDailyRow({ ...DOVER_DAY, date: 'yesterday' })).toBeNull();
  });

  it('groups rows per chokepoint, oldest first', () => {
    const grouped = groupDaily([DOVER_DAY, { ...DOVER_DAY, date: '2026-10-03' }, { ...DOVER_DAY, portid: 'chokepoint1' }]);
    expect(grouped.get('chokepoint9')?.map(t => t.date)).toEqual(['2026-10-03', '2026-10-04']);
    expect(grouped.get('chokepoint1')).toHaveLength(1);
  });
});

describe('disruptions', () => {
  it('maps an open event and splits its affected ports', () => {
    expect(toDisruption(RED_SEA, NOW)).toEqual({
      id: 'portwatch-1000000',
      eventId: 1000000,
      type: 'OT',
      typeLabel: 'Other',
      name: 'RED SEA TENSIONS',
      alertLevel: 'RED',
      country: null,
      fromDate: '2023-12-16T00:00:00.000Z',
      toDate: null,
      active: true,
      severity: null,
      lat: 20.31573,
      lng: 38.73504,
      affectedPorts: ['chokepoint4', 'chokepoint1', 'chokepoint7'],
      source: 'https://portwatch.imf.org/',
    });
  });

  it('keeps open events and those ended within 30 days, newest open first', () => {
    const recentQuake = { ...QUAKE, eventid: 1, fromdate: NOW - 20 * 86_400_000, todate: NOW - 20 * 86_400_000 };
    const list = parseDisruptions([QUAKE, RED_SEA, recentQuake, HORMUZ_26], NOW);
    expect(list.map(d => [d.name, d.active])).toEqual([
      ['HORMUZ-26', true],
      ['RED SEA TENSIONS', true],
      ['Earthquake in Indonesia', false],
    ]);
  });

  it('treats an end date still in the future as active', () => {
    expect(toDisruption({ ...QUAKE, todate: NOW + 86_400_000 }, NOW)?.active).toBe(true);
  });

  it('drops events without a position', () => {
    expect(toDisruption({ ...HORMUZ_26, long: null }, NOW)).toBeNull();
  });
});

describe('buildChokepoints', () => {
  it('assesses each chokepoint, trims the series to 30 days and links disruptions', () => {
    const rows = Array.from({ length: 121 }, (_, i) => ({ ...DOVER_DAY, portid: 'chokepoint6', date: new Date(Date.UTC(2026, 5, 6) + i * 86_400_000).toISOString().slice(0, 10) }));
    const disruptions = parseDisruptions([HORMUZ_26, RED_SEA], NOW);
    const [hormuz] = buildChokepoints([toChokepointRef(HORMUZ_REF)!], groupDaily(rows), disruptions);
    expect(hormuz).toMatchObject({
      id: 'chokepoint6',
      name: 'Strait of Hormuz',
      latestDate: '2026-10-04',
      basis: 'capacity',
      ratio: 1,
      status: 'normal',
      disruptionIds: ['portwatch-10000004'],
    });
    expect(hormuz.series).toHaveLength(30);
    expect(hormuz.series[0]).toEqual({ date: '2026-09-05', total: 170, tanker: 48, cargo: 122 });
  });

  it('keeps a chokepoint with no daily rows as insufficient', () => {
    const [c] = buildChokepoints([toChokepointRef(HORMUZ_REF)!], new Map(), []);
    expect(c).toMatchObject({ status: 'insufficient', ratio: null, series: [], disruptionIds: [] });
  });
});
