import { GeoPrec } from '@takip/db';
import { describe, expect, it } from 'vitest';
import type { Reporter } from '../context';
import type { EventBatch } from '../events';
import { assemble, EVENT_FILES } from '../fetch-events';
import { KINDS } from '../seed';
import { accidentKind, addEvents, crimeKind, disasterKind, eventPlace, gtdMatcher, localCovid, ownedElsewhere, SPECS, titleYear, unrestKind } from './wikidata-events';
import type { Row } from './wikidata';

const row = (fields: Partial<Row>): Row => ({ item: 'Q1', classes: '', ...fields });
const set = (...c: string[]) => new Set(c);

describe('wikidata events: kinds', () => {
  it('names a disaster by its gravest class, a city fire before a wildfire', () => {
    expect(disasterKind(set('Q168247', 'Q3241045'))).toBe('disaster.famine');
    expect(disasterKind(set('Q3241045'))).toBe('disaster.epidemic');
    expect(disasterKind(set('Q169950'))).toBe('disaster.wildfire');
    expect(disasterKind(set('Q169950', 'Q838718'))).toBe('disaster.fire');
    expect(disasterKind(set('Q168983'))).toBe('disaster.fire');
  });

  it('takes the kind an unrest title names when its classes give several', () => {
    // May 68: riot, student protest, general strike.
    expect(unrestKind(set('Q124757', 'Q1679887', 'Q49775'), 'May 68')).toBe('politics.riot');
    expect(unrestKind(set('Q124757', 'Q49775'), '1926 general strike')).toBe('politics.strike');
    expect(unrestKind(set('Q3588250', 'Q686984', 'Q273120'), 'George Floyd protests')).toBe('politics.protest');
    expect(unrestKind(set('Q13427116'), 'Peasants’ Revolt')).toBe('conflict.rebellion');
    expect(unrestKind(set('Q273120'), 'Boston Tea Party')).toBe('politics.protest');
  });

  it('names accidents and crimes', () => {
    expect(accidentKind(set('Q744913'))).toBe('accident.aviation');
    expect(accidentKind(set('Q1550225', 'Q179057'))).toBe('accident.mining');
    expect(accidentKind(set('Q179057'))).toBe('accident.explosion');
    expect(crimeKind(set('Q132821', 'Q21480300'))).toBe('crime.shooting');
    expect(crimeKind(set('Q132821'))).toBe('crime.murder');
  });

  it('leaves pogroms, attacks, nuclear tests and hazards to their sources, but keeps a famine typed drought', () => {
    expect(ownedElsewhere(set('Q3588250', 'Q177716'))).toMatch(/pogrom/);
    expect(ownedElsewhere(set('Q744913', 'Q19354904'))).toMatch(/attack/);
    expect(ownedElsewhere(set('Q179057', 'Q210112'))).toMatch(/nuclear/);
    expect(ownedElsewhere(set('Q838718', 'Q7944'))).toMatch(/hazard/);
    expect(ownedElsewhere(set('Q168247', 'Q43059'))).toBeNull();
  });

  it('seeds and labels every kind it writes', async () => {
    const { KINDS: labels, HISTORY_FAMILIES } = await import('../../../src/lib/history/popup');
    const seeded = new Map(KINDS.map(k => [k.code, k.family]));
    const written = ['disaster.famine', 'disaster.epidemic', 'disaster.fire', 'disaster.wildfire', 'politics.riot', 'politics.protest',
      'politics.strike', 'conflict.rebellion', 'accident.aviation', 'accident.rail', 'accident.road', 'accident.mining', 'accident.explosion',
      'accident.crowd', 'accident.industrial', 'battle.operation', 'crime.shooting', 'crime.murder'];
    for (const k of written) {
      expect(seeded.has(k), k).toBe(true);
      expect(labels[k], k).toBeTruthy();
      expect(HISTORY_FAMILIES[seeded.get(k)!], k).toBeTruthy();
    }
    expect(SPECS.map(s => `${s.name}.json`)).toEqual(EVENT_FILES.map(([f]) => f));
  });
});

