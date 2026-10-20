// What the resolver would place among the Wikidata rows the importers reject for having no coordinates. Read-only:
// writes a report to .cache/geo-index/benchmark, never to history.db.
//
//   nice npx tsx tools/import/geo/bench/recover.ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { GeoPrec } from '@takip/db';
import { SqliteGeoIndex } from '../geo-index';
import { type Resolved, resolveEvent } from '../resolve';
import { FILES, readRows, readSitelinks, rowEvidence, type Row, warPoints, wdPoint, wdYear } from '../wikidata-evidence';

const OUT = join('.cache', 'geo-index', 'benchmark');
const PREC_NAME: Record<number, string> = { [GeoPrec.exact]: 'exact', [GeoPrec.city]: 'city', [GeoPrec.area]: 'area', [GeoPrec.approximate]: 'approximate', [GeoPrec.country]: 'country' };
const GTD_YEARS = [1970, 2017];
const COUP = 'Q45382';

const history = new Database(join('data', 'db', 'history.db'), { readonly: true, fileMustExist: true });
const catalog = new Database(join('data', 'db', 'catalog.db'), { readonly: true, fileMustExist: true });
const index = new SqliteGeoIndex();

/** The coordinates each importer would have used; a row with none of them is a "no place" reject. */
function hasPlace(file: string, r: Row) {
  const pts = [r.coord, r.locCoord];
  if (file === 'wars' || file === 'massacres' || file === 'revolutions') pts.push(r.countryCoord);
  if (file === 'politics') pts.push(r.signCoord, ...(r.classes.split('|').includes(COUP) ? [r.capital?.split(' ').slice(1).join(' ')] : []));
  return pts.some(p => wdPoint(p));
}

type Out = { file: string; item: string; label: string; r: Resolved | null };

function main() {
  mkdirSync(OUT, { recursive: true });
  const imported = new Set<string>();
  for (const source of Object.values(FILES)) {
    const id = catalog.prepare(`SELECT source_id FROM meta_source WHERE code = ?`).pluck().get(source);
    for (const r of history.prepare(`SELECT source_record_id FROM ev_event WHERE source_id = ?`).pluck().all(id) as string[]) imported.add(r);
  }
  const rejects: { file: string; row: Row }[] = [];
  const seen = new Set<string>();
  for (const file of Object.keys(FILES)) {
    for (const r of readRows(file)) {
      const year = wdYear(r);
      if (imported.has(r.item) || seen.has(r.item) || !(r.label ?? r.otherLabel) || year === null || hasPlace(file, r)) continue;
      if (file === 'attacks' && year >= GTD_YEARS[0] && year <= GTD_YEARS[1]) continue;
      seen.add(r.item);
      rejects.push({ file, row: r });
    }
  }
  const byFile = Object.fromEntries(Object.keys(FILES).map(f => [f, rejects.filter(x => x.file === f).length]));
  console.log(`no-place rejects: ${JSON.stringify(byFile)}`);

  const sitelinks = readSitelinks();
  const wars = warPoints(Object.keys(FILES));
  const out: Out[] = [];
  const opts = { methods: ['article', 'title-name', 'description-name', 'related'] as const };
  // Wars last, with the battles placed here added to their siblings.
  for (const { file, row } of rejects.filter(x => x.file !== 'wars')) {
    const r = resolveEvent(index, rowEvidence(row, sitelinks, wars, true), { methods: [...opts.methods] });
    out.push({ file, item: row.item, label: row.label ?? row.otherLabel ?? '', r });
    if (r && r.geoPrec <= GeoPrec.area) for (const w of row.wars?.split('|') ?? []) wars.set(w, [...(wars.get(w) ?? []), { item: row.item, p: r }]);
  }
  for (const { file, row } of rejects.filter(x => x.file === 'wars')) {
    const r = resolveEvent(index, rowEvidence(row, sitelinks, wars, true), { methods: [...opts.methods] });
    out.push({ file, item: row.item, label: row.label ?? row.otherLabel ?? '', r });
  }

  const table = new Map<string, number>();
  for (const o of out) {
    const k = `${o.file}|${o.r ? `${o.r.method} ${PREC_NAME[o.r.geoPrec]}` : 'unplaced'}`;
    table.set(k, (table.get(k) ?? 0) + 1);
  }
  const files = Object.keys(FILES);
  const methods = [...new Set([...table.keys()].map(k => k.split('|')[1]))].sort();
  const md = [
    `| method / precision | ${files.join(' | ')} | total |`,
    `|---|${files.map(() => '--:').join('|')}|--:|`,
    ...methods.map(m => `| ${m} | ${files.map(f => table.get(`${f}|${m}`) ?? 0).join(' | ')} | ${files.reduce((s, f) => s + (table.get(`${f}|${m}`) ?? 0), 0)} |`),
    `| **rejects** | ${files.map(f => byFile[f]).join(' | ')} | ${rejects.length} |`,
  ].join('\n');
  writeFileSync(join(OUT, 'recover.md'), `${md}\n`);
  writeFileSync(join(OUT, 'recover.json'), JSON.stringify(out.map(o => ({ file: o.file, item: o.item, label: o.label, ...(o.r && { method: o.r.method, prec: PREC_NAME[o.r.geoPrec], lon: +o.r.lon.toFixed(4), lat: +o.r.lat.toFixed(4), placedAt: o.r.placedAt, detail: o.r.detail }) })), null, 1));
  console.log(md);
  console.log(`placed ${out.filter(o => o.r).length} of ${out.length}`);
}

main();
