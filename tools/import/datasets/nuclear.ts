import { join } from 'node:path';
import { Prec } from '@takip/core/time';
import { GeoPrec } from '@takip/db';
import { type Ctx, importDataset, RAW_MORE } from '../context';
import { num, readCsv, text } from '../csv';
import { utc } from '../dates';
import { EventBatch, validLonLat } from '../events';

const FILE = join(RAW_MORE, 'nuclear', 'nuclear_explosions.csv');
const AS_OF = '2019-08-20';

const COUNTRIES: Record<string, string> = { USA: 'United States', USSR: 'Soviet Union', UK: 'United Kingdom', FRANCE: 'France', CHINA: 'China', INDIA: 'India', PAKIST: 'Pakistan' };
/** SIPRI purpose codes; a test can list several ("WR/SE"). */
const PURPOSES: Record<string, string> = {
  COMBAT: 'wartime use', FMS: 'soviet test, study phenomenon of nuclear explosion', ME: 'military exercise', PNE: 'peaceful nuclear explosion',
  SAM: 'soviet test, accident mode simulation', SB: 'safety test', SE: 'verifying the effects of a nuclear explosion', TRANSP: 'transportation-storage purposes',
  WE: 'British test, effects of nuclear weapons', WR: 'weapons development programme',
};

const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());

/** SIPRI's nuclear explosions 1945–1998 (Bergkvist and Ferm, 2000), as TidyTuesday republished them. */
export async function importNuclear(ctx: Ctx) {
  await importDataset(ctx, { source: 'sipri-nuclear', version: AS_OF, asOf: AS_OF, files: [FILE], importerVersion: '1' }, async ds => {
    const rep = ds.report;
    const batch = new EventBatch(ctx, ds);
    for (const r of await readCsv(FILE)) {
      rep.rows++;
      const m = r.date_long.match(/^(\d{4})(\d{2})(\d{2})$/);
      if (!m) {
        rep.reject('bad date_long', `${r.id_no} ${r.date_long}`);
        continue;
      }
      const lon = num(r.longitude);
      const lat = num(r.latitude);
      const ok = validLonLat(lon, lat);
      const country = COUNTRIES[r.country] ?? r.country;
      const name = text(r.name);
      const purposes = (r.purpose ?? '').split('/').map(p => p.trim()).filter(Boolean);
      const lo = num(r.yield_lower);
      const hi = num(r.yield_upper);
      batch.add({
        kind: purposes.includes('COMBAT') ? 'nuclear.combat' : 'nuclear.test',
        // id_no repeats once (74044: a US and a French test in 1974).
        sourceRecordId: `${r.id_no}:${r.date_long}`,
        title: name ? `${titleCase(name)} (${country})` : `${country} nuclear test`,
        tStart: utc(Number(m[1]), Number(m[2]), Number(m[3])),
        tStartPrec: Prec.day,
        lon: ok ? lon : null,
        lat: ok ? lat : null,
        geoPrec: ok ? GeoPrec.exact : GeoPrec.none,
        magnitude: hi || lo || null,
        attrs: {
          site: titleCase(r.region ?? ''),
          yield_kt: lo !== null && hi !== null && lo !== hi ? `${lo}–${hi}` : (hi ?? lo),
          type: text(r.type)?.toLowerCase() ?? null,
          purpose: purposes.map(p => PURPOSES[p.split(':')[0]] ?? p).join(', ') || null,
          body_wave_magnitude: num(r.magnitude_body) || null,
          reported_by: text(r.source),
        },
      });
    }
    return batch.finish();
  });
}