describe('wikidata events: places', () => {
  it('prefers its own point, then a place, then an administrative area, then a country', () => {
    expect(eventPlace(row({ coord: 'POINT(2.35 48.85)', locs: 'Q90 - POINT(2 48)' }))).toEqual({ lon: 2.35, lat: 48.85, geoPrec: GeoPrec.exact });
    expect(eventPlace(row({ locs: 'Q84 - POINT(-0.1275 51.507222)', countries: 'Q145 POINT(-1.3 52)' }))).toEqual({ lon: -0.1275, lat: 51.507222, geoPrec: GeoPrec.area });
    expect(eventPlace(row({ admins: 'Q60 POINT(-74 40.7)' }))).toEqual({ lon: -74, lat: 40.7, geoPrec: GeoPrec.area });
    expect(eventPlace(row({ countries: 'Q145 POINT(-1.3 52)' }))).toEqual({ lon: -1.3, lat: 52, geoPrec: GeoPrec.country });
    expect(eventPlace(row({}))).toBeNull();
  });

  it("doesn't call a country or continent location an area", () => {
    expect(eventPlace(row({ locs: 'Q668 Q6256 POINT(78 22)' }))).toEqual({ lon: 78, lat: 22, geoPrec: GeoPrec.country });
    const continent = eventPlace(row({ locs: 'Q46 Q5107 POINT(15 54)' }));
    expect(continent).toMatchObject({ lon: 15, lat: 54, geoPrec: GeoPrec.approximate });
    expect(continent?.placedAt).toBeTruthy();
  });

  it('puts several places at their middle, approximate once they sprawl', () => {
    const near = eventPlace(row({ locs: 'Q1 - POINT(10 50)|Q2 - POINT(12 50)' }));
    expect(near).toMatchObject({ lon: 11, lat: 50, geoPrec: GeoPrec.area, placedAt: 'middle of the 2 places Wikidata lists' });
    expect(eventPlace(row({ countries: 'Q1014 POINT(-9.4 6.4)|Q1045 POINT(-11.8 8.5)|Q148 POINT(104 35)' }))?.geoPrec).toBe(GeoPrec.approximate);
  });
});

describe('wikidata events: rows', () => {
  it("drops a place's COVID-19 page but keeps the pandemic", () => {
    expect(localCovid(row({ item: 'Q2' }), 'COVID-19 pandemic in Molise')).toBe(true);
    expect(localCovid(row({ item: 'Q2', cause: 'COVID-19' }), 'Outbreak on the Diamond Princess')).toBe(true);
    expect(localCovid(row({ item: 'Q81068910' }), 'COVID-19 pandemic')).toBe(false);
    expect(localCovid(row({ item: 'Q3' }), '1854 Broad Street cholera outbreak')).toBe(false);
  });

  it('dates an item with no date statement by the year its description or name gives, and says so', () => {
    const base = { classes: 'Q49776', label: 'Pullman Strike', wikis: '3', coord: 'POINT(-87.6 41.7)' };
    const { added } = run([row({ ...base, desc: 'strike in 1894 in Chicago' })], SPECS[1]);
    expect(added[0]).toMatchObject({ tStart: Date.UTC(1894, 0, 1), attrs: { date_from: 'year in its Wikidata description' } });
    expect(run([row({ ...base, label: '1926 general strike' })], SPECS[1]).added[0]).toMatchObject({ attrs: { date_from: 'year in its name' } });
    expect(run([row(base)], SPECS[1]).rejects).toEqual(['no date']);
  });

  it('matches titles by letters and year', () => {
    expect(titleYear('Operation Barbarossa', Date.UTC(1941, 5, 22))).toBe(titleYear('operation  barbarossa', Date.UTC(1941, 0, 1)));
  });

  const run = (rows: Row[], spec = SPECS[0], extra: Partial<Parameters<typeof addEvents>[4]> = {}) => {
    const added: Record<string, unknown>[] = [];
    const rejects: string[] = [];
    const rep = { rows: 0, extra: {} as Record<string, unknown>, reject: (reason: string) => rejects.push(reason), sentinel: () => {} } as unknown as Reporter;
    const batch = { add: (e: Record<string, unknown>) => added.push(e) } as unknown as EventBatch;
    addEvents(batch, rep, rows, spec, { taken: new Set(), sitelinks: {}, now: Date.UTC(2026, 9, 20), ...extra });
    return { added, rejects };
  };

  it('keeps a disaster’s deaths in attrs, where GDIS’s magnitude counts places, and an operation’s as magnitude', () => {
    const fire = row({ classes: 'Q838718', label: 'Great Fire of London', t0: '1666-09-02T00:00:00Z/11', locs: 'Q84 - POINT(-0.1275 51.5)', deaths: '6//' });
    const { added } = run([fire]);
    expect(added[0]).toMatchObject({ kind: 'disaster.fire', magnitude: null, attrs: { deaths: 6 } });
    const op = row({ classes: 'Q645883', label: 'Operation X', t: '1944-06-06T00:00:00Z/11', coord: 'POINT(0 49)', deaths: '1000/800/1200' });
    expect(run([op], SPECS[3]).added[0]).toMatchObject({ kind: 'battle.operation', magnitude: 1000, attrs: { magnitude_range: [800, 1200] } });
  });

  it('turns away held items, protests without an article, future dates, and what GTD or the battles already have', () => {
    const base = { classes: 'Q273120', label: 'A protest', t: '2020-01-05T00:00:00Z/11', coord: 'POINT(13.4 52.5)' };
    expect(run([row({ ...base, item: 'Q9' })], SPECS[0], { taken: new Set(['Q9']) }).rejects).toEqual(['held by another Wikidata source']);
    expect(run([row({ ...base, wikis: '0' })], SPECS[1]).rejects).toEqual(['no Wikipedia article in any language']);
    expect(run([row({ ...base, wikis: '2', t: '2027-01-01T00:00:00Z/11' })], SPECS[1]).rejects).toEqual(['starts in the future']);
    const shooting = row({ classes: 'Q21480300', label: 'A shooting', t: '1999-04-20T00:00:00Z/11', coord: 'POINT(-105 39.6)' });
    expect(run([shooting], SPECS[4], { gtd: () => true }).rejects).toEqual(['GTD has it (an attack that day within 25 km)']);
    expect(run([{ ...shooting, t: '2019-04-20T00:00:00Z/11' }], SPECS[4], { gtd: () => true }).added).toHaveLength(1);
    const police = row({ classes: 'Q149086|Q61037771', label: 'death of X', t: '2010-01-01T00:00:00Z/11', coord: 'POINT(-118 34)' });
    expect(run([police], SPECS[2]).rejects).toEqual(['a homicide too (wikidata-crimes)']);
    expect(run([{ ...police, wikis: '0' }], SPECS[4]).rejects).toEqual(['no Wikipedia article in any language']);
    const op = row({ classes: 'Q645883', label: 'Operation Barbarossa', t: '1941-06-22T00:00:00Z/11', coord: 'POINT(30 52)' });
    expect(run([op], SPECS[3], { titles: new Set([titleYear('Operation Barbarossa', Date.UTC(1941, 0, 1))]) }).rejects).toEqual(['same title and year as a Wikidata battle or war']);
  });
});

