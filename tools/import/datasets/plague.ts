import { join } from 'node:path';
import { Prec } from '@takip/core/time';
import { type EventInput, GeoPrec } from '@takip/db';
import { type Ctx, importDataset, RAW_MORE, type Reporter } from '../context';
import { num, readCsv } from '../csv';
import { utc } from '../dates';
import { EventBatch } from '../events';

/** fetch.ts `plague`: the CSV inside EnviDat's zip, cp1252 with CRLF. */
export const PLAGUE_CSV = join(RAW_MORE, 'plague', 'Historical_plague_outbreaks.txt');
/** The file's own date; EnviDat has had no new version since. */
const VERSION = '2012-08-27';

const FIRST = 1347;
const LAST = 1900;
/** Europe, North Africa and the Levant, the list's reach (Lisbon to Moscow, Cairo to Finland). */
const BOX = { w: -25, e: 60, s: 25, n: 72 };

export type PlagueEvent = Omit<EventInput, 'sourceId' | 'datasetId'>;

/**
 * One event per town and year. The file's columns are swapped: `Lat_WGS84` holds the longitude and `Lon_WGS84`
 * the latitude (Barcelona reads 2.17, 41.39).
 */
export function plagueEvents(rows: Record<string, string>[], rep: Reporter): PlagueEvent[] {
  const seen = new Set<string>();
  const out: PlagueEvent[] = [];
  for (const r of rows) {
    rep.rows++;
    const town = (r.Location ?? '').trim();
    const year = num(r.Year_of_Outbreak);
    const lon = num(r.Lat_WGS84);
    const lat = num(r.Lon_WGS84);
    // "Eisleben, Lutherstadt" is unquoted: its comma shifts every column and the latitude falls off the end.
    if (num(r.X_Coord_ERTS89) === null) {
      rep.reject('comma in the town name shifted the columns', `${town},${r.X_Coord_ERTS89}`);
      continue;
    }
    if (year === null || !Number.isInteger(year) || year < FIRST || year > LAST) {
      rep.reject(`year outside ${FIRST}–${LAST}`, `${town} ${r.Year_of_Outbreak}`);
      continue;
    }
    if (lon === null || lat === null || lon < BOX.w || lon > BOX.e || lat < BOX.s || lat > BOX.n) {
      rep.reject('point outside Europe and the Mediterranean', `${town} ${lon},${lat}`);
      continue;
    }
    const key = `${town}:${year}`;
    if (seen.has(key)) {
      rep.reject('town and year listed twice', key);
      continue;
    }
    seen.add(key);
    out.push({
      kind: 'disaster.epidemic',
      sourceRecordId: key,
      title: `Plague outbreak — ${town}`,
      tStart: utc(year),
      tStartPrec: Prec.year,
      lon,
      lat,
      geoPrec: GeoPrec.city,
      attrs: { disease: 'plague' },
    });
  }
  rep.extra.towns = new Set(out.map(e => `${e.lon},${e.lat}`)).size;
  return out;
}

/**
 * Plague outbreaks in Europe and the Mediterranean, 1347–1900: Biraben's (1975–76) list by town and year, as
 * Büntgen et al. (2012) digitised it.
 */
export async function importPlague(ctx: Ctx) {
  await importDataset(ctx, { source: 'plague-outbreaks', version: VERSION, asOf: VERSION, files: [PLAGUE_CSV], importerVersion: '1' }, async ds => {
    const batch = new EventBatch(ctx, ds);
    for (const e of plagueEvents(await readCsv(PLAGUE_CSV), ds.report)) batch.add(e);
    return batch.finish();
  });
}
