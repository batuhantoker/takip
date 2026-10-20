import { existsSync } from 'node:fs';
import Database from 'better-sqlite3';
import { normName } from '../names';
import { DB_PATH } from './build/sources';
import { titleBase } from './names';

/* Read access to geo-index.db for the resolver. The resolver sees only this interface, so tests can hand it a fixture. */

export type Point = { lon: number; lat: number };

/** A gazetteer candidate for a name: a GeoNames or Pleiades place, or a geotagged Wikipedia article. */
export type Hit = Point & {
  key: string;
  source: 'geonames' | 'pleiades' | 'wikipedia';
  name: string;
  lang: string;
  historic: boolean;
  kind: string;
  fcode: string | null;
  country: string | null;
  admin1: string | null;
  population: number | null;
  validFrom: number | null;
  validTo: number | null;
  qid: number | null;
  /** An unqualified Wikipedia title: the wiki's primary topic for that name. */
  primary: boolean;
};

export type ArticlePoint = Point & { wiki: string; title: string | null; qid: number | null; dim: number | null; type: string | null };
export type ItemPoint = Point & { qid: number; country: string | null; kind: string | null };

export interface GeoIndex {
  /** A Wikidata item's coordinates, with its country's ISO code and coarse kind. */
  item(qid: number): ItemPoint | null;
  /** Geotagged Wikipedia articles about an item, in every indexed language. */
  articles(qid: number): ArticlePoint[];
  articleByTitle(wiki: string, title: string): ArticlePoint | null;
  /** Every place named `norm` (normName form). */
  places(norm: string): Hit[];
  /** A country's representative point and ISO code by ISO code or normalised name in any language. */
  country(codeOrNorm: string): { iso2: string; point: Point } | null;
}

/** GeoData `type` → the gazetteer's kinds. */
const GEODATA_KIND: Record<string, string> = {
  city: 'settlement', town: 'settlement', village: 'settlement', settlement: 'settlement', landmark: 'site', edu: 'site', railwaystation: 'site', airport: 'site',
  building: 'site', church: 'site', mountain: 'mountain', pass: 'pass', waterbody: 'lake', river: 'river', isle: 'island', island: 'island', adm1st: 'admin1',
  adm2nd: 'admin2', adm3rd: 'admin3', county: 'admin2', state: 'admin1', country: 'country', forest: 'terrain', glacier: 'terrain', valley: 'terrain',
  landform: 'terrain', park: 'region', event: 'event', satellite: 'event',
};
/** Wikidata's "admin" covers every level, municipalities included, so it counts as a district. */
const ITEM_KIND: Record<string, string> = { admin: 'admin2', building: 'site', structure: 'site' };
export const itemKind = (kind: string | null) => (kind && (ITEM_KIND[kind] ?? kind)) || 'unknown';

export const articleKind = (type: string | null, kind: string | null) =>
  (kind && itemKind(kind)) || (type && GEODATA_KIND[type.split(':')[0].toLowerCase()]) || 'unknown';

export class SqliteGeoIndex implements GeoIndex {
  readonly db: Database.Database;
  private readonly q;
  private countries = new Map<string, { iso2: string; point: Point } | null>();