describe('wikidata events: GTD', () => {
  const day = Date.UTC(1990, 6, 12);
  const near = gtdMatcher([
    { t: day, lon: 121.0, lat: 14.6, text: 'Bombing/Explosion — Manila' },
    { t: day, lon: 125.0, lat: 7.1, text: 'Hijacking — Davao 07/12/1990: Assailants hijacked a Philippine Airlines flight' },
  ]);

  it('takes any attack that day and place for a crime, but only one naming the thing for an accident', () => {
    expect(near(day + 3_600_000, { lon: 121.1, lat: 14.6 }, 'crime.shooting')).toBe(true);
    expect(near(day, { lon: 121.1, lat: 14.6 }, 'accident.aviation')).toBe(false);
    expect(near(day, { lon: 121.0, lat: 14.605 }, 'accident.aviation')).toBe(true);
    expect(near(day, { lon: 125.1, lat: 7.1 }, 'accident.aviation')).toBe(true);
    expect(near(day + 86_400_000, { lon: 121.0, lat: 14.6 }, 'crime.shooting')).toBe(false);
  });
});

describe('fetch-events assemble', () => {
  it('joins the parts into the rows the importer reads', () => {
    const r = assemble({
      item: 'Q1', classes: 'Q168247', otherLabels: 'ru:Голод|fr:Famine',
      locs: 'Q22890 POINT(-7.9 53.3)|Q27 POINT(-8 53)', locTypes: 'Q27 Q3624078',
      deaths: 'statement/Q1-b 900|statement/Q1-a 1000000', deathBounds: 'statement/Q1-a 500000 1500000',
    });
    expect(r).toEqual({ item: 'Q1', classes: 'Q168247', otherLabel: 'Famine', locs: 'Q22890 - POINT(-7.9 53.3)|Q27 Q3624078 POINT(-8 53)', deaths: '1000000/500000/1500000' });
  });
});
