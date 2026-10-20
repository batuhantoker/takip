import { existsSync, readFileSync } from 'node:fs';
import type Database from 'better-sqlite3';
import { normName } from '../../names';
import { GEONAMES_FILES, geonamesPath } from './sources';
import { commandLines } from './sql-dump';

/*
 * GeoNames (CC BY 4.0): every populated place and administrative area, and the physical features battles are named
 * after (mountains, rivers, passes, straits, capes, plains, forts, ruins) when notable enough to have a Wikidata item
 * or a name in another language. Place ids are GeoNames ids.
 */

/** Feature code → kind; a class letter stands for every code in that class. Codes missing here are dropped. */
const KINDS: Record<string, string> = {
  P: 'settlement',
  PCLI: 'country', PCLD: 'country', PCLF: 'country', PCLS: 'country', PCLIX: 'country', PCL: 'country', PCLH: 'country', TERR: 'country',
  ADM1: 'admin1', ADM1H: 'admin1', ADM2: 'admin2', ADM2H: 'admin2', ADM3: 'admin3', ADM3H: 'admin3', ADM4: 'admin3', ADM4H: 'admin3', ADM5: 'admin3', ADMD: 'admin3', ADMDH: 'admin3',
  ZN: 'region', ZNB: 'region', PRSH: 'admin3', LTER: 'region',
  STM: 'river', STMI: 'river', STMH: 'river', STMX: 'river', STMA: 'river', STMB: 'river', STMC: 'river', STMD: 'river', STMM: 'river', STMQ: 'river', STMS: 'river', STMSB: 'river', CNL: 'river', WAD: 'river', WADS: 'river',
  LK: 'lake', LKS: 'lake', LKN: 'lake', LKI: 'lake', LKO: 'lake', LKC: 'lake', LKSI: 'lake', LKSN: 'lake', LGN: 'lake', LGNS: 'lake', RSV: 'lake', RSVT: 'lake',
  BAY: 'bay', BAYS: 'bay', GULF: 'bay', COVE: 'bay', FJD: 'bay', FJDS: 'bay', INLT: 'bay', HBR: 'bay', CHN: 'bay', CHNM: 'bay', STRT: 'bay', SD: 'bay', ESTY: 'bay', SEA: 'sea', OCN: 'sea', LGNX: 'bay', ANCH: 'bay', RDST: 'bay',
  MT: 'mountain', MTS: 'mountain', HLL: 'mountain', HLLS: 'mountain', PK: 'mountain', PKS: 'mountain', RDGE: 'mountain', MESA: 'mountain', VLC: 'mountain', CRTR: 'mountain', SPUR: 'mountain', CLF: 'mountain', CRDG: 'mountain', BUTE: 'mountain', KNL: 'mountain', MND: 'mountain', DUNE: 'terrain', DUNS: 'terrain',
  PASS: 'pass', GAP: 'pass', GRGE: 'pass', CNYN: 'pass', SDL: 'pass',
  ISL: 'island', ISLS: 'island', ISLET: 'island', ATOL: 'island', ISLT: 'island', ISLF: 'island', ISLM: 'island', ISLX: 'island', RK: 'island', RKS: 'island',
  CAPE: 'cape', PT: 'cape', PEN: 'cape', PENX: 'cape', ISTH: 'cape', SPIT: 'cape', BCH: 'cape', BCHS: 'cape', HDLD: 'cape',
  PLN: 'terrain', PLAT: 'terrain', VAL: 'terrain', VALS: 'terrain', DSRT: 'terrain', STEP: 'terrain', UPLD: 'terrain', LOW: 'terrain', BSN: 'terrain', DPR: 'terrain', MRSH: 'terrain', SWMP: 'terrain', FLLS: 'terrain', FRST: 'terrain', FRSTF: 'terrain', GRSLD: 'terrain', HTH: 'terrain', MOOR: 'terrain', OAS: 'terrain', FORD: 'terrain', TMBL: 'terrain', RGN: 'region', RGNE: 'region', RGNH: 'region', AREA: 'region', LCTY: 'region', CST: 'cape', TRB: 'region', PRT: 'settlement', OILF: 'site', MILB: 'site', RESV: 'region', PRK: 'region', NVB: 'site',
  CSTL: 'fort', FT: 'fort', FTS: 'fort', WALLA: 'fort', TOWR: 'fort', BTL: 'site', RUIN: 'site', ANS: 'site', HSTS: 'site', MNMT: 'site', PAL: 'site', MSTY: 'site',
  CTRR: 'site', TMPL: 'site', PYR: 'site', PYRS: 'site', AMTH: 'site', ARCH: 'site', BDG: 'site', DAM: 'site', AIRB: 'site', AIRF: 'site', AIRP: 'site', PRN: 'site',
  CH: 'site', MSQE: 'site', SHRN: 'site', CVNT: 'site', LTHSE: 'site', MN: 'site', CAVE: 'site', SQR: 'site', CMP: 'site',
};
/** Always kept even without a Wikidata link: rare and the very places events are named after. */
const ALWAYS = new Set(['P', 'A', 'PASS', 'STRT', 'CAPE', 'BTL', 'CSTL', 'FT', 'FTS', 'RUIN', 'ANS', 'HSTS', 'SEA', 'OCN', 'GULF', 'BAY', 'ISL', 'ISLS', 'PEN', 'MTS', 'PLN', 'DSRT', 'RGN', 'RGNH', 'ZN', 'PCLH', 'WALLA']);
/** Codes too common to keep unless notable: buildings and minor features. */
const NOTABLE_ONLY = new Set(['site', 'river', 'lake', 'mountain', 'island', 'cape', 'terrain', 'bay', 'pass', 'fort', 'region']);
/** alternateNames "languages" that are codes, links or postcodes rather than names. */
const NOT_NAMES = new Set(['link', 'post', 'iata', 'icao', 'faac', 'abbr', 'fr_1793', 'tcid', 'unlc', 'wkdt', 'phon', 'piny', 'uicn', 'iso']);

