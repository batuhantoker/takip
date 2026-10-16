import { GeoPrec } from '@takip/db';
import { describe, expect, it } from 'vitest';
import { REBELLION_CLASSES, WAR_CLASSES } from '../fetch';
import { KINDS } from '../seed';
import { battleMiddles, deathToll, warKind, wdPlace } from './wikidata-conflict';
import type { Row } from './wikidata';

const row = (fields: Partial<Row>): Row => ({ item: 'Q1', classes: '', ...fields });

describe('wikidata wars', () => {
  it('names the kind of war, a world war over a civil one', () => {
    expect(warKind(new Set(['Q198']))).toBe('war');
    expect(warKind(new Set(['Q198', 'Q8465']))).toBe('war.civil');
    expect(warKind(new Set(['Q21994376']))).toBe('war.independence');
    expect(warKind(new Set(['Q1006311']))).toBe('war.independence');
    expect(warKind(new Set(['Q103495', 'Q8465']))).toBe('war.world');
  });

  it('keeps a war that is also called a rebellion a war', () => {
    expect(warKind(new Set(['Q124734']))).toBe('conflict.rebellion');
    expect(warKind(new Set(['Q511866']))).toBe('conflict.rebellion');
    expect(warKind(new Set(['Q124734', 'Q198']))).toBe('war');
    expect(warKind(new Set(['Q1323212', 'Q2659056']))).toBe('war');
  });

  it('fetches the classes the kinds read', () => {
    expect(WAR_CLASSES).toEqual(expect.arrayContaining(['Q198', 'Q8465', 'Q21994376', 'Q1006311', 'Q103495']));
    expect(REBELLION_CLASSES).toContain('Q124734');
  });

  it('seeds every kind it writes', () => {
    const seeded = new Set(KINDS.map(k => k.code));
    for (const k of ['war', 'war.civil', 'conflict.rebellion', 'conflict.massacre', 'conflict.genocide', 'politics.revolution', 'politics.assassination']) {
      expect(seeded.has(k), k).toBe(true);
    }
  });
});

describe('wikidata places', () => {
  it('prefers its own point, then its location, then its country', () => {
    expect(wdPlace(row({ coord: 'Point(2.35 48.85)', locCoord: 'Point(1 1)' }))).toEqual({ lon: 2.35, lat: 48.85, geoPrec: GeoPrec.exact });
    expect(wdPlace(row({ locCoord: 'Point(30.5 50.45)', countryCoord: 'Point(31 49)' }))).toEqual({ lon: 30.5, lat: 50.45, geoPrec: GeoPrec.area });
    expect(wdPlace(row({ countryCoord: 'Point(31 49)' }))).toEqual({ lon: 31, lat: 49, geoPrec: GeoPrec.country });
    expect(wdPlace(row({}))).toBeNull();
  });

  it('puts the middle of its battles before a sampled country', () => {
    const battles = { lon: 7, lat: 49, geoPrec: GeoPrec.area, placedAt: 'middle of its battles' };
    expect(wdPlace(row({ countryCoord: 'Point(2 46)' }), battles)).toBe(battles);
    expect(wdPlace(row({ locCoord: 'Point(8 50)' }), battles)).toEqual({ lon: 8, lat: 50, geoPrec: GeoPrec.area });
  });
});

describe('wars placed by their battles', () => {
  it('takes the median of the battles under each war', () => {
    const m = battleMiddles([
      row({ item: 'B1', wars: 'W', coord: 'Point(120 14)' }),
      row({ item: 'B2', wars: 'W|V', coord: 'Point(121 15)' }),
      row({ item: 'B3', wars: 'W', locCoord: 'Point(170 60)' }),
      row({ item: 'B4', wars: 'W' }),
    ]);
    expect(m.get('W')).toEqual({ lon: 121, lat: 15, geoPrec: GeoPrec.area, placedAt: 'middle of its battles' });
    expect(m.get('V')).toMatchObject({ lon: 121, lat: 15 });
  });
});

describe('death tolls', () => {
  it('keeps the bounds a statement gives, and a bare number as is', () => {
    expect(deathToll('60000000/20000000/100000000')).toEqual({ deaths: 60000000, range: [20000000, 100000000] });
    expect(deathToll('500//')).toEqual({ deaths: 500 });
    expect(deathToll('500/500/500')).toEqual({ deaths: 500 });
    expect(deathToll('1200')).toEqual({ deaths: 1200 });
    expect(deathToll(undefined)).toBeNull();
  });
});