  constructor(source: string | Database.Database = DB_PATH) {
    this.db = typeof source === 'string' ? new Database(source, { readonly: true, fileMustExist: true }) : source;
    this.q = {
      item: this.db.prepare(`SELECT i.qid, i.lon, i.lat, c.iso2 AS country, i.kind FROM item i LEFT JOIN country c ON c.qid = i.country WHERE i.qid = ?`),
      articles: this.db.prepare(`SELECT wiki, title, qid, lon, lat, dim, type FROM article WHERE qid = ?`),
      byTitle: this.db.prepare(`SELECT wiki, title, qid, lon, lat, dim, type FROM article WHERE name_norm = ? AND wiki = ? AND title = ?`),
      names: this.db.prepare(`
        SELECT p.id, p.source, p.name, n.lang, n.historic, p.kind, p.fcode, p.country, p.admin1, p.population, p.lon, p.lat,
               coalesce(n.valid_from, p.valid_from) AS validFrom, coalesce(n.valid_to, p.valid_to) AS validTo, p.qid
        FROM place_name n JOIN place p ON p.id = n.place_id WHERE n.name_norm = ?`),
      titles: this.db.prepare(`
        SELECT a.wiki, a.page_id AS page, a.title, a.qualified, a.lon, a.lat, a.type, a.qid, i.kind AS itemKind, c.iso2 AS country
        FROM article a LEFT JOIN item i ON i.qid = a.qid LEFT JOIN country c ON c.qid = i.country WHERE a.name_norm = ?`),
      countryByCode: this.db.prepare(`SELECT ci.iso2, p.lon, p.lat FROM country_info ci JOIN place p ON p.id = ci.geonameid WHERE ci.iso2 = ?`),
      countryByName: this.db.prepare(`
        SELECT p.country AS iso2, p.lon, p.lat FROM place_name n JOIN place p ON p.id = n.place_id
        WHERE n.name_norm = ? AND p.kind = 'country' AND p.country IS NOT NULL ORDER BY p.fcode = 'PCLI' DESC, p.population DESC LIMIT 1`),
    };
  }

  item(qid: number): ItemPoint | null {
    return (this.q.item.get(qid) as ItemPoint | undefined) ?? null;
  }

  articles(qid: number): ArticlePoint[] {
    return this.q.articles.all(qid) as ArticlePoint[];
  }

  articleByTitle(wiki: string, title: string): ArticlePoint | null {
    const t = title.replace(/_/g, ' ');
    const norm = normTitle(t);
    return norm ? ((this.q.byTitle.get(norm, wiki, t) as ArticlePoint | undefined) ?? null) : null;
  }

  places(norm: string): Hit[] {
    const out: Hit[] = [];
    type P = { id: number; source: 'geonames' | 'pleiades'; name: string; lang: string; historic: number; kind: string; fcode: string | null; country: string | null; admin1: string | null; population: number | null; lon: number; lat: number; validFrom: number | null; validTo: number | null; qid: number | null };
    for (const r of this.q.names.all(norm) as P[]) out.push({ ...r, key: `${r.source === 'geonames' ? 'gn' : 'pl'}:${r.id}`, historic: !!r.historic, primary: false });
    type A = { wiki: string; page: number; title: string; qualified: number; lon: number; lat: number; type: string | null; qid: number | null; itemKind: string | null; country: string | null };
    for (const r of this.q.titles.all(norm) as A[]) {
      out.push({
        key: `wp:${r.wiki}:${r.page}`, source: 'wikipedia', name: r.title, lang: r.wiki, historic: false, kind: articleKind(r.type, r.itemKind), fcode: r.type,
        country: r.country, admin1: null, population: null, lon: r.lon, lat: r.lat, validFrom: null, validTo: null, qid: r.qid, primary: !r.qualified,
      });
    }
    return out;
  }

  country(codeOrNorm: string) {
    if (this.countries.has(codeOrNorm)) return this.countries.get(codeOrNorm)!;
    const r = (/^[A-Z]{2}$/.test(codeOrNorm) ? this.q.countryByCode.get(codeOrNorm) : this.q.countryByName.get(codeOrNorm)) as { iso2: string; lon: number; lat: number } | undefined;
    const v = r ? { iso2: r.iso2, point: { lon: r.lon, lat: r.lat } } : null;
    this.countries.set(codeOrNorm, v);
    return v;
  }

  close() {
    this.db.close();
  }
}

const normTitle = (t: string) => normName(titleBase(t).base);

/** The index if it has been built (tools/import/geo/build-index.ts), else null so importers run without it. */
export const openGeoIndex = (path = DB_PATH): SqliteGeoIndex | null => (existsSync(path) ? new SqliteGeoIndex(path) : null);
