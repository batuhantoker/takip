import { describe, expect, it } from 'vitest';
import { createTranslator } from '@/lib/core/i18n/translator';
import { hikingKm, isNamedRoute, type HikingRoute, type HikingRow } from './hiking-data';
import { hikingFacts, hikingIndexable, hikingStory, kmText, renderHikingStory, routeName } from './hiking-facts';

const EN = createTranslator('en', {});

// Trimmed from what tools/site/topics/hiking.ts found on 2026-10-19.
const ROUTES: Record<string, HikingRoute> = {
  8448513: { net: 'NAT', name: 'Jakobswege Bayern', km: 3679, stages: 61 },
  15455926: { net: 'REG', name: 'Münchner Jakobskirchenweg', km: 108, operator: 'Spirituelles Zentrum St. Martin' },
  1744872: { net: 'REG', name: 'Würmsee-Inntal-Weitwanderweg (weiß auf blau)', ref: 'WIW-B', km: 111, from: 'Berg / Starnberger See', to: 'Wasserburg / Inn' },
  1736379: { net: 'INT', name: 'Traumpfad München-Venedig', km: 537 },
  2084475: { net: 'LOC', name: 'Natur-Wanderweg Sauerlach', ref: 'NWW', km: 23, approx: true },
  1230368: { net: 'REG', name: 'Sheffield Country Walk', km: 89 },
  4139041: { net: 'REG', name: 'Trans-Pennine Trail', km: 452, from: 'Southport', to: 'Hull', stages: 15 },
  1175728: { net: 'INT', ref: 'E8', km: 6337, operator: 'ERA-FERP-EWV', stages: 44 },
  68834: { net: 'LOC', name: 'Chesterfield Round Walk', km: 53 },
  2120111: { net: 'REG', name: 'Zürichsee Rundweg', ref: '84', km: 125, operator: 'Wanderland Schweiz', stages: 10 },
  12988850: { net: 'REG', name: 'Zürich-Zugerland-Panoramaweg', ref: '47', km: 34, operator: 'Wanderland Schweiz', from: 'Zürich (Triemli)', to: 'Zug', stages: 2 },
  2271424: { net: 'REG', name: 'Freiämterweg', km: 173, operator: 'Erlebnis Freiamt Muri' },
  15764196: { net: 'AL1', name: 'Limmatuferweg Agglopark', km: 28, operator: 'Zürcher Wanderwege; Aargauer Wanderwege', from: 'Zürich HB', to: 'Baden' },
  15713386: { net: 'REG', name: 'Via Natura', ref: 'Natur', km: 48, operator: 'Zürcher Wanderwege', from: 'Naturzentrum Neeracherried', to: 'Sihlwald', stages: 7 },
  91: { net: 'LOC', ref: '3', km: 4.2, approx: true },
  92: { net: 'LOC', name: 'Rundweg Am Berg', km: 6.1, approx: true },
};

const MUNICH: HikingRow = {
  r: 30, n: { int: 2, nat: 3, reg: 9, loc: 117 }, named: 127, kmIn: { int: 45, nat: 160, reg: 275, loc: 740 }, shortLocal: 87,
  top: [[8448513, 135], [15455926, 107], [1744872, 75], [1736379, 41], [2084475, 23]],
};
const SHEFFIELD: HikingRow = {
  r: 20, n: { int: 1, nat: 0, reg: 6, loc: 48 }, named: 53, kmIn: { int: 35, nat: 0, reg: 249, loc: 387 }, shortLocal: 30,
  top: [[1230368, 88], [4139041, 62], [1175728, 35], [68834, 32]],
};
const ZURICH: HikingRow = {
  r: 18, n: { int: 1, nat: 3, reg: 9, loc: 558 }, named: 569, kmIn: { int: 20, nat: 75, reg: 216, loc: 2826 }, shortLocal: 446, capped: true,
  top: [[2271424, 61], [2120111, 56], [12988850, 24], [15713386, 21], [15764196, 21]],
};
const REGIONAL: HikingRow = {
  r: 15, n: { int: 0, nat: 0, reg: 2, loc: 3 }, named: 4, kmIn: { int: 0, nat: 0, reg: 40, loc: 12 }, shortLocal: 1,
  top: [[1230368, 30], [15455926, 10], [92, 6.1], [91, 4.2]],
};
const THIN: HikingRow = {
  r: 15, n: { int: 0, nat: 0, reg: 0, loc: 2 }, named: 1, kmIn: { int: 0, nat: 0, reg: 0, loc: 10.3 }, shortLocal: 2,
  top: [[92, 6.1], [91, 4.2]],
};

