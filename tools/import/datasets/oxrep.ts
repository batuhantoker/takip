import { join } from 'node:path';
import { Prec } from '@takip/core/time';
import { type EventInput, GeoPrec } from '@takip/db';
import { type Ctx, importDataset, RAW_MORE, type Reporter } from '../context';
import { num, text } from '../csv';
import { utc } from '../dates';
import { EventBatch, validLonLat } from '../events';
import { OXREP_FILE } from '../fetch-records';
import { openXlsx, type Row } from '../xlsx';
import { records } from './epica';

const FILE = join(RAW_MORE, 'oxrep', OXREP_FILE);
/** Labelled March 2017; the workbook was last saved 2025-11-04. */
const AS_OF = '2017-03-01';

type Ev = Omit<EventInput, 'sourceId' | 'datasetId'>;
type Rec = Record<string, string | undefined>;

const CARGO: [column: string, label: string][] = [['Amphorae', 'amphorae'], ['Marble', 'marble'], ['Columns etc', 'columns'], ['Sarcophagi', 'sarcophagi'], ['Blocks', 'stone blocks']];
const FLAG_COLS = [21, 22, 23, 24, 25];
const isFlag = (r: Row, c: number) => r.cells.get(c)?.v === '0' || r.cells.get(c)?.v === '1';

/** Two rows (Acquaviva, Acque Chiare) sit two columns right from Wreck ID on; their cargo flags give them away. */
export function realign(r: Row): Row {
  if (FLAG_COLS.every(c => isFlag(r, c)) || !FLAG_COLS.every(c => isFlag(r, c + 2))) return r;
  return { r: r.r, cells: new Map([...r.cells].map(([c, v]) => [c >= 11 ? c - 2 : c, v])) };
}

/** The sheet counts years as historians do, 150 BC as -150; 0 stands for the turn of the era (1 BC here). */
export const astronomical = (y: number) => (y < 0 ? y + 1 : y);

const era = (y: number) => (y < 0 ? `${-y} BC` : y === 0 ? 'the turn of the era' : `AD ${y}`);

export function oxrepEvents(recs: Rec[], rep: Reporter): Ev[] {
  const events: Ev[] = [];
  const seen = new Set<string>();
  for (const r of recs) {
    rep.rows++;
    const name = text(r['Wreck Name']) ?? text(r['Site Name']);
    const id = text(r['Wreck ID']);
    let key = id ? `wreck:${id}` : text(r.locid) ? `loc:${r.locid}` : `name:${name}`;
    for (let i = 2; seen.has(key); i++) key = `${key.replace(/#\d+$/, '')}#${i}`;
    seen.add(key);
    const lon = num(r.Longitude);
    const lat = num(r.Latitude);
    const lo = num(r['Earliest Date']);
    const hi = num(r['Latest Date']) ?? lo;
    if (!validLonLat(lon, lat)) {
      rep.reject('no coordinates', `${key} ${name}`);
      continue;
    }
    if (lo === null || hi === null) {
      rep.reject('no date', `${key} ${name}`);
      continue;
    }
    const cargo = CARGO.filter(([c]) => r[c] === '1').map(([, label]) => label);
    events.push({
      kind: 'accident.shipwreck',
      sourceRecordId: key,
      title: `Shipwreck — ${name}`,
      tStart: utc(astronomical(lo)),
      tStartPrec: Prec.year,
      tEnd: hi > lo ? utc(astronomical(hi)) : null,
      tEndPrec: hi > lo ? Prec.year : null,
      lon,
      lat,
      geoPrec: GeoPrec.approximate,
      attrs: {
        dated: text(r['Dating comment']) ?? (hi > lo ? `between ${era(lo)} and ${era(hi)}` : era(lo)),
        period: text(r.Period),
        cargo: cargo.length ? cargo : null,
        other_cargo: text(r['Other cargo']),
        depth: text(r.Depth),
        sea_area: text(r['Sea area']),
        region: text(r.Region),
        country: text(r.Country),
        parker_number: text(r['Parker Number']),
        stone_cargo: text(r['Stone cargo notes']),
        hull_remains: text(r['Hull remains']),
        estimated_tonnage: text(r['Estimated tonnage']),
        estimated_length: text(r['Estimated length']),
        comments: text(r.Comments),
        reference: text(r.Reference),
        placed_at: 'spot the source gives, blurred on purpose to deter looting',
      },
    });
  }
  return events;
}

/** OxREP Shipwrecks v2.1 (Strauss, Wilson and Flohr 2017): Mediterranean and nearby wrecks, 2500 BC – AD 1800. */
export async function importOxrep(ctx: Ctx) {
  await importDataset(ctx, { source: 'oxrep-shipwrecks', version: '2.1', asOf: AS_OF, files: [FILE], importerVersion: '1' }, async ds => {
    const rows = openXlsx(FILE).rows('Shipwrecks');
    const events = oxrepEvents(records([rows[0], ...rows.slice(1).map(realign)]), ds.report);
    const batch = new EventBatch(ctx, ds);
    for (const e of events) batch.add(e);
    return batch.finish();
  });
}
