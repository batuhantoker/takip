import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Prec } from '@takip/core/time';
import { GeoPrec } from '@takip/db';
import { type Ctx, importDataset, RAW_MORE } from '../context';
import { num, readCsv, text } from '../csv';
import { utc } from '../dates';
import { EventBatch, validLonLat } from '../events';
import { articleFiles, Articles } from '../articles';

const FILE = join(RAW_MORE, 'nuclear', 'nuclear_explosions.csv');
/** fetch.ts `test-series`. */
const SERIES = join(RAW_MORE, 'wikidata', 'test-series.json');
const AS_OF = '2019-08-20';

const COUNTRIES: Record<string, string> = { USA: 'United States', USSR: 'Soviet Union', UK: 'United Kingdom', FRANCE: 'France', CHINA: 'China', INDIA: 'India', PAKIST: 'Pakistan' };
/** SIPRI purpose codes; a test can list several ("WR/SE"). */
const PURPOSES: Record<string, string> = {
  COMBAT: 'wartime use', FMS: 'soviet test, study phenomenon of nuclear explosion', ME: 'military exercise', PNE: 'peaceful nuclear explosion',
  SAM: 'soviet test, accident mode simulation', SB: 'safety test', SE: 'verifying the effects of a nuclear explosion', TRANSP: 'transportation-storage purposes',
  WE: 'British test, effects of nuclear weapons', WR: 'weapons development programme',
};

const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());

/** SIPRI's misspelt site names. */
const SITE_ALIASES: Record<string, string> = { 'BASHKI RUSS': 'BASHKIR RUSS' };
/**
 * Sites where no test has coordinates, from ru.wikipedia's list of Soviet peaceful nuclear explosions: Fakel's own
 * article, the Klivazh mine's town, and the region for the rest.
 */
const SITE_PLACES: Record<string, { lon: number; lat: number; geoPrec: GeoPrec; place: string }> = {
  'PAMUK UZBEK': { lon: 66.08333, lat: 38.83333, geoPrec: GeoPrec.area, place: 'Kashkadarya Region' },
  UKRAINE: { lon: 35.47361, lat: 49.55917, geoPrec: GeoPrec.exact, place: 'Krestyshche gas field (Fakel)' },
  UKEAINE: { lon: 38.27389, lat: 48.22056, geoPrec: GeoPrec.city, place: 'Yunokommunarovsk (Klivazh)' },
  'TUYMEN RUSS': { lon: 70.16667, lat: 62.25, geoPrec: GeoPrec.area, place: 'Khanty-Mansi Autonomous Okrug' },
};

const letters = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

const DAY = 86_400_000;

/**
 * A named test's series article, when Wikidata lists that test under the series within a day of it. Labels are
 * the bare name ("Otowi") or carry the series' ("Hardtack Juniper").
 */