const story = (row: HikingRow) => renderHikingStory(hikingStory(row, ROUTES), 'Here', EN);

describe('hikingFacts', () => {
  it('totals the row and resolves its routes', () => {
    const f = hikingFacts(MUNICH, ROUTES);
    expect(f).toMatchObject({ r: 30, total: 131, kmIn: 1220, leading: 'loc', capped: false, shortLocal: 87 });
    expect(f.routes.map(r => r.id)).toEqual([8448513, 15455926, 1744872, 1736379, 2084475]);
    expect(f.routes[3]).toMatchObject({ level: 'int', kmIn: 41, km: 537 });
  });

  it('takes the longest single route, not a network', () => {
    expect(hikingFacts(MUNICH, ROUTES).longest?.name).toBe('Traumpfad München-Venedig');
    expect(hikingFacts(SHEFFIELD, ROUTES).longest?.name).toBe('Sheffield Country Walk');
  });

  it('counts operators, splitting shared ones', () => {
    expect(hikingFacts(ZURICH, ROUTES).operators).toEqual([
      { name: 'Wanderland Schweiz', routes: 2 },
      { name: 'Zürcher Wanderwege', routes: 2 },
      { name: 'Aargauer Wanderwege', routes: 1 },
      { name: 'Erlebnis Freiamt Muri', routes: 1 },
    ]);
  });

  it('lists a route mapped twice under one name once', () => {
    const twice = { ...ROUTES, 93: { ...ROUTES[92] } };
    expect(hikingFacts({ ...THIN, top: [[92, 6.1], [93, 6.1], [91, 4.2]] }, twice).routes.map(r => r.id)).toEqual([92, 91]);
  });

  it('skips a top route missing from the table', () => {
    expect(hikingFacts({ ...THIN, top: [[999, 3], [92, 6.1]] }, ROUTES).routes.map(r => r.id)).toEqual([92]);
  });
});

