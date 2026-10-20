import Database from 'better-sqlite3';
import { Prec } from '@takip/core/time';
import { GeoPrec } from '@takip/db';
import { beforeAll, describe, expect, it } from 'vitest';
import { utc } from '../dates';
import { mmCsv } from '../fetch-geocoded';
import { createSchema } from '../geo/build/schema';
import { SqliteGeoIndex } from '../geo/geo-index';
import { normName } from '../names';
import { labelNamesCountry, matchProtests, type MmProtest } from './mass-mobilization';
import { distance, parseLocation, placeProtest } from './mass-mobilization-places';

const lebanon = (s: string) => normName(s) === 'lebanon';

describe('parseLocation', () => {
  it('reads nationwide, with or without a place', () => {
    expect(parseLocation('national level', lebanon)).toMatchObject({ nationwide: true, named: 0, candidates: [] });
    expect(parseLocation('across Lebanon', lebanon).nationwide).toBe(true);
    const both = parseLocation('Beirut; national', lebanon);
    expect(both).toMatchObject({ nationwide: true, named: 1 });
    expect(both.candidates[0].name).toBe('Beirut');
    expect(parseLocation('national level  mainly in Montevideo', lebanon).candidates[0].name).toBe('Montevideo');
  });

  it('keeps a "National Assembly" a place', () => {
    const w = parseLocation('National Assembly', lebanon);
    expect(w.nationwide).toBe(false);
    expect(w.named).toBe(1);
  });

  it('splits several places and counts the vague rest', () => {
    const w = parseLocation('Quito, Guayaquil, Cuenca and other cities', lebanon);
    expect(w).toMatchObject({ named: 3, several: true });
    expect(w.candidates[0].name).toBe('Quito');
  });

  it('passes "Town, Region" as a name with its division, then alone', () => {
    const w = parseLocation('Lome, Martitime region', lebanon);
    expect(w.named).toBe(1);
    expect(w.candidates[0]).toMatchObject({ name: 'Lome', admin1: 'Martitime region' });
    expect(w.candidates.some(c => c.name === 'Lome' && !c.admin1)).toBe(true);
  });

  it('finds the town after a landmark, a double space or "in"', () => {
    expect(parseLocation('Piata Victoriei  Bucharest', lebanon).candidates.map(c => c.name)).toContain('Bucharest');
    expect(parseLocation('May 13 Square in Antananarivo', lebanon).candidates.map(c => c.name)).toContain('Antananarivo');
    const loose = parseLocation('Piata Victoriei Bucharest', lebanon).candidates.find(c => c.name === 'Bucharest');
    expect(loose?.loose).toBe(true);
  });

  it('corrects known misspellings and keeps the source spelling', () => {
    expect(parseLocation('Beruit', lebanon).candidates[0]).toMatchObject({ name: 'Beirut', from: 'Beruit' });
    expect(parseLocation('Yaound  , Central Region', lebanon).candidates[0]).toMatchObject({ name: 'Yaoundé', from: 'Yaound' });
  });

  it('marks a location that names only the country, and one that names nothing', () => {
    expect(parseLocation('southern Lebanon', lebanon)).toMatchObject({ part: true, named: 0 });
    const uni = parseLocation('American University of Lebanon', lebanon);
    expect(uni.part).toBe(true);
    expect(uni.candidates.map(c => c.name)).not.toContain('Lebanon');
    expect(parseLocation('unspecified', lebanon).given).toBe(false);
    expect(parseLocation('  ', lebanon).given).toBe(false);
  });
});

describe('distance', () => {
  it('counts edits', () => {
    expect(distance('beruit', 'beirut')).toBe(2);
    expect(distance('tegucigapa', 'tegucigalpa')).toBe(1);
  });
});

