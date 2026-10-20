import { existsSync } from 'node:fs';
import type Database from 'better-sqlite3';
import { csvRecords } from '../../csv';
import { normName } from '../../names';
import { PLEIADES_FILES, pleiadesPath } from './sources';

/* Pleiades (CC BY 3.0): the ancient world's places with their attested names and the years each was in use. */

/** Pleiades place ids sit above GeoNames ids in the shared place table. */
export const PLEIADES_ID = 1_000_000_000;

const KIND: [RegExp, string][] = [
  [/fort|castellum|castrum|camp|wall/, 'fort'],
  [/settlement|urban|village|town|city|polis|colonia|municipium|port|harbor|station|villa|estate/, 'settlement'],
  [/river|stream|canal|aqueduct/, 'river'],
  [/mountain|hill|peak|ridge|volcano/, 'mountain'],
  [/pass/, 'pass'],
  [/island|archipelago/, 'island'],
  [/cape|promontory|peninsula/, 'cape'],
  [/bay|gulf|strait|lagoon|sea|ocean/, 'bay'],
  [/lake|spring|marsh/, 'lake'],
  [/region|province|people|ethnic|territory|plain|valley|forest|desert|landscape/, 'region'],
];
const kindOf = (types: string) => KIND.find(([re]) => re.test(types))?.[1] ?? 'site';
const year = (v: string | undefined) => (v && v !== '' && Number.isFinite(Number(v)) ? Math.round(Number(v)) : null);

export async function loadPleiades(db: Database.Database, log: (s: string) => void): Promise<Record<string, number>> {
  if (PLEIADES_FILES.some(f => !existsSync(pleiadesPath(f)))) return { incomplete: 1 };
  db.exec(`DELETE FROM place_name WHERE place_id >= ${PLEIADES_ID}; DELETE FROM place WHERE source = 'pleiades';`);
  const insertPlace = db.prepare(`INSERT INTO place (id, source, source_id, name, kind, fcode, lon, lat, valid_from, valid_to) VALUES (?, 'pleiades', ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insertName = db.prepare(`INSERT OR IGNORE INTO place_name (name_norm, place_id, lang, name, historic, valid_from, valid_to) VALUES (?, ?, ?, ?, ?, ?, ?)`);
  const located = new Set<number>();
  let places = 0;
  let names = 0;
  const addName = (name: string, id: number, lang: string, from: number | null, to: number | null) => {
    const norm = normName(name);
    if (!norm || norm.length > 100) return;
    if (insertName.run(norm, id, lang, name, 1, from, to).changes) names++;
  };
  const rows: Record<string, string>[] = [];
  for await (const r of csvRecords(pleiadesPath('pleiades-places-latest.csv.gz'))) rows.push(r);
  db.transaction(() => {
    for (const r of rows) {
      const lat = Number(r.reprLat);
      const lon = Number(r.reprLong);
      const pid = Number(r.id);
      if (!r.reprLat || !r.reprLong || !Number.isFinite(lat) || !Number.isFinite(lon) || !pid) continue;
      const id = PLEIADES_ID + pid;
      const from = year(r.minDate);
      const to = year(r.maxDate);
      insertPlace.run(id, pid, r.title, kindOf(r.featureTypes ?? ''), (r.featureTypes ?? '').split(',')[0] || null, lon, lat, from, to);
      located.add(pid);
      places++;
      addName(r.title, id, '', from, to);
    }
  })();
  log(`  ${places} located Pleiades places`);
  const nameRows: Record<string, string>[] = [];
  for await (const r of csvRecords(pleiadesPath('pleiades-names-latest.csv.gz'))) nameRows.push(r);
  db.transaction(() => {
    for (const r of nameRows) {
      const pid = Number(r.pid?.split('/').pop());
      if (!located.has(pid)) continue;
      const id = PLEIADES_ID + pid;
      const from = year(r.minDate);
      const to = year(r.maxDate);
      const lang = r.nameLanguage ?? '';
      for (const n of new Set([r.nameAttested, ...(r.nameTransliterated ?? '').split(','), r.title].map(s => s?.trim()).filter(Boolean) as string[])) addName(n, id, lang, from, to);
    }
  })();
  log(`  ${names} Pleiades names`);
  return { places, names };
}
