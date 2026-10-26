// The index behind /mountain/<slug>: every mountain, hill and volcano on Wikidata (CC0) with coordinates on Earth and
// an article in a Wikipedia not written by a bot, with its heights, range, countries, first ascent and the places it
// tops. Writes data/db/mountains.db:
//
//   nice npx tsx tools/site/build-mountains.ts [--offline]
//
// The SPARQL answers are cached in .cache/site/mountains (fetch.ts), so a rerun resumes and --offline rebuilds from the
// cache. The previous mountains.db is read for its slugs, which never move (mountains/plan.ts). The new file is
// written beside the old and renamed over it; a running server notices within a minute (src/lib/core/read-db.ts).
import { existsSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { LOCALES, type Locale } from '../../src/lib/core/i18n/locales';
import { km } from '../../src/lib/platform/site/places/gazetteer';
import type { GazetteerFile } from '../../src/lib/platform/site/places/place';
import { MOUNTAINS_DB, type ByLocale, type MountainKind, type MountainPlace } from '../../src/lib/platform/site/mountains/data';
import { cachedTsv, chunkedTsv, rows } from './mountains/fetch';
import { assignSlugs, emptyLedger, isIndexed, kindOf, namesFor, pickMetres, type Ledger, type Quantity } from './mountains/plan';
import {
  classesQuery, detailsQuery, labelsQuery, NOT_PEAK_ROOTS, PEAK_ROOTS, placeClassQuery, placeIsoQuery, PROPERTY_QUERIES, qidOf,
} from './mountains/queries';

const OUT = join(resolve(process.env.TAKIP_DATA_DIR ?? 'data'), 'db', MOUNTAINS_DB);
const offline = process.argv.includes('--offline');
const POINT = /^\s*Point\(\s*([-\d.eE]+)\s+([-\d.eE]+)\s*\)$/i;
const PAGE_WIKIS = new Set<string>(LOCALES);
const GAZETTEER = 'data/site/gazetteer.json';
const ZONES = 'data/site/topics/iss.json';
// Three cells either way: about 300 km, far enough for a Himalayan peak's nearest town.
const TOWN_CELLS = 3;

const SCHEMA = `
  CREATE TABLE mountain (
    qid INTEGER PRIMARY KEY, slug TEXT NOT NULL UNIQUE, kind TEXT NOT NULL, names TEXT NOT NULL, wiki TEXT NOT NULL,
    articles INTEGER NOT NULL, lon REAL NOT NULL, lat REAL NOT NULL, elev REAL, prom REAL, isol REAL,
    parent INTEGER, range INTEGER, cc TEXT NOT NULL, ascent TEXT, image TEXT, gvp TEXT, highest TEXT NOT NULL,
    place INTEGER, tz TEXT, indexed INTEGER NOT NULL, seq INTEGER
  ) STRICT;
  CREATE UNIQUE INDEX mountain_seq ON mountain (seq) WHERE seq IS NOT NULL;
  CREATE INDEX mountain_range ON mountain (range, elev) WHERE range IS NOT NULL;
  CREATE INDEX mountain_parent ON mountain (parent) WHERE parent IS NOT NULL;
  CREATE INDEX mountain_elev ON mountain (indexed, elev);
  -- Each mountain under each of its countries, for "the highest in Turkey".
  CREATE TABLE in_country (cc TEXT NOT NULL, qid INTEGER NOT NULL, elev REAL NOT NULL, indexed INTEGER NOT NULL, PRIMARY KEY (cc, qid)) STRICT, WITHOUT ROWID;
  CREATE INDEX in_country_elev ON in_country (cc, elev);
  -- The ranges, countries, continents and regions mountains name.
  CREATE TABLE place (qid INTEGER PRIMARY KEY, kind TEXT NOT NULL, names TEXT NOT NULL, cc TEXT) STRICT;
  -- Every slug ever handed out, to the mountain it went to.
  CREATE TABLE slug (slug TEXT PRIMARY KEY, qid INTEGER NOT NULL) STRICT, WITHOUT ROWID;
  CREATE VIRTUAL TABLE near USING rtree(id, min_x, max_x, min_y, max_y);
  CREATE TABLE meta (k TEXT PRIMARY KEY, v TEXT NOT NULL) STRICT;
`;

interface Item {
  qid: string;
  roots: Set<string>;
  wiki: ByLocale;
  articles: number;
  at?: [number, number];
  elev: Quantity[];
  prom: Quantity[];
  isol: Quantity[];
  parent?: string;
  range?: string;
  cc: string[];
  image?: string;
  gvp?: string;
  ascent?: { time: string; precision: number };
  highest: string[];
}

/** The gazetteer's cities and towns by 1° cell, with each one's time zone (data/site/topics/iss.json). */
function townGrid() {
  const gazetteer = JSON.parse(readFileSync(GAZETTEER, 'utf8')) as GazetteerFile;
  const zones = (JSON.parse(readFileSync(ZONES, 'utf8')) as { rows: Record<string, { tz?: string }> }).rows;
  const grid = new Map<string, { id: number; at: [number, number]; tz: string; cc: string }[]>();
  for (const p of gazetteer.places) {
    const tz = zones[p.id]?.tz;
    if ((p.kind !== 'city' && p.kind !== 'town') || !tz) continue;
    const key = `${Math.floor(p.at[0])},${Math.floor(p.at[1])}`;
    grid.set(key, [...(grid.get(key) ?? []), { id: p.id, at: p.at, tz, cc: p.cc }]);
  }
  return grid;
}

let towns: ReturnType<typeof townGrid> | null = null;

/** The nearest city or town within TOWN_CELLS degrees: what the page names it by, its clock and its country. */
function nearestTown([lon, lat]: [number, number]): { place: number | null; tz: string | null; cc: string | null } {
  towns ??= townGrid();
  let best: { id: number; tz: string; cc: string; d: number } | null = null;
  for (let dx = -TOWN_CELLS; dx <= TOWN_CELLS; dx++) {
    for (let dy = -TOWN_CELLS; dy <= TOWN_CELLS; dy++) {
      for (const p of towns.get(`${Math.floor(lon) + dx},${Math.floor(lat) + dy}`) ?? []) {
        const d = km([lon, lat], p.at);
        if (!best || d < best.d) best = { id: p.id, tz: p.tz, cc: p.cc, d };
      }
    }
  }
  return { place: best?.id ?? null, tz: best?.tz ?? null, cc: best?.cc ?? null };
}

const wikiCode = (iri: string) => /^https:\/\/([\w-]+)\.wikipedia\.org\/$/.exec(iri)?.[1] ?? null;

/** Each class's roots, by name ("mountain", "range"); a class is a peak's when it has a peak root and no other. */
async function classRoots(): Promise<{ all: string[]; peak: Map<string, Set<string>>; ranges: Set<string> }> {
  const byRoot = new Map(Object.entries({ ...PEAK_ROOTS, ...NOT_PEAK_ROOTS }).map(([name, q]) => [q, name]));
  const roots = new Map<string, Set<string>>();
  for await (const [cls, root] of rows(await cachedTsv('classes', classesQuery(), offline))) {
    const c = qidOf(cls.value);
    const r = byRoot.get(qidOf(root.value) ?? '');
    if (c && r) roots.set(c, (roots.get(c) ?? new Set()).add(r));
  }
  const peak = new Map<string, Set<string>>();
  const ranges = new Set<string>();
  for (const [c, rs] of roots) {
    if (rs.has('range')) ranges.add(c);
    // A massif is filed under ranges, but Kilimanjaro and Vinson are massifs with one summit.
    const excluded = Object.keys(NOT_PEAK_ROOTS).some(n => rs.has(n)) && !rs.has('massif');
    if (!excluded && Object.keys(PEAK_ROOTS).some(n => rs.has(n))) peak.set(c, rs);
  }
  return { all: [...roots.keys()].sort(), peak, ranges };
}

async function gather() {
  const { all, peak, ranges } = await classRoots();
  console.log(`${peak.size} peak classes of ${all.length}`);
  const q = (name: string) => cachedTsv(name, PROPERTY_QUERIES[name](all), offline);

  const items = new Map<string, Item>();
  for await (const [item, cls] of rows(await q('items'))) {
    const id = qidOf(item.value);
    const rs = peak.get(qidOf(cls.value) ?? '');
    if (!id || !rs) continue;
    const it = items.get(id) ?? { qid: id, roots: new Set(), wiki: {}, articles: 0, elev: [], prom: [], isol: [], cc: [], highest: [] };
    rs.forEach(r => it.roots.add(r));
    items.set(id, it);
  }
  for await (const [item, wiki, title] of rows(await q('articles'))) {
    const it = items.get(qidOf(item.value) ?? '');
    const code = wikiCode(wiki.value);
    if (!it || !code) continue;
    it.articles++;
    if (PAGE_WIKIS.has(code)) it.wiki[code as Locale] = title.value;
  }
  for (const [id, it] of items) if (!it.articles) items.delete(id);
  console.log(`${items.size} peaks with an article`);

  for await (const [item, coord] of rows(await q('coords'))) {
    const it = items.get(qidOf(item.value) ?? '');
    // A point on another globe starts with the globe's IRI and fails the match.
    const m = POINT.exec(coord.value);
    if (!it || it.at || !m) continue;
    const at: [number, number] = [Math.round(Number(m[1]) * 1e5) / 1e5, Math.round(Number(m[2]) * 1e5) / 1e5];
    if (Math.abs(at[1]) <= 90 && Math.abs(at[0]) <= 180) it.at = at;
  }
  for (const [id, it] of items) if (!it.at) items.delete(id);
  console.log(`${items.size} on Earth with coordinates`);

  const quantity = { elevation: 'elev', prominence: 'prom', isolation: 'isol' } as const;
  for await (const [item, prop, value, extra, unit] of rows(await chunkedTsv('details', [...items.keys()], 500, detailsQuery, offline))) {
    const it = items.get(qidOf(item.value) ?? '');
    const p = prop.value;
    if (!it) continue;
    if (p in quantity) {
      it[quantity[p as keyof typeof quantity]].push({ rank: extra.value, amount: Number(value.value), unit: qidOf(unit.value) ?? unit.value });
    } else if (p === 'parent' || p === 'range') {
      const t = qidOf(value.value);
      if (t && !it[p] && t !== it.qid) it[p] = t;
    } else if (p === 'country') {
      const cc = value.value.toUpperCase();
      if (/^[A-Z]{2}$/.test(cc) && !it.cc.includes(cc)) it.cc.push(cc);
    } else if (p === 'image' && !it.image) {
      it.image = decodeURIComponent(value.value.slice(value.value.lastIndexOf('/') + 1)).replace(/_/g, ' ');
    } else if (p === 'gvp' && !it.gvp) {
      it.gvp = value.value;
    } else if (p === 'ascent') {
      const precision = Number(extra.value);
      // Only to the year or finer; the earliest where Wikidata lists several.
      if (precision >= 9 && (!it.ascent || value.value < it.ascent.time)) it.ascent = { time: value.value, precision };
    } else if (p === 'highest') {
      const place = qidOf(value.value);
      if (place && !it.highest.includes(place)) it.highest.push(place);
    }
  }
  return { items, ranges };
}

/** Labels in the page languages, by item. */
async function labels(qids: string[]): Promise<Map<string, Map<string, string>>> {
  const out = new Map<string, Map<string, string>>();
  const langs = [...LOCALES];
  for await (const [item, label] of rows(await chunkedTsv('labels', qids, 1000, chunk => labelsQuery(chunk, langs), offline))) {
    const id = qidOf(item.value);
    if (!id || !label.lang) continue;
    const m = out.get(id) ?? new Map<string, string>();
    m.set(label.lang, label.value);
    out.set(id, m);
  }
  return out;
}

/** The continents as the Seven Summits count them: Africa, South America, Europe, Asia, North America, Antarctica, Oceania and the Australian continent. */
const CONTINENTS = new Set(['Q15', 'Q18', 'Q46', 'Q48', 'Q49', 'Q51', 'Q55643', 'Q3960']);
const EARTH = 'Q2';

/** The places mountains name: the Earth, the continents, countries by their ISO code, and ranges by class. */
async function places(qids: string[], ranges: Set<string>, names: Map<string, Map<string, string>>): Promise<MountainPlace[]> {
  const iso = new Map<string, string>();
  for await (const [item, code] of rows(await chunkedTsv('place-iso', qids, 1000, placeIsoQuery, offline))) {
    const id = qidOf(item.value);
    if (id && /^[A-Za-z]{2}$/.test(code.value)) iso.set(id, code.value.toUpperCase());
  }
  const kinds = new Map<string, MountainPlace['kind']>();
  for await (const [item, cls] of rows(await chunkedTsv('place-class', qids, 1000, placeClassQuery, offline))) {
    const id = qidOf(item.value);
    const c = qidOf(cls.value) ?? '';
    if (id && ranges.has(c)) kinds.set(id, 'range');
  }
  return qids.map(q => ({
    qid: Number(q.slice(1)),
    kind: q === EARTH ? 'world' : CONTINENTS.has(q) ? 'continent' : iso.has(q) ? 'country' : kinds.get(q) ?? 'other',
    names: namesFor(names.get(q) ?? new Map(), {}),
    cc: iso.get(q) ?? null,
  }));
}

/** The previous build's slugs; empty on a first build. */
function readLedger(path: string): Ledger {
  const ledger = emptyLedger();
  if (!existsSync(path)) return ledger;
  const db = new Database(path, { readonly: true, fileMustExist: true });
  try {
    for (const r of db.prepare('SELECT slug, qid FROM slug').all() as { slug: string; qid: number }[]) ledger.slugs.set(r.slug, `Q${r.qid}`);
    for (const r of db.prepare('SELECT slug, qid FROM mountain').all() as { slug: string; qid: number }[]) ledger.byQid.set(`Q${r.qid}`, r.slug);
  } finally {
    db.close();
  }
  return ledger;
}

/** "+1953-05-29T00:00:00Z" at day precision → "1953-05-29"; year precision → "1953". */
function ascentDate({ time, precision }: { time: string; precision: number }): string | null {
  const m = /^\+?(\d{4})-(\d{2})-(\d{2})/.exec(time);
  if (!m) return null;
  return precision >= 11 ? `${m[1]}-${m[2]}-${m[3]}` : precision === 10 ? `${m[1]}-${m[2]}` : m[1];
}

async function main() {
  const { items, ranges } = await gather();
  const referenced = new Set<string>();
  for (const it of items.values()) {
    for (const q of [it.range, it.parent, ...it.highest]) if (q && !items.has(q)) referenced.add(q);
  }
  const names = await labels([...items.keys(), ...referenced]);
  const placeRows = await places([...referenced], ranges, names);
  const countryName = new Intl.DisplayNames('en', { type: 'region' });

  const planned = [...items.values()].map(it => {
    const town = nearestTown(it.at!);
    // Wikidata's answers don't keep its statements' order; a border peak leads with the country of its nearest town.
    if (town.cc && it.cc.includes(town.cc)) it.cc = [town.cc, ...it.cc.filter(cc => cc !== town.cc)];
    const elev = pickMetres(it.elev);
    const prom = pickMetres(it.prom);
    const isol = pickMetres(it.isol);
    const itemNames = namesFor(names.get(it.qid) ?? new Map(), it.wiki);
    const countries = it.cc.map(cc => countryName.of(cc) ?? cc);
    return {
      it, town, elev, prom, isol: isol === null ? null : isol / 1000, names: itemNames, kind: kindOf(it.roots) as MountainKind,
      indexed: isIndexed(elev, it.wiki), countries,
    };
  });
  const ledger = readLedger(OUT);
  const slugs = assignSlugs(planned.map(p => ({
    qid: p.it.qid, names: p.names, wiki: p.it.wiki, countries: p.countries, kind: p.kind, indexed: p.indexed, articles: p.it.articles, elev: p.elev,
  })), ledger);
  const seq = new Map(planned.filter(p => p.indexed)
    .sort((a, b) => b.it.articles - a.it.articles || Number(a.it.qid.slice(1)) - Number(b.it.qid.slice(1)))
    .map((p, i) => [p.it.qid, i]));

  const tmp = `${OUT}.new`;
  rmSync(tmp, { force: true });
  const db = new Database(tmp);
  db.pragma('journal_mode = OFF');
  db.exec(SCHEMA);
  db.transaction(() => {
    const insert = db.prepare(`INSERT INTO mountain VALUES (@qid, @slug, @kind, @names, @wiki, @articles, @lon, @lat, @elev, @prom, @isol,
      @parent, @range, @cc, @ascent, @image, @gvp, @highest, @place, @tz, @indexed, @seq)`);
    const inCountry = db.prepare('INSERT OR IGNORE INTO in_country VALUES (?, ?, ?, ?)');
    const near = db.prepare('INSERT INTO near VALUES (?, ?, ?, ?, ?)');
    const round = (v: number | null, d = 0) => (v === null ? null : Math.round(v * 10 ** d) / 10 ** d);
    for (const p of planned) {
      const qid = Number(p.it.qid.slice(1));
      const [lon, lat] = p.it.at!;
      insert.run({
        qid, slug: slugs.get(p.it.qid)!, kind: p.kind, names: JSON.stringify(p.names), wiki: JSON.stringify(p.it.wiki),
        articles: p.it.articles, lon, lat, elev: round(p.elev, 1), prom: round(p.prom, 1), isol: round(p.isol, 2),
        parent: p.it.parent ? Number(p.it.parent.slice(1)) : null, range: p.it.range ? Number(p.it.range.slice(1)) : null,
        cc: p.it.cc.join(','), ascent: p.it.ascent ? ascentDate(p.it.ascent) : null, image: p.it.image ?? null, gvp: p.it.gvp ?? null,
        highest: JSON.stringify(p.it.highest.map(q => Number(q.slice(1)))), place: p.town.place, tz: p.town.tz,
        indexed: p.indexed ? 1 : 0, seq: seq.get(p.it.qid) ?? null,
      });
      if (p.elev !== null) for (const cc of p.it.cc) inCountry.run(cc, qid, round(p.elev, 1), p.indexed ? 1 : 0);
      near.run(qid, lon, lon, lat, lat);
    }
    const place = db.prepare('INSERT INTO place VALUES (?, ?, ?, ?)');
    for (const p of placeRows) place.run(p.qid, p.kind, JSON.stringify(p.names), p.cc);
    const slug = db.prepare('INSERT OR IGNORE INTO slug VALUES (?, ?)');
    for (const [q, s] of slugs) slug.run(s, Number(q.slice(1)));
    for (const [s, q] of ledger.slugs) slug.run(s, Number(q.slice(1)));
    const meta = db.prepare('INSERT INTO meta VALUES (?, ?)');
    meta.run('built', new Date().toISOString());
    meta.run('pages', String(planned.length));
    meta.run('indexed', String(seq.size));
  })();
  db.close();
  renameSync(tmp, OUT);
  const kinds = planned.reduce<Record<string, number>>((n, p) => ({ ...n, [p.kind]: (n[p.kind] ?? 0) + 1 }), {});
  console.log(`${planned.length} pages, ${seq.size} indexed (${JSON.stringify(kinds)}); ${placeRows.length} places → ${OUT}`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