let geo: SqliteGeoIndex;
beforeAll(() => {
  const db = new Database(':memory:');
  createSchema(db);
  const place = db.prepare(`INSERT INTO place (id, source, source_id, name, kind, fcode, country, admin1, population, lon, lat) VALUES (?, 'geonames', ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const name = db.prepare(`INSERT OR IGNORE INTO place_name (name_norm, place_id, lang, name, historic) VALUES (?, ?, '', ?, 0)`);
  for (const [id, n, kind, fcode, cc, a1, pop, lon, lat] of [
    [1, 'Beirut', 'settlement', 'PPLC', 'LB', '04', 1_900_000, 35.49, 33.89],
    [2, 'Tripoli', 'settlement', 'PPLA', 'LB', '09', 230_000, 35.84, 34.43],
    [3, 'Tripoli', 'settlement', 'PPLC', 'LY', '77', 1_100_000, 13.18, 32.89],
    [4, 'Plymouth', 'settlement', 'PPL', 'US', 'MA', 60_000, -70.67, 41.96],
    [5, 'Lebanon', 'country', 'PCLI', 'LB', null, 6_000_000, 35.83, 33.83],
  ] as const) {
    place.run(id, id, n, kind, fcode, cc, a1, pop, lon, lat);
    name.run(normName(n), id, n);
  }
  db.prepare(`INSERT INTO country_info (iso2, name, geonameid) VALUES ('LB', 'Lebanon', 5)`).run();
  geo = new SqliteGeoIndex(db);
});

const beirut = { city: 'Beirut', lon: 35.5, lat: 33.89 };

describe('placeProtest', () => {
  it('places a named town by the gazetteer, with its country as context', () => {
    const at = placeProtest(geo, parseLocation('Tripoli', lebanon), ['LB'], beirut, 'Tripoli');
    expect(at).toMatchObject({ lon: 35.84, lat: 34.43, geoPrec: GeoPrec.city, method: 'named-place' });
  });

  it('puts a nationwide protest at the capital, at country precision, and says so', () => {
    const at = placeProtest(geo, parseLocation('nationwide', lebanon), ['LB'], beirut, 'nationwide');
    expect(at).toEqual({ lon: 35.5, lat: 33.89, geoPrec: GeoPrec.country, method: 'capital', placedAt: 'capital at the time (Beirut): the source gives the protest as nationwide' });
  });

  it('says when a place it names is the first of several and the protest was also nationwide', () => {
    const at = placeProtest(geo, parseLocation('Tripoli and Beirut; national', lebanon), ['LB'], beirut, 'Tripoli and Beirut; national');
    expect('placedAt' in at && at.placedAt).toBe('town the source names, Tripoli (the first of 2 places it names); the source also gives it as nationwide');
  });

  it('refuses a namesake abroad, and a location it cannot find', () => {
    expect(placeProtest(geo, parseLocation('Plymouth', lebanon), ['LB'], beirut, 'Plymouth')).toEqual({ reject: 'location names no place the gazetteer finds' });
    expect(placeProtest(geo, parseLocation('', lebanon), ['LB'], beirut, '')).toEqual({ reject: 'no location given' });
  });

  it('takes a misspelt capital as the capital', () => {
    const at = placeProtest(geo, parseLocation('Beiruth', lebanon), ['LB'], { city: 'Beirut', lon: 1, lat: 2 }, 'Beiruth');
    expect(at).toMatchObject({ method: 'capital-name', geoPrec: GeoPrec.city, placedAt: 'capital, Beirut (the source spells it “Beiruth”)' });
  });
});

describe('matchProtests', () => {
  const mm = (key: string, t: number, lon = 35.5, lat = 33.89, atCapital = false): MmProtest => ({ key, t, lon, lat, country: 'Lebanon', atCapital });
  const wd = (id: number, t: number, title = 'Beirut protest', prec: Prec = Prec.day) => ({ id, title, t, prec, lon: 35.51, lat: 33.9 });

  it('pairs a Wikidata item a day off and nearby, the closest in time', () => {
    const { pairs } = matchProtests([mm('a', utc(2019, 10, 17)), mm('b', utc(2019, 10, 18))], [wd(1, utc(2019, 10, 18))]);
    expect(pairs).toEqual([['b', 1]]);
  });

  it('leaves items two days off, far away or dated to the month', () => {
    expect(matchProtests([mm('a', utc(2019, 10, 17))], [wd(1, utc(2019, 10, 19))]).pairs).toEqual([]);
    expect(matchProtests([mm('a', utc(2019, 10, 17), 36.2, 34.4)], [wd(1, utc(2019, 10, 17))]).pairs).toEqual([]);
    expect(matchProtests([mm('a', utc(2019, 10, 17))], [wd(1, utc(2019, 10), 'x', Prec.month)]).pairs).toEqual([]);
  });

  it('pairs a nationwide protest only with an item that names the country', () => {
    const p = mm('a', utc(2019, 10, 17), 35.5, 33.89, true);
    expect(matchProtests([p], [wd(1, utc(2019, 10, 17), 'Hamra Street sit-in')]).pairs).toEqual([]);
    expect(matchProtests([p], [wd(1, utc(2019, 10, 17), '2019 Lebanese protests')]).pairs).toEqual([['a', 1]]);
  });

  it('counts two protests at the same spot on the same day as ambiguous', () => {
    expect(matchProtests([mm('a', utc(2019, 10, 17)), mm('b', utc(2019, 10, 17))], [wd(1, utc(2019, 10, 17))])).toEqual({ pairs: [], ambiguous: 1, shared: 0 });
  });

  it('gives one protest one Wikidata item, the closer one', () => {
    const r = matchProtests([mm('a', utc(2019, 10, 17))], [wd(1, utc(2019, 10, 18)), wd(2, utc(2019, 10, 17))]);
    expect(r).toEqual({ pairs: [['a', 2]], ambiguous: 0, shared: 1 });
  });
});

describe('labelNamesCountry', () => {
  it('reads the country, its adjective, and not a neighbour', () => {
    expect(labelNamesCountry('2019 Lebanese protests', 'Lebanon')).toBe(true);
    expect(labelNamesCountry('Kenyan general strike', 'Kenya')).toBe(true);
    expect(labelNamesCountry('Iraqi protests', 'Iran')).toBe(false);
    expect(labelNamesCountry('Hamra Street sit-in', 'Lebanon')).toBe(false);
  });
});

describe('mmCsv', () => {
  it('picks the table that was uploaded as CSV', () => {
    const files = [
      { dataFile: { id: 1, filename: 'mmALL_073120_csv.tab', originalFileFormat: 'text/csv' } },
      { dataFile: { id: 2, filename: 'mmALL_073120_v16.tab', originalFileFormat: 'application/x-stata-14' } },
    ];
    expect(mmCsv({ versionNumber: 5, versionMinorNumber: 1, files }).id).toBe(1);
  });
});
