import { createReadStream, existsSync } from 'node:fs';
import { createInterface } from 'node:readline';
import type Database from 'better-sqlite3';
import { qnum } from './schema';
import { KIND_ROOTS, QLEVER_QUERIES, qleverPath } from './sources';

/* Wikidata items with coordinates (CC0), from QLever TSV exports: coordinates, first country, first class, kind. */

async function* tsv(name: keyof typeof QLEVER_QUERIES): AsyncGenerator<string[]> {
  let header = true;
  for await (const line of createInterface({ input: createReadStream(qleverPath(name)), crlfDelay: Infinity })) {
    if (header) {
      header = false;
      continue;
    }
    if (line) yield line.split('\t');
  }
}

const POINT = /^"?POINT\((-?[\d.]+(?:[eE]-?\d+)?) (-?[\d.]+(?:[eE]-?\d+)?)\)/i;

async function inBatches(rows: AsyncGenerator<string[]>, size: number, write: (batch: string[][]) => void) {
  let batch: string[][] = [];
  let n = 0;
  for await (const r of rows) {
    batch.push(r);
    n++;
    if (batch.length >= size) {
      write(batch);
      batch = [];
    }
  }
  write(batch);
  return n;
}

export async function loadWikidata(db: Database.Database, log: (s: string) => void): Promise<Record<string, number>> {
  if (Object.keys(QLEVER_QUERIES).some(q => !existsSync(qleverPath(q as keyof typeof QLEVER_QUERIES)))) return { incomplete: 1 };
  db.exec(`DELETE FROM item; DELETE FROM country;`);
  const insert = db.prepare(`INSERT OR IGNORE INTO item (qid, lon, lat) VALUES (?, ?, ?)`);
  let items = 0;
  await inBatches(tsv('coords'), 100_000, db.transaction((batch: string[][]) => {
    for (const [item, coord] of batch) {
      // Coordinates on other globes carry the globe's IRI before the point and fail this match.
      const m = coord?.match(POINT);
      const q = qnum(item);
      if (!m || q === null) continue;
      const lon = Number(m[1]);
      const lat = Number(m[2]);
      if (!(Math.abs(lat) <= 90 && Math.abs(lon) <= 180)) continue;
      items += insert.run(q, lon, lat).changes;
    }
  }));
  log(`  ${items} items with coordinates`);

  const setCountry = db.prepare(`UPDATE item SET country = ? WHERE qid = ? AND country IS NULL`);
  const countries = await inBatches(tsv('countries'), 100_000, db.transaction((batch: string[][]) => {
    for (const [item, country] of batch) {
      const q = qnum(item);
      const c = qnum(country);
      if (q !== null && c !== null) setCountry.run(c, q);
    }
  }));
  log(`  ${countries} country statements`);

  const priority = new Map<number, number>();
  const roots = new Map(KIND_ROOTS.flatMap(([, rs], i) => rs.map(r => [Number(r.slice(1)), i] as const)));
  for await (const [cls, root] of tsv('kinds')) {
    const c = qnum(cls);
    const p = roots.get(qnum(root) ?? -1);
    if (c !== null && p !== undefined && p < (priority.get(c) ?? 99)) priority.set(c, p);
  }
  if (!db.prepare(`SELECT 1 FROM pragma_table_info('item') WHERE name = 'kp'`).get()) db.exec(`ALTER TABLE item ADD COLUMN kp INTEGER`);
  const setClass = db.prepare(`UPDATE item SET class = coalesce(class, ?), kp = min(coalesce(kp, 99), ?) WHERE qid = ?`);
  const classes = await inBatches(tsv('classes'), 100_000, db.transaction((batch: string[][]) => {
    for (const [item, cls] of batch) {
      const q = qnum(item);
      const c = qnum(cls);
      if (q !== null && c !== null) setClass.run(c, priority.get(c) ?? 99, q);
    }
  }));
  db.exec(`UPDATE item SET kind = CASE kp ${KIND_ROOTS.map(([kind], i) => `WHEN ${i} THEN '${kind}'`).join(' ')} END; ALTER TABLE item DROP COLUMN kp;`);
  log(`  ${classes} class statements, ${priority.size} classes with a kind`);

  const iso = db.prepare(`INSERT OR IGNORE INTO country (qid, iso2) VALUES (?, ?)`);
  let codes = 0;
  await inBatches(tsv('iso'), 10_000, db.transaction((batch: string[][]) => {
    for (const [country, code] of batch) {
      const q = qnum(country);
      const c = code?.replace(/^"|"(?:@\w+)?$/g, '');
      if (q !== null && c && /^[A-Z]{2}$/.test(c)) codes += iso.run(q, c).changes;
    }
  }));
  return { items, countries, classes, iso2: codes };
}