export function seriesByTest(tests: { title: string; label: string; day: string }[]) {
  const byName = new Map<string, { title: string; t: number }[]>();
  for (const s of tests) {
    const t = Date.parse(s.day);
    const words = s.label.trim().split(/\s+/);
    for (const key of new Set([letters(s.label), ...(words.length > 1 ? [letters(words[words.length - 1])] : [])])) {
      if (!key) continue;
      const list = byName.get(key) ?? [];
      list.push({ title: s.title, t });
      byName.set(key, list);
    }
  }
  return (name: string, t: number) => byName.get(letters(name))?.find(m => Math.abs(m.t - t) <= DAY)?.title ?? null;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

/** SIPRI's nuclear explosions 1945–1998 (Bergkvist and Ferm, 2000), as TidyTuesday republished them. */
export async function importNuclear(ctx: Ctx) {
  const seriesFile = existsSync(SERIES) ? [SERIES] : [];
  await importDataset(ctx, { source: 'sipri-nuclear', version: AS_OF, asOf: AS_OF, files: [FILE, ...articleFiles(), ...seriesFile], importerVersion: '7' }, async ds => {
    const rep = ds.report;
    const batch = new EventBatch(ctx, ds);
    const rows = await readCsv(FILE);
    const articles = Articles.read();
    const series = seriesFile.length ? seriesByTest(JSON.parse(readFileSync(SERIES, 'utf8'))) : null;
    const site = (r: Record<string, string>) => SITE_ALIASES[r.region] ?? r.region;
    const day = (r: Record<string, string>) => `${r.date_long}|${site(r)}`;
    const sameDay = new Map<string, number>();
    for (const r of rows) sameDay.set(day(r), (sameDay.get(day(r)) ?? 0) + 1);
    // A test without coordinates sits at the median of its site's other tests.
    const located = new Map<string, { lon: number[]; lat: number[] }>();
    for (const r of rows) {
      const lon = num(r.longitude);
      const lat = num(r.latitude);
      if (!validLonLat(lon, lat)) continue;
      const pts = located.get(site(r)) ?? { lon: [], lat: [] };
      pts.lon.push(lon!);
      pts.lat.push(lat!);
      located.set(site(r), pts);
    }
    const placeOf = (r: Record<string, string>) => {
      const pts = located.get(site(r));
      if (pts) return { lon: median(pts.lon), lat: median(pts.lat), geoPrec: GeoPrec.area, place: `median of ${pts.lon.length} tests at the site` };
      return SITE_PLACES[site(r)];
    };

    for (const r of rows) {
      rep.rows++;
      const m = r.date_long.match(/^(\d{4})(\d{2})(\d{2})$/);
      if (!m) {
        rep.reject('bad date_long', `${r.id_no} ${r.date_long}`);
        continue;
      }
      const lon = num(r.longitude);
      const lat = num(r.latitude);
      const ok = validLonLat(lon, lat);
      const placed = ok ? undefined : placeOf(r);
      const at = ok ? { lon: lon!, lat: lat! } : (placed ?? null);
      const t = utc(Number(m[1]), Number(m[2]), Number(m[3]));
      const name = text(r.name);
      // A test's own article: named for it ("Castle Bravo" for BRAVO), or for an unnamed test the site's only one
      // that day, since a day either side also matches. Else the series Wikidata lists it under, else one by date range.
      const own = articles?.event(['nuclear test'], t, Prec.day, at, 300, { minPrec: Prec.day }) ?? null;
      const fits = own && (name ? letters(own).includes(letters(name)) : sameDay.get(day(r)) === 1);
      const wiki = (fits ? own : null)
        ?? (name && series?.(name, t))
        ?? articles?.event(['nuclear test series'], t, Prec.day, at, 800, { spans: true, minPrec: Prec.day }) ?? null;
      if (placed) rep.sentinel(`no coordinates → ${placed.place.startsWith('median') ? 'site median' : placed.place}`);
      const country = COUNTRIES[r.country] ?? r.country;
      const purposes = (r.purpose ?? '').split('/').map(p => p.trim()).filter(Boolean);
      const combat = purposes.includes('COMBAT');
      const lo = num(r.yield_lower);
      const hi = num(r.yield_upper);
      batch.add({
        kind: combat ? 'nuclear.combat' : 'nuclear.test',
        // id_no repeats once (74044: a US and a French test in 1974).
        sourceRecordId: `${r.id_no}:${r.date_long}`,
        title: name ? `${titleCase(name)} (${country})` : `${country} nuclear test`,
        tStart: t,
        tStartPrec: Prec.day,
        lon: ok ? lon : (placed?.lon ?? null),
        lat: ok ? lat : (placed?.lat ?? null),
        geoPrec: ok ? GeoPrec.exact : (placed?.geoPrec ?? GeoPrec.none),
        magnitude: hi || lo || null,
        attrs: {
          site: titleCase(r.region ?? ''),
          ...(placed ? { placed_at: placed.place } : {}),
          wiki: combat ? 'Atomic bombings of Hiroshima and Nagasaki' : wiki,
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
