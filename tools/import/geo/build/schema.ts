import type Database from 'better-sqlite3';

/*
 * geo-index.db (docs/architecture/geolocation.md §Index). Wikidata ids are stored as their number (Q42 → 42).
 * Years are astronomical (1 BCE = 0).
 */
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);

-- Wikipedia articles with a primary Earth coordinate (GeoData), joined to their Wikidata item.
CREATE TABLE IF NOT EXISTS article (
  wiki      TEXT NOT NULL,
  page_id   INTEGER NOT NULL,
  qid       INTEGER,
  title     TEXT,
  -- normName of the title without its qualifier: "Hastings, East Sussex" and "Hastings (Michigan)" → "hastings".
  name_norm TEXT,
  -- 1 when the title has a qualifier, so it is not the wiki's primary topic for the bare name.
  qualified INTEGER NOT NULL DEFAULT 0,
  lon       REAL NOT NULL,
  lat       REAL NOT NULL,
  -- GeoData's object size in metres and type (city, landmark, event, river, adm1st, …), as the editor set them.
  dim       INTEGER,
  type      TEXT,
  -- 1 when the page has no primary coordinate and this is its only other one.
  sole      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (wiki, page_id)
) WITHOUT ROWID;

-- Wikidata items with P625 (via QLever), with the first P17 country and P31 class, and a coarse kind from P31/P279*.
CREATE TABLE IF NOT EXISTS item (
  qid     INTEGER PRIMARY KEY,
  lon     REAL NOT NULL,
  lat     REAL NOT NULL,
  country INTEGER,
  class   INTEGER,
  kind    TEXT
);

-- Wikidata countries' ISO 3166-1 alpha-2 codes (P297); historical states have none.
CREATE TABLE IF NOT EXISTS country (qid INTEGER PRIMARY KEY, iso2 TEXT NOT NULL);

-- Gazetteer places: GeoNames features and Pleiades places, one row each.
CREATE TABLE IF NOT EXISTS place (
  id         INTEGER PRIMARY KEY,
  source     TEXT NOT NULL,
  source_id  INTEGER NOT NULL,
  name       TEXT NOT NULL,
  -- Coarse kind shared by all sources (settlement, admin1, admin2, country, mountain, river, pass, water, island, terrain, fort, site, region).
  kind       TEXT NOT NULL,
  -- GeoNames feature code (PPLA, MT, STRT…) or Pleiades place type.
  fcode      TEXT,
  country    TEXT,
  admin1     TEXT,
  population INTEGER,
  lon        REAL NOT NULL,
  lat        REAL NOT NULL,
  -- Pleiades: the years the place is attested.
  valid_from INTEGER,
  valid_to   INTEGER,
  qid        INTEGER
);

-- GeoNames countryInfo: ISO codes, names and the country's own GeoNames feature.
CREATE TABLE IF NOT EXISTS country_info (iso2 TEXT PRIMARY KEY, iso3 TEXT, name TEXT, capital TEXT, geonameid INTEGER, area REAL, population INTEGER);

-- Every name of every place, in every language the source gives, historic names flagged.
CREATE TABLE IF NOT EXISTS place_name (
  name_norm  TEXT NOT NULL,
  place_id   INTEGER NOT NULL,
  lang       TEXT NOT NULL DEFAULT '',
  name       TEXT NOT NULL,
  historic   INTEGER NOT NULL DEFAULT 0,
  valid_from INTEGER,
  valid_to   INTEGER,
  PRIMARY KEY (name_norm, place_id, lang)
) WITHOUT ROWID;
`;

export function createSchema(db: Database.Database) {
  db.exec(SCHEMA);
}

const INDEXES = [
  `CREATE INDEX IF NOT EXISTS article_qid ON article (qid)`,
  `CREATE INDEX IF NOT EXISTS article_name ON article (name_norm)`,
  `CREATE INDEX IF NOT EXISTS place_source ON place (source, source_id)`,
  `CREATE INDEX IF NOT EXISTS place_qid ON place (qid) WHERE qid IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS place_country ON place (kind, country) WHERE kind = 'country'`,
];

/** Secondary indexes go on after the bulk loads, which is several times faster than keeping them up to date. */
export function finishIndexes(db: Database.Database, log: (s: string) => void) {
  for (const sql of INDEXES) {
    log(sql.replace(/^CREATE INDEX IF NOT EXISTS /, 'index '));
    db.exec(sql);
  }
  db.exec('ANALYZE');
}

/** Wikidata id → number, or null for anything else. */
export const qnum = (s: string | null | undefined) => {
  const m = s?.match(/Q(\d+)>?$/);
  return m ? Number(m[1]) : null;
};
