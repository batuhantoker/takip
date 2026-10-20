import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Prec } from '@takip/core/time';
import { type EventInput, GeoPrec } from '@takip/db';
import { type Ctx, importDataset, RAW_MORE, type Reporter } from '../context';
import { EventBatch, validLonLat } from '../events';

const FILE = join(RAW_MORE, 'cneos', 'fireballs.json');

export type FireballFile = { fetched: string; fields: string[]; data: (string | null)[][] };
type Ev = Omit<EventInput, 'sourceId' | 'datasetId'>;

const n = (v: string | null | undefined) => (v === null || v === undefined || v.trim() === '' ? null : Number(v));

/** Bolides US government sensors saw, at their peak brightness; energies are CNEOS's estimates. */
export function fireballEvents(file: FireballFile, rep: Reporter): Ev[] {
  const events: Ev[] = [];
  for (const row of file.data) {
    rep.rows++;
    const r = Object.fromEntries(file.fields.map((f, i) => [f, row[i]]));
    const lat = n(r.lat);
    const lon = n(r.lon);
    const at = { lon: lon !== null && r['lon-dir'] === 'W' ? -lon : lon, lat: lat !== null && r['lat-dir'] === 'S' ? -lat : lat };
    const t = Date.parse(`${r.date?.replace(' ', 'T')}Z`);
    if (!Number.isFinite(t)) {
      rep.reject('unreadable date', String(r.date));
      continue;
    }
    if (!validLonLat(at.lon, at.lat)) {
      rep.reject('no location', String(r.date));
      continue;
    }
    const impact = n(r['impact-e']);
    const radiated = n(r.energy);
    events.push({
      kind: 'hazard.fireball',
      sourceRecordId: r.date!,
      title: impact !== null ? `Fireball (${impact} kt)` : 'Fireball',
      tStart: t,
      tStartPrec: Prec.second,
      lon: at.lon,
      lat: at.lat,
      geoPrec: GeoPrec.exact,
      attrs: {
        impact_energy_kt: impact,
        // The API gives radiated energy in units of 10¹⁰ J.
        radiated_energy_gj: radiated !== null ? Math.round(radiated * 10 * 100) / 100 : null,
        altitude_km: n(r.alt),
        velocity_km_s: n(r.vel),
        url: 'https://cneos.jpl.nasa.gov/fireballs/',
      },
    });
  }
  return events;
}

/** CNEOS fireball reports (NASA JPL, public domain), 1988 → now. */
export async function importFireballs(ctx: Ctx) {
  const file = JSON.parse(readFileSync(FILE, 'utf8')) as FireballFile;
  await importDataset(ctx, { source: 'cneos-fireballs', version: file.fetched, asOf: file.fetched, files: [FILE], importerVersion: '1' }, async ds => {
    const batch = new EventBatch(ctx, ds);
    for (const e of fireballEvents(file, ds.report)) batch.add(e);
    return batch.finish();
  });
}
