import { Prec } from '@takip/core/time';
import { GeoPrec } from '@takip/db';
import { describe, expect, it } from 'vitest';
import { utc } from '../dates';
import { svToken } from '../fetch-geocoded';
import { routeOf, voyageEvent, voyageStart } from './slave-voyages';
import { apiCode, locate, lookup, nature, placeTable, spellings, type TreeNode } from './slave-voyages-places';

const node = (value: number, name: string, type: string, lon: number | null, lat: number | null, children?: TreeNode[]): TreeNode => ({ value, name, longitude: lon, latitude: lat, location_type: { name: type }, children });

const TREE: TreeNode[] = [
  node(60000, 'Africa', 'Broad Region', 9.34, 0.05, [
    node(60400, 'Gold Coast', 'Region', -1.0, 5.3, [node(60499, 'Gold Coast, port unspecified', 'Place', -1.2, 5.1), node(60415, 'Elmina', 'Place', -1.35, 5.08)]),
    node(60600, 'Bight of Biafra and Gulf of Guinea islands', 'Region', 7.0, 4.0, [node(60605, 'Bonny', 'Place', 7.15, 4.43), node(60621, 'Liverpool River', 'Place', 0, 0)]),
    node(60700, 'West Central Africa and St. Helena', 'Region', 11.19, -7.71, [node(60717, 'Congo River', 'Place', 12.4, -6.0)]),
    node(60900, 'Other Africa', 'Region', 9.34, 0.05, [node(60999, 'Africa, port unspecified', 'Place', 9.34, 0.05), node(60912, 'Windward + Ivory + Gold + Benin', 'Place', 0, 0)]),
  ]),
  node(30000, 'Caribbean', 'Broad Region', -70, 18, [node(35100, 'Jamaica', 'Region', -77.3, 18.1, [node(35105, 'Kingston', 'Place', -76.8, 17.97)])]),
  node(80000, 'Asia', 'Broad Region', 100, 10, [node(80600, 'East Asia', 'Region', 115, 30, [node(80603, 'Macau', 'Place', 113.55, 22.2)])]),
  node(90000, 'Other', 'Broad Region', 0, 0, [
    node(90200, 'Americas', 'Region', 0, 0, [node(90299, 'Americas, port unspecified', 'Place', 0, 0)]),
    node(90700, 'Non-geographical', 'Region', 0, 0, [node(90707, 'Prize (unknown place)', 'Place', 0, 0)]),
  ]),
];
const table = placeTable(TREE);
const at = (code: number | null, role = 'place') => (code === null ? null : locate(null, lookup(table, code), role));

describe('codes', () => {
  it('moves the downloads’ "Other" codes to where the site has them now', () => {
    expect(apiCode(80299)).toBe(90299);
    expect(apiCode(80707)).toBe(90707);
    expect(apiCode(60415)).toBe(60415);
    expect(lookup(table, 80299)?.name).toBe('Americas, port unspecified');
  });

  it('keeps the old meaning of a code the site has reused', () => {
    expect(lookup(table, 80603)?.name).toBe('Calcutta');
  });

  it('names each spelling the site gives', () => {
    expect(spellings('San Domingo (a) Santo Domingo')).toEqual(['San Domingo', 'Santo Domingo']);
    expect(spellings('Whydah, Ouidah')).toEqual(['Whydah', 'Ouidah']);
    expect(spellings('Vatt (location undetermined)')).toEqual(['Vatt']);
  });
});

describe('locate', () => {
  it('reads a port at city precision, a stretch at area, an unspecified port at its region', () => {
    expect(at(60605, 'principal place of purchase')).toMatchObject({ lon: 7.15, lat: 4.43, geoPrec: GeoPrec.city, placedAt: 'principal place of purchase, Bonny (SlaveVoyages’ coordinates)' });
    expect(at(60717)?.geoPrec).toBe(GeoPrec.area);
    expect(at(60499)).toMatchObject({ geoPrec: GeoPrec.approximate, placedAt: 'point SlaveVoyages gives for “Gold Coast, port unspecified”' });
  });

  it('puts "Africa, port unspecified" and a coast-spanning composite at country precision', () => {
    expect(at(60999)).toMatchObject({ geoPrec: GeoPrec.country, placedAt: 'point SlaveVoyages gives for “Africa, port unspecified”: the source records no port or region' });
    expect(nature(lookup(table, 60912)!)).toBe('broad');
    expect(at(60912)).toMatchObject({ geoPrec: GeoPrec.country, method: 'slavevoyages-region' });
  });

  it('falls back to the region when a place has no coordinates, and leaves non-places off the map', () => {
    expect(at(60621)).toMatchObject({ lon: 7.0, lat: 4.0, geoPrec: GeoPrec.approximate, method: 'slavevoyages-region' });
    expect(at(80707)).toBeNull();
    expect(at(80299)).toBeNull();
    expect(at(99801)).toBeNull();
  });
});

