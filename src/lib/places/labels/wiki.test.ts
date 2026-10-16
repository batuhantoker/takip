import { describe, expect, it } from 'vitest';
import { distanceKm, kindOf, namesOf, normalizeTitle, rankCandidates } from './wiki';

describe('normalizeTitle', () => {
  it('drops accents, case, parentheticals and punctuation', () => {
    expect(normalizeTitle('Réserve naturelle de Passy (France)')).toBe('reserve naturelle de passy');
    expect(normalizeTitle('Chamonix-Mont-Blanc')).toBe('chamonix mont blanc');
    expect(normalizeTitle('İstanbul')).toBe('istanbul');
  });
});

describe('namesOf', () => {
  it('puts English first, splits alternatives and drops repeats', () => {
    expect(namesOf({ name: 'Mont Blanc / Monte Bianco', name_en: 'Mont Blanc', 'name:en': 'Mont Blanc' })).toEqual(['Mont Blanc', 'Monte Bianco']);
  });
  it('ignores non-string values', () => {
    expect(namesOf({ name: 'Fatih', rank: 3, name_en: null })).toEqual(['Fatih']);
  });
});

describe('kindOf', () => {
  it('maps OpenMapTiles layers and classes', () => {
    expect(kindOf('place', 'country')).toBe('region');
    expect(kindOf('place', 'town')).toBe('place');
    expect(kindOf('water_name', 'ocean')).toBe('region');
    expect(kindOf('water_name', 'lake')).toBe('water');
    expect(kindOf('mountain_peak', 'peak')).toBe('peak');
    expect(kindOf('aerodrome_label', 'military')).toBe('airport');
    expect(kindOf('transportation_name', 'primary')).toBeNull();
  });
});

describe('rankCandidates', () => {
  const near = [
    { title: 'Fatih Mosque, Istanbul', dist: 300 },
    { title: 'Fatih', dist: 900 },
    { title: 'Fatih (disambiguation)', dist: 50 },
  ];
  it('prefers exact names, nearest first, and refuses lookalikes', () => {
    expect(rankCandidates(['Fatih'], near)).toEqual(['Fatih']);
  });
  it('accepts an article whose title starts the name', () => {
    expect(rankCandidates(['Chamonix-Mont-Blanc'], [{ title: 'Chamonix', dist: 400 }, { title: 'Mont Blanc', dist: 9000 }])).toEqual(['Chamonix']);
  });
  it('ignores a comma suffix in the title', () => {
    expect(rankCandidates(['Landstuhl'], [{ title: 'Landstuhl, Germany', dist: 200 }])).toEqual(['Landstuhl, Germany']);
  });
  it('falls back to a shared distinctive word only when asked and close', () => {
    const lodge = [{ title: 'Galata Mevlevi Lodge Museum', dist: 75 }, { title: 'Jewish Museum of Turkey', dist: 170 }];
    expect(rankCandidates(['Galata Dervish House Museum'], lodge)).toEqual([]);
    expect(rankCandidates(['Galata Dervish House Museum'], lodge, 150)).toEqual(['Galata Mevlevi Lodge Museum']);
    expect(rankCandidates(['Galata Dervish House Museum'], [{ title: 'Galata Mevlevi Lodge Museum', dist: 400 }], 150)).toEqual([]);
  });
  it('does not treat generic words as a match', () => {
    expect(rankCandidates(['Cat Museum'], [{ title: 'Jewish Museum of Turkey', dist: 90 }], 150)).toEqual([]);
  });
  it('returns nothing when no title fits', () => {
    expect(rankCandidates(['Großer Hausberg'], [{ title: 'Kaiserslautern', dist: 2000 }])).toEqual([]);
  });
});

describe('distanceKm', () => {
  it('measures great-circle distance', () => {
    expect(distanceKm({ lat: 41.01, lon: 28.97 }, { lat: 41.01, lon: 28.97 })).toBe(0);
    expect(Math.round(distanceKm({ lat: 0, lon: 0 }, { lat: 0, lon: 1 }))).toBe(111);
  });
});