describe('hikingStory', () => {
  it('tells Munich by its trail to Venice and its pilgrim network', () => {
    expect(story(MUNICH)).toEqual([
      '131 waymarked hiking routes run within 30 km of Here: 2 international, 3 national, 9 regional and 117 local.',
      '5 national and international routes pass within 30 km, among them Traumpfad München-Venedig (537 km).',
      'Jakobswege Bayern passes through Here: 61 sections with 3,679 km mapped in all, 135 km of them within 30 km.',
      'Most of the 117 local routes are short walks: 87 of them are under 10 km.',
    ]);
  });

  it('tells Sheffield by its networks and its own country walk', () => {
    expect(story(SHEFFIELD)).toEqual([
      '55 waymarked hiking routes run within 20 km of Here: 1 international, 6 regional and 48 local.',
      'Trans-Pennine Trail passes through Here: 15 sections with 452 km mapped in all, 62 km of them within 20 km.',
      'E8 passes through Here: 44 sections with 6,337 km mapped in all, 35 km of them within 20 km.',
      'Sheffield Country Walk has more of its length here than any other route: 88 km within 20 km.',
      'Most of the 48 local routes are short walks: 30 of them are under 10 km.',
    ]);
  });

  it('says a full listing is a floor, and names operators only where several are known', () => {
    const lines = story(ZURICH);
    expect(lines[0]).toBe('At least 571 waymarked hiking routes run within 18 km of Here: 1 international, 3 national, 9 regional and 558 local. Parts of the area hold more than Waymarked Trails lists at once.');
    expect(lines.some(l => l.includes('than any other route'))).toBe(false);
    expect(lines).toContain('At least 446 local routes here are under 10 km.');
    expect(story({ ...ZURICH, capped: undefined })).toContain('Freiämterweg has more of its length here than any other route: 61 km within 18 km, of 173 km in all.');
    expect(lines.at(-1)).toBe('Operators named on the routes listed here include Wanderland Schweiz, Zürcher Wanderwege and Aargauer Wanderwege.');
    const one = hikingStory({ ...ZURICH, top: [[2120111, 56], [12988850, 24], [2271424, 61]] }, ROUTES).sentences.at(-1);
    expect(one).toEqual({ id: 'operator', name: 'Wanderland Schweiz', routes: 2, listed: 3 });
  });

  it('gives a place without long trails its own sentences', () => {
    expect(story(REGIONAL)).toEqual([
      '5 waymarked hiking routes run within 15 km of Here: 2 regional and 3 local.',
      'No national or international trail comes within 15 km; the longest-distance routes here are regional.',
      'Sheffield Country Walk has more of its length here than any other route: 30 km within 15 km, of 89 km in all.',
      'Of the routes listed here, the longest is Münchner Jakobskirchenweg, 108 km long.',
      'Regional routes account for the largest share: 40 of the 52 km of waymarked route within 15 km.',
      '1 of the 3 local routes is under 10 km; the rest run longer or leave the area.',
    ]);
    expect(story(THIN)).toEqual([
      '2 waymarked hiking routes run within 15 km of Here, all of them local.',
      'Rundweg Am Berg has more of its length here than any other route: 6.1 km within 15 km.',
    ]);
  });

  it('never tells the same route twice', () => {
    for (const row of [MUNICH, SHEFFIELD, ZURICH, REGIONAL, THIN]) {
      const s = hikingStory(row, ROUTES).sentences;
      const ids = s.flatMap(x => ('route' in x ? [x.route.id] : x.id === 'long-distance' ? x.routes.map(r => r.id) : []));
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('never puts more of a network inside the circle than it has', () => {
    const ring = { ...ROUTES, 94: { net: 'REG', name: 'Ceinture verte', km: 263, stages: 25 } };
    expect(renderHikingStory(hikingStory({ ...THIN, top: [[94, 322]] }, ring), 'Paris', EN)).toContain(
      'Ceinture verte passes through Paris: 25 sections with 263 km mapped in all, nearly all of it within 15 km.',
    );
  });

  it('marks lengths measured on simplified lines as approximate', () => {
    const lines = story({ ...THIN, top: [[92, 6.1], [2084475, 5]] });
    expect(lines).toContain('Of the routes listed here, the longest is Natur-Wanderweg Sauerlach, about 23 km long.');
    expect(kmText({ km: 3679 }, EN)).toBe('3,679 km');
  });
});

describe('hikingIndexable', () => {
  it('wants three named routes and ten kilometres of them', () => {
    expect(hikingIndexable(MUNICH)).toBe(true);
    expect(hikingIndexable(REGIONAL)).toBe(true);
    expect(hikingIndexable(THIN)).toBe(false);
    expect(hikingIndexable({ ...REGIONAL, kmIn: { int: 0, nat: 0, reg: 6, loc: 3.9 } })).toBe(false);
  });
});

describe('hiking-data', () => {
  it('counts a route as named only when it is more than a number', () => {
    expect(isNamedRoute({ name: '10', ref: '10' })).toBe(false);
    expect(isNamedRoute({ name: '12-34' })).toBe(false);
    expect(isNamedRoute({ ref: 'E8' })).toBe(false);
    expect(isNamedRoute({ itinerary: ['Hedingen', 'Horgen'] })).toBe(true);
    expect(isNamedRoute({ name: 'Heidepfad' })).toBe(true);
  });

  it('looks further around bigger places', () => {
    expect(hikingKm(50_000)).toBe(15);
    expect(hikingKm(560_000)).toBe(20);
    expect(hikingKm(1_500_000)).toBe(30);
  });

  it('names a route by name, number or ends', () => {
    expect(routeName(ROUTES[1175728], 1175728)).toBe('E8');
    expect(routeName({ from: 'Bülach', to: 'Effretikon' }, 1)).toBe('Bülach – Effretikon');
    expect(routeName({}, 7)).toBe('#7');
  });
});
