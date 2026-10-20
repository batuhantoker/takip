import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Ctx, openContext } from '../context';
import { utc } from '../dates';
import { KEY_SCHEME, Resolver } from '../resolver';
import { seed, SOURCES } from '../seed';
import { NMC_METRICS, rowValues, unmappedState } from './cow-nmc';

// Rows of NMC-70-abridged.csv (NMC v7.0).
const HEADER = 'stateabb,ccode,year,milex,milper,irst,pec,tpop,upop,cinc,version'.split(',');
const ROWS = [
  'USA,2,1913,62825,155,31803,600107,97225,22596,.21991131,2025',
  'USA,2,1914,253205,166,23890,556778,99111,23340,.20636405,2025',
  'GDR,265,1990,-9,137,5339,165959,16247,4403,.0061500026,2025',
  'COS,94,2000,83000,-9,0,1107,4023,828,.00025415741,2025',
].map(line => Object.fromEntries(line.split(',').map((v, i) => [HEADER[i], v])));

const values = (row: Record<string, string>) => Object.fromEntries(rowValues(row, Number(row.year)).map(x => [x.code, x.v]));

describe('cow-nmc values', () => {
  it('puts military spending to 1913 in pounds and from 1914 in dollars, in units not thousands', () => {
    expect(values(ROWS[0])).toMatchObject({ 'cow-nmc:milex_gbp': 62_825_000, 'cow-nmc:milper': 155_000, 'cow-nmc:tpop': 97_225_000, 'cow-nmc:upop': 22_596_000 });
    expect(values(ROWS[0])).not.toHaveProperty('cow-nmc:milex_usd');
    expect(values(ROWS[1])).toMatchObject({ 'cow-nmc:milex_usd': 253_205_000, 'cow-nmc:irst': 23_890_000, 'cow-nmc:pec': 556_778_000 });
    expect(values(ROWS[1])).not.toHaveProperty('cow-nmc:milex_gbp');
  });

  it('gives CINC as a percentage of the world', () => {
    expect(values(ROWS[0])['cow-nmc:cinc']).toBeCloseTo(21.991131, 9);
  });

  it('keeps -9 as no value and COW’s zeros as zeros', () => {
    expect(values(ROWS[2])['cow-nmc:milex_usd']).toBeNull();
    expect(values(ROWS[3])).toMatchObject({ 'cow-nmc:milper': null, 'cow-nmc:irst': 0 });
  });

  it('names every metric’s unit and keeps them yearly', () => {
    expect(Object.fromEntries(NMC_METRICS.map(m => [m.code, m.unit]))).toEqual({
      'cow-nmc:milex_gbp': '£', 'cow-nmc:milex_usd': 'US$', 'cow-nmc:milper': 'people', 'cow-nmc:irst': 'tons',
      'cow-nmc:pec': 'tons of coal equivalent', 'cow-nmc:tpop': 'people', 'cow-nmc:upop': 'people', 'cow-nmc:cinc': '%',
    });
    expect(NMC_METRICS.every(m => m.granularity === 'year')).toBe(true);
  });

  it('is seeded under the COW terms', () => {
    expect(SOURCES.find(s => s.code === 'cow-nmc')).toMatchObject({ owner: 'Correlates of War Project', licence: 'cow-terms' });
  });
});

describe('cow-nmc states', () => {
  let dir: string;
  let ctx: Ctx;
  let key: (ccode: string, year: number) => string | undefined;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'cow-nmc-'));
    ctx = openContext({ dataDir: dir, quiet: true });
    await seed(ctx);
    const r = new Resolver(ctx);
    const keyOf = ctx.catalog.prepare(`SELECT value FROM core_entity_identifier WHERE entity_id = ? AND scheme_id = ?`).pluck();
    key = (ccode, year) => {
      const id = r.resolve('cow', ccode, utc(year));
      return id === undefined ? undefined : (keyOf.get(id, r.schemeId(KEY_SCHEME)) as string);
    };
  });
  afterAll(() => {
    ctx.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('sends historical states to their own polities, on 1 January of each year', () => {
    expect([key('255', 1870), key('255', 1871), key('255', 1872), key('255', 1991)]).toEqual(['hist:PRU', 'hist:PRU', 'DEU', 'DEU']);
    expect([key('260', 1980), key('265', 1980), key('300', 1900), key('315', 1980)]).toEqual(['hist:BRD', 'hist:DDR', 'hist:AUH', 'hist:CSK']);
    expect([key('365', 1917), key('365', 1918), key('365', 1923), key('365', 1991), key('365', 1992)]).toEqual(['hist:RUE', 'RUS', 'hist:SUN', 'hist:SUN', 'RUS']);
    expect([key('345', 1900), key('345', 1950), key('345', 2000), key('345', 2010)]).toEqual(['SRB', 'hist:YUG', 'hist:SCG', 'SRB']);
    expect([key('640', 1900), key('640', 1930), key('678', 1980), key('680', 1980), key('817', 1960)]).toEqual(['hist:OTT', 'TUR', 'hist:YAR', 'hist:YPR', 'hist:RVN']);
  });

  it('leaves North Vietnam unmapped rather than folding it into Viet Nam', () => {
    expect([unmappedState('816', 1954), unmappedState('816', 1975)]).toEqual(['North Vietnam, no polity in the catalog', 'North Vietnam, no polity in the catalog']);
    expect([unmappedState('816', 1976), unmappedState('817', 1960)]).toEqual([undefined, undefined]);
    expect(key('816', 1980)).toBe('VNM');
  });
});
