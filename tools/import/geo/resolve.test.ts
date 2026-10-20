import Database from 'better-sqlite3';
import { GeoPrec } from '@takip/db';
import { beforeAll, describe, expect, it } from 'vitest';
import { normName } from '../names';
import { createSchema } from './build/schema';
import { SqliteGeoIndex } from './geo-index';
import { articleConsensus, resolveEvent } from './resolve';

type P = { id: number; source?: string; name: string; kind: string; fcode?: string; country?: string; admin1?: string; pop?: number; lon: number; lat: number; from?: number; to?: number; qid?: number; names?: [string, string, number?][] };

const PLACES: P[] = [
  { id: 1, name: 'Lexington', kind: 'settlement', fcode: 'PPLA', country: 'US', admin1: 'KY', pop: 320_000, lon: -84.5, lat: 38.05 },
  { id: 2, name: 'Lexington', kind: 'settlement', fcode: 'PPL', country: 'US', admin1: 'MA', pop: 33_000, lon: -71.23, lat: 42.45 },
  { id: 3, name: 'Lexington', kind: 'settlement', fcode: 'PPLA2', country: 'US', admin1: 'MO', pop: 4_500, lon: -93.88, lat: 39.18 },
  { id: 4, name: 'Concord', kind: 'settlement', fcode: 'PPL', country: 'US', admin1: 'MA', pop: 18_000, lon: -71.35, lat: 42.46 },
  { id: 10, name: 'Missouri', kind: 'admin1', fcode: 'ADM1', country: 'US', admin1: 'MO', pop: 6_000_000, lon: -92.5, lat: 38.25 },
  { id: 20, name: 'Hastings', kind: 'settlement', fcode: 'PPL', country: 'GB', admin1: 'ENG', pop: 90_000, lon: 0.57, lat: 50.85, qid: 29245 },
  { id: 21, name: 'Hastings', kind: 'settlement', fcode: 'PPL', country: 'NZ', admin1: 'E7', pop: 70_000, lon: 176.84, lat: -39.64 },
  { id: 30, name: 'Istanbul', kind: 'settlement', fcode: 'PPLA', country: 'TR', admin1: '34', pop: 15_000_000, lon: 28.95, lat: 41.01, names: [['Constantinople', 'en', 1], ['İstanbul', 'tr']] },
  { id: 40, name: 'Somme', kind: 'river', fcode: 'STM', country: 'FR', lon: 1.6, lat: 50.18, qid: 1000 },
  { id: 41, name: 'Somme', kind: 'admin2', fcode: 'ADM2', country: 'FR', admin1: '32', pop: 570_000, lon: 2.3, lat: 49.92 },
  { id: 6252001, name: 'United States', kind: 'country', fcode: 'PCLI', country: 'US', lon: -98.5, lat: 39.76 },
  { id: 2635167, name: 'United Kingdom', kind: 'country', fcode: 'PCLI', country: 'GB', lon: -2.7, lat: 54.75 },
  { id: 2017370, name: 'Russia', kind: 'country', fcode: 'PCLI', country: 'RU', lon: 100, lat: 60, names: [['Россия', 'ru']] },
  { id: 3017382, name: 'France', kind: 'country', fcode: 'PCLI', country: 'FR', lon: 2, lat: 46 },
  { id: 700, name: 'Poltava', kind: 'settlement', fcode: 'PPLA', country: 'UA', admin1: '18', pop: 280_000, lon: 34.55, lat: 49.59, names: [['Полтава', 'ru'], ['Полтава', 'uk']] },
  { id: 1_000_520_985, source: 'pleiades', name: 'Byzantion', kind: 'settlement', lon: 28.98, lat: 41.01, from: -660, to: 330, names: [['Byzantium', 'la']] },
  { id: 800, name: 'Byzantium', kind: 'settlement', fcode: 'PPL', country: 'US', admin1: 'NJ', pop: 50, lon: -74.1, lat: 40.1 },
];

let index: SqliteGeoIndex;

