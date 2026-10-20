// Builds data/db/geo-index.db, the offline geolocation index (docs/architecture/geolocation.md), from bulk downloads:
// Wikipedia article coordinates in 28 languages, Wikidata items with coordinates (via QLever), GeoNames and Pleiades.
//
//   nice -n 10 npx tsx tools/import/geo/build-index.ts [--fetch-only | --load-only] [--redo <step>]
//
// Downloads are kept in .cache/geo-index and skipped when present; each load step is recorded in the index's meta
// table and skipped on the next run, so an interrupted build picks up where it stopped.
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { download, remoteSize, sparqlTsv } from './build/download';
import { loadGeonames } from './build/geonames';
import { loadPleiades } from './build/pleiades';
import { createSchema, finishIndexes } from './build/schema';
import {
  DB_PATH, GEONAMES_FILES, geonamesPath, geonamesUrl, namespacesPath, namespacesUrl, PLEIADES_FILES, pleiadesPath, pleiadesUrl, QLEVER, QLEVER_QUERIES, qleverPath, WIKI_FILES, wikiPath, WIKIS, wikiUrl,
} from './build/sources';
import { loadWikidata } from './build/wikidata';
import { loadWikipedia } from './build/wikipedia';

/** Larger downloads are skipped and reported; enwiki page_props (460 MB) is the biggest kept. */
const MAX_BYTES = 800 * 2 ** 20;
const log = (s: string) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${s}`);

async function fetchWikis() {
  for (const wiki of WIKIS) {
    await download(namespacesUrl(wiki), namespacesPath(wiki), log);
    for (const file of WIKI_FILES) {
      const dest = wikiPath(wiki, file);
      if (existsSync(dest)) continue;
      const size = await remoteSize(wikiUrl(wiki, file));
      if (size !== null && size > MAX_BYTES) {
        log(`skip ${wiki} ${file}: ${(size / 2 ** 20).toFixed(0)} MB`);
        continue;
      }
      await download(wikiUrl(wiki, file), dest, log);
    }
  }
}

async function fetchAll() {
  for (const file of GEONAMES_FILES) await download(geonamesUrl(file), geonamesPath(file), log);
  for (const file of PLEIADES_FILES) await download(pleiadesUrl(file), pleiadesPath(file), log);
  for (const [name, query] of Object.entries(QLEVER_QUERIES) as [keyof typeof QLEVER_QUERIES, string][]) {
    if (existsSync(qleverPath(name))) continue;
    log(`qlever ${name}`);
    await sparqlTsv(QLEVER, query, qleverPath(name), log);
    log(`  ${(statSync(qleverPath(name)).size / 2 ** 20).toFixed(0)} MB`);
  }
  await fetchWikis();
}

const STEPS = {
  wikipedia: loadWikipedia,
  wikidata: loadWikidata,
  geonames: loadGeonames,
  pleiades: loadPleiades,
} as const;

async function main() {
  const args = process.argv.slice(2);
  const t0 = Date.now();
  if (!args.includes('--load-only')) {
    await fetchAll();
    log('downloads complete');
  }
  if (args.includes('--fetch-only')) return;

  mkdirSync(dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = OFF');
  db.pragma('cache_size = -262144');
  createSchema(db);
  const redo = new Set(args.flatMap((a, i) => (args[i - 1] === '--redo' ? [a] : [])));
  const done = db.prepare(`SELECT value FROM meta WHERE key = ?`).pluck();
  const mark = db.prepare(`INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)`);
  let complete = true;
  for (const [name, load] of Object.entries(STEPS)) {
    if (done.get(`step:${name}`) && !redo.has(name)) {
      log(`${name}: already loaded`);
      continue;
    }
    const t = Date.now();
    log(`${name}: loading`);
    const counts = await load(db, log);
    if (counts.incomplete) {
      log(`${name}: some inputs are missing, so the step stays open for the next run`);
      complete = false;
      continue;
    }
    mark.run(`step:${name}`, JSON.stringify({ at: new Date().toISOString(), seconds: Math.round((Date.now() - t) / 1000), counts }));
    log(`${name}: ${JSON.stringify(counts)} in ${Math.round((Date.now() - t) / 1000)} s`);
  }
  if (!complete) {
    // Readers open the index read-only, which a WAL database without its -shm file refuses.
    db.pragma('journal_mode = DELETE');
    db.close();
    log('partial load; run again when the downloads finish');
    return;
  }
  finishIndexes(db, log);
  mark.run('built', new Date().toISOString());
  db.pragma('journal_mode = DELETE');
  db.close();
  log(`done in ${Math.round((Date.now() - t0) / 60_000)} min, ${(statSync(DB_PATH).size / 2 ** 20).toFixed(0)} MB`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