const row = (r: Record<string, string>) => ({ voyageid: '91789', shipname: 'Union', ...r });
const labels: Record<string, Record<number, string>> = { NationalityList: { 7: 'Great Britain' }, ParticularOutcomeList: { 1: 'Voyage completed as intended' }, VesselCapturedOutcomeList: { 14: 'Not captured' } };
const ctx = {
  node: (c: number | null) => (c === null ? undefined : lookup(table, c)),
  at,
  label: (list: string, v: string | undefined) => (v?.trim() ? (labels[list]?.[Number(v)] ?? null) : null),
};

describe('voyageStart', () => {
  it('takes the recorded departure, else the imputed year it began, else the year it arrived', () => {
    expect(voyageStart({ datedepa: '24', datedepb: '8', datedepc: '1771', yeardep: '1771' })).toEqual({ t: utc(1771, 8, 24), prec: Prec.day });
    expect(voyageStart({ datedepc: '', yeardep: '1751' })).toMatchObject({ t: utc(1751), prec: Prec.year, from: 'year the voyage began, imputed by SlaveVoyages' });
    expect(voyageStart({ yearam: '1790' })?.from).toMatch(/^year of arrival/);
    expect(voyageStart({})).toBeNull();
  });
});

describe('routeOf', () => {
  it('runs from the places of purchase to the landings, skipping continent-only points and repeats', () => {
    const r = { plac1tra: '60605', plac2tra: '60999', npafttra: '60605', sla1port: '35105' };
    expect(routeOf(r, c => at(c))).toEqual([[7.15, 4.43], [-76.8, 17.97]]);
  });
});

describe('voyageEvent', () => {
  it('is one event at the place of purchase, titled plainly, with the counts and route', () => {
    const e = voyageEvent(row({ datedepa: '24', datedepb: '8', datedepc: '1771', mjbyptimp: '60605', plac1tra: '60605', mjslptimp: '35105', sla1port: '35105', slaximp: '285', slamimp: '280', vymrtimp: '5', national: '7', fate: '1', fate3: '14', captaina: 'Pole, Charles', yearam: '1772' }), 'tast', ctx);
    if ('reject' in e) throw new Error(e.reject);
    expect(e).toMatchObject({ kind: 'slavery.voyage', sourceRecordId: 'tast:91789', title: 'Slave voyage — Union, Bonny to Kingston', lon: 7.15, lat: 4.43, geoPrec: GeoPrec.city, magnitude: 285 });
    expect(e.geom).toBeTruthy();
    expect(e.attrs).toMatchObject({ flag: 'Great Britain', captain: 'Pole, Charles', disembarked: 280, died_on_voyage: 5, outcome: 'Voyage completed as intended', captured_by: null, landed_at: 'Kingston', database: 'Trans-Atlantic' });
  });

  it('says so when the flag is imputed and the ship has no name', () => {
    const e = voyageEvent({ voyageid: '1', yeardep: '1700', mjbyptimp: '60999', natinimp: '7' }, 'iam', ctx);
    if ('reject' in e) throw new Error(e.reject);
    expect(e.title).toBe('Slave voyage — ship name not recorded, Africa');
    expect(e.attrs).toMatchObject({ flag: 'Great Britain (imputed)', database: 'Intra-American' });
    expect(e.geom).toBeNull();
  });

  it('keeps a continent-only anchor inside the box of a route it isn’t on', () => {
    const e = voyageEvent(row({ yeardep: '1700', mjbyptimp: '60999', plac1tra: '60605', sla1port: '35105' }), 'tast', ctx);
    if ('reject' in e) throw new Error(e.reject);
    expect(e.bbox).toEqual({ w: -76.8, s: 0.05, e: 9.34, n: 17.97 });
  });

  it('rejects a voyage with no place of purchase, or one that was off the map', () => {
    expect(voyageEvent(row({ yeardep: '1700' }), 'tast', ctx)).toEqual({ reject: 'no place of purchase recorded' });
    expect(voyageEvent(row({ yeardep: '1700', mjbyptimp: '80707' }), 'tast', ctx)).toEqual({ reject: 'place of purchase not a place (at sea, a prize, unknown)' });
    expect(voyageEvent(row({ yeardep: '1700', mjbyptimp: '80299' }), 'tast', ctx)).toEqual({ reject: 'place of purchase has no coordinates in SlaveVoyages’ tables' });
  });
});

describe('svToken', () => {
  it('reads the public token from the site’s runtime config', () => {
    expect(svToken('globalThis.__VOYAGES_RUNTIME_CONFIG__ = Object.freeze({apiAuthToken: "Token abc123"});')).toBe('Token abc123');
    expect(() => svToken('nothing')).toThrow();
  });
});
