import { join } from 'node:path';
import { GeoPrec } from '@takip/db';
import { type Ctx, importDataset } from '../context';
import { EventBatch } from '../events';
import { ATTACKS, BATTLES, DIR, read, sitelinkFiles, wdPoint, type Row } from './wikidata';
import { addRows, ATROCITIES_AS_OF, atrocityKind, itemsOf } from './wikidata-conflict';
import { loadRecovery, recoverFiles } from './wikidata-recover';

/* Expulsions, deportations, ethnic cleansing and forced marches from Wikidata (CC0); fetch.ts `conflicts`. */

const DISPLACEMENTS = join(DIR, 'displacements.json');
/** Files whose items the earlier Wikidata sources hold; a massacre or pogrom that was also an expulsion is theirs. */
const HELD = ['wars', 'revolutions', 'massacres'].map(f => join(DIR, `${f}.json`));

type Origin = { lon: number; lat: number; geoPrec: GeoPrec; placedAt: string };

/** Where each one set out from (P1427), for the items Wikidata gives no point or location of their own. */
export function origins(rows: Row[]): Map<string, Origin> {
  const at = new Map<string, Origin>();
  for (const r of rows) {
    const p = wdPoint(r.fromCoord);
    if (p) at.set(r.item, { ...p, geoPrec: GeoPrec.area, placedAt: 'start of its route' });
  }
  return at;
}

export async function importWikidataDisplacements(ctx: Ctx) {
  const spec = { source: 'wikidata-displacements', version: ATROCITIES_AS_OF, asOf: ATROCITIES_AS_OF, files: [DISPLACEMENTS, ...sitelinkFiles(), ...recoverFiles()], importerVersion: '2' };
  await importDataset(ctx, spec, async ds => {
    const batch = new EventBatch(ctx, ds);
    const rows = read<Row[]>(DISPLACEMENTS);
    addRows(batch, ds.report, rows, itemsOf(BATTLES, ATTACKS, ...HELD), atrocityKind, origins(rows), loadRecovery());
    return batch.finish();
  });
}