beforeAll(() => {
  const db = new Database(':memory:');
  createSchema(db);
  const place = db.prepare(`INSERT INTO place (id, source, source_id, name, kind, fcode, country, admin1, population, lon, lat, valid_from, valid_to, qid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const name = db.prepare(`INSERT OR IGNORE INTO place_name (name_norm, place_id, lang, name, historic) VALUES (?, ?, ?, ?, ?)`);
  for (const p of PLACES) {
    place.run(p.id, p.source ?? 'geonames', p.id, p.name, p.kind, p.fcode ?? null, p.country ?? null, p.admin1 ?? null, p.pop ?? null, p.lon, p.lat, p.from ?? null, p.to ?? null, p.qid ?? null);
    name.run(normName(p.name), p.id, '', p.name, 0);
    for (const [n, lang, historic] of p.names ?? []) name.run(normName(n), p.id, lang, n, historic ?? 0);
  }
  const ci = db.prepare(`INSERT INTO country_info (iso2, name, geonameid) VALUES (?, ?, ?)`);
  for (const [iso2, n, id] of [['US', 'United States', 6252001], ['GB', 'United Kingdom', 2635167], ['RU', 'Russia', 2017370], ['FR', 'France', 3017382]] as const) ci.run(iso2, n, id);
  const article = db.prepare(`INSERT INTO article (wiki, page_id, qid, title, name_norm, qualified, lon, lat, dim, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  article.run('en', 1, 29245, 'Hastings', 'hastings', 0, 0.573, 50.856, 10000, 'city');
  article.run('en', 2, null, 'Hastings, New Zealand', 'hastings', 1, 176.84, -39.64, 10000, 'city');
  article.run('en', 3, 16869, 'Constantinople', 'constantinople', 0, 28.97, 41.01, null, 'city');
  article.run('ru', 4, 152, 'Полтава', 'полтава', 0, 34.55, 49.59, null, 'city');
  // Event Q99: its German and Russian articles agree, the English one sits elsewhere.
  article.run('de', 10, 99, 'Schlacht bei X', 'schlacht bei x', 0, 20.0, 45.0, null, null);
  article.run('ru', 11, 99, 'Битва при X', 'битва при x', 0, 20.05, 45.02, null, null);
  article.run('en', 12, 99, 'Battle of X', 'battle of x', 0, 25.0, 47.0, null, null);
  article.run('fr', 13, 98, 'Bataille de Y', 'bataille de y', 0, 10, 10, null, null);
  article.run('it', 14, 98, 'Battaglia di Y', 'battaglia di y', 0, 30, 30, null, null);
  const item = db.prepare(`INSERT INTO item (qid, lon, lat, country, class, kind) VALUES (?, ?, ?, ?, ?, ?)`);
  item.run(500, 12.5, 41.9, 38, 515, 'settlement');
  item.run(501, 13.0, 42.0, 38, 178561, 'event');
  item.run(29245, 0.57, 50.85, 145, 515, 'settlement');
  db.prepare(`INSERT INTO country (qid, iso2) VALUES (145, 'GB'), (38, 'IT')`).run();
  index = new SqliteGeoIndex(db);
});

describe('resolveEvent', () => {
  it('keeps the source’s own coordinates as exact', () => {
    expect(resolveEvent(index, { coords: { lon: 1, lat: 2 }, titles: [{ text: 'Battle of Hastings' }] })).toMatchObject({ lon: 1, lat: 2, method: 'own', geoPrec: GeoPrec.exact });
  });

  it('places at a linked location item, skipping one that is itself an event', () => {
    const r = resolveEvent(index, { places: [{ qid: 'Q501', prop: 'P276' }, { qid: 'Q500', prop: 'P131' }] });
    expect(r).toMatchObject({ lon: 12.5, lat: 41.9, method: 'place-item', geoPrec: GeoPrec.city });
    expect(r?.placedAt).toBe('town Wikidata says it was in');
  });

  it('uses the coordinates most of the event’s own articles agree on', () => {
    const r = resolveEvent(index, { qid: 'Q99' });
    expect(r).toMatchObject({ lon: 20.0, lat: 45.0, method: 'article', geoPrec: GeoPrec.exact });
    expect(r?.placedAt).toBe('coordinates of its Wikipedia articles (2 of 3 languages agree)');
    expect(resolveEvent(index, { qid: 'Q98' }, { methods: ['article'] })).toBeNull();
  });

  it('refuses to choose between same-named towns without context', () => {
    expect(resolveEvent(index, { titles: [{ text: 'Battle of Lexington', lang: 'en' }] })).toBeNull();
  });

  it('lets a comma qualifier pick the town', () => {
    const r = resolveEvent(index, { titles: [{ text: 'Battle of Lexington, Missouri', lang: 'en' }] });
    expect(r).toMatchObject({ lon: -93.88, method: 'title-name', geoPrec: GeoPrec.city });
    expect(r?.placedAt).toBe('town its title names, Lexington');
  });

  it('lets related events pick the town', () => {
    const r = resolveEvent(index, { titles: [{ text: 'Battle of Lexington' }], related: [{ lon: -71.35, lat: 42.46 }, { lon: -71.06, lat: 42.36 }] });
    expect(r).toMatchObject({ lon: -71.23, method: 'title-name' });
    expect(r?.detail).toContain('related');
  });

  it('needs context even for the primary-topic town when another place has the name', () => {
    expect(resolveEvent(index, { titles: [{ text: 'Battle of Hastings', lang: 'en' }] })).toBeNull();
    expect(resolveEvent(index, { titles: [{ text: 'Battle of Hastings', lang: 'en' }], countries: ['GB'] })).toMatchObject({ lon: 0.57, lat: 50.85, method: 'title-name' });
  });

  it('prefers the ancient city for an ancient siege', () => {
    expect(resolveEvent(index, { titles: [{ text: 'Siege of Byzantium' }], year: -340 })).toMatchObject({ lon: 28.98, lat: 41.01 });
  });

  it('finds a historic name', () => {
    expect(resolveEvent(index, { titles: [{ text: 'Fall of Constantinople' }], year: 1453 })).toMatchObject({ lon: 28.95, method: 'title-name' });
  });

  it('reads an inflected Russian title only through a Russian name', () => {
    expect(resolveEvent(index, { titles: [{ text: 'Битва под Полтавой', lang: 'ru' }] })).toMatchObject({ lon: 34.55, method: 'title-name' });
  });

  it('places a river battle at the river, not the district of the same name, with approximate precision', () => {
    const r = resolveEvent(index, { titles: [{ text: 'Battle of the Somme River' }], countries: ['FR'] });
    expect(r).toMatchObject({ lon: 1.6, geoPrec: GeoPrec.approximate });
    expect(r?.placedAt).toBe('river its title names, Somme River');
    expect(r?.detail).toContain('hint');
  });

  it('places a source-named town with its division and country', () => {
    const r = resolveEvent(index, { named: [{ name: 'Lexington', admin1: 'Missouri', country: 'United States' }] });
    expect(r).toMatchObject({ lon: -93.88, method: 'named-place' });
    expect(r?.placedAt).toBe('town the source names, Lexington');
  });

  it('falls back to the middle of tightly grouped related events, then the country', () => {
    const near = [{ lon: 10, lat: 50 }, { lon: 10.2, lat: 50.1 }, { lon: 10.1, lat: 49.9 }];
    expect(resolveEvent(index, { related: near })).toMatchObject({ method: 'related', placedAt: 'middle of related events' });
    const far = [{ lon: 10, lat: 50 }, { lon: 30, lat: 50 }, { lon: -5, lat: 40 }];
    expect(resolveEvent(index, { related: far, countries: ['RU'] })).toMatchObject({ method: 'country', geoPrec: GeoPrec.country, lon: 100 });
  });

  it('never matches the event’s own item as its place', () => {
    expect(resolveEvent(index, { qid: 'Q29245', titles: [{ text: 'Battle of Hastings', lang: 'en' }] }, { methods: ['title-name'] })?.detail).not.toContain('wp:en:1');
  });
});

describe('articleConsensus', () => {
  it('takes a lone article and refuses an even split', () => {
    expect(articleConsensus([{ wiki: 'en', title: 'A', qid: 1, lon: 1, lat: 1, dim: null, type: null }])?.agree).toBe(1);
    expect(articleConsensus([
      { wiki: 'en', title: 'A', qid: 1, lon: 1, lat: 1, dim: null, type: null },
      { wiki: 'de', title: 'A', qid: 1, lon: 9, lat: 9, dim: null, type: null },
    ])).toBeNull();
  });
});