const unzipLines = (zip: string, member?: string) => commandLines('unzip', ['-p', zip, ...(member ? [member] : [])]);

export async function loadGeonames(db: Database.Database, log: (s: string) => void): Promise<Record<string, number>> {
  if (GEONAMES_FILES.some(f => !existsSync(geonamesPath(f)))) return { incomplete: 1 };
  db.exec(`DELETE FROM place_name WHERE place_id < 1000000000; DELETE FROM place WHERE source = 'geonames';`);
  const alt = geonamesPath('alternateNamesV2.zip');

  // Pass 1: Wikidata links, and how many languages name each feature (a cheap notability signal).
  const wkdt = new Map<number, number>();
  const langs = new Uint8Array(20_000_000);
  let n = 0;
  for await (const line of unzipLines(alt, 'alternateNamesV2.txt')) {
    const f = line.split('\t');
    const id = Number(f[1]);
    if (!(id < langs.length)) continue;
    if (f[2] === 'wkdt') {
      const q = f[3].match(/^Q(\d+)$/);
      if (q && !wkdt.has(id)) wkdt.set(id, Number(q[1]));
    } else if (f[2] && !NOT_NAMES.has(f[2]) && langs[id] < 255) langs[id]++;
    if (++n % 5_000_000 === 0) log(`  alternate names pass 1: ${n}`);
  }
  log(`  ${wkdt.size} GeoNames features link a Wikidata item`);

  // Pass 2: the features themselves.
  const insertPlace = db.prepare(`INSERT INTO place (id, source, source_id, name, kind, fcode, country, admin1, population, lon, lat, qid) VALUES (?, 'geonames', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insertName = db.prepare(`INSERT OR IGNORE INTO place_name (name_norm, place_id, lang, name, historic) VALUES (?, ?, ?, ?, ?)`);
  const kept = new Uint8Array(20_000_000);
  const counts: Record<string, number> = {};
  let batch: string[][] = [];
  const flush = db.transaction((rows: string[][]) => {
    for (const f of rows) {
      const id = Number(f[0]);
      const kind = KINDS[f[7]] ?? KINDS[f[6]];
      insertPlace.run(id, id, f[1], kind, f[7] || f[6], f[8] || null, f[10] || null, Number(f[14]) || null, Number(f[5]), Number(f[4]), wkdt.get(id) ?? null);
      for (const name of new Set([f[1], f[2]])) {
        const norm = normName(name);
        if (norm) insertName.run(norm, id, '', name, 0);
      }
      kept[id] = 1;
      counts[kind] = (counts[kind] ?? 0) + 1;
    }
  });
  n = 0;
  for await (const line of unzipLines(geonamesPath('allCountries.zip'), 'allCountries.txt')) {
    const f = line.split('\t');
    if (f.length < 15) continue;
    const kind = KINDS[f[7]] ?? KINDS[f[6]];
    if (!kind) continue;
    const id = Number(f[0]);
    const notable = ALWAYS.has(f[6]) || ALWAYS.has(f[7]) || wkdt.has(id) || langs[id] >= 2;
    if (NOTABLE_ONLY.has(kind) && !notable) continue;
    if (kind === 'site' && !wkdt.has(id) && !ALWAYS.has(f[7])) continue;
    batch.push(f);
    if (batch.length >= 50_000) {
      flush(batch);
      batch = [];
    }
    if (++n % 2_000_000 === 0) log(`  features: ${n}`);
  }
  flush(batch);
  log(`  features kept: ${JSON.stringify(counts)}`);

  // Pass 3: their names in every language, historic names flagged.
  const insertAlt = db.prepare(`INSERT OR IGNORE INTO place_name (name_norm, place_id, lang, name, historic, valid_from, valid_to) VALUES (?, ?, ?, ?, ?, ?, ?)`);
  let names: string[][] = [];
  let altCount = 0;
  const flushNames = db.transaction((rows: string[][]) => {
    for (const f of rows) {
      const norm = normName(f[3]);
      if (!norm) continue;
      const from = Number(f[8]?.slice(0, 4));
      const to = Number(f[9]?.slice(0, 4));
      insertAlt.run(norm, Number(f[1]), f[2] ?? '', f[3], f[7] === '1' ? 1 : 0, f[8] && Number.isFinite(from) ? from : null, f[9] && Number.isFinite(to) ? to : null);
      altCount++;
    }
  });
  for await (const line of unzipLines(alt, 'alternateNamesV2.txt')) {
    const f = line.split('\t');
    const id = Number(f[1]);
    if (!kept[id] || NOT_NAMES.has(f[2]) || !f[3] || f[3].length > 100 || /^https?:/.test(f[3])) continue;
    names.push(f);
    if (names.length >= 100_000) {
      flushNames(names);
      names = [];
    }
  }
  flushNames(names);
  log(`  alternate names kept: ${altCount}`);

  // Country codes → their GeoNames country feature, for the resolver's country context.
  const info = readFileSync(geonamesPath('countryInfo.txt'), 'utf8').split('\n').filter(l => l && !l.startsWith('#')).map(l => l.split('\t'));
  const insertInfo = db.prepare(`INSERT OR REPLACE INTO country_info VALUES (?, ?, ?, ?, ?, ?, ?)`);
  db.transaction(() => {
    for (const r of info) insertInfo.run(r[0], r[1], r[4], r[5] || null, Number(r[16]) || null, Number(r[6]) || null, Number(r[7]) || null);
  })();
  return { ...counts, names: altCount, wikidataLinks: wkdt.size };
}
