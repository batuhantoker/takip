import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Prec } from '@takip/core/time';
import { type EventInput, GeoPrec } from '@takip/db';
import { type Ctx, importDataset, RAW_MORE, type Reporter } from '../context';
import { num } from '../csv';
import { utc } from '../dates';
import { EventBatch, validLonLat } from '../events';
import { GCAT_FILES } from '../fetch-records';

const DIR = join(RAW_MORE, 'gcat');
const FILES = Object.fromEntries(Object.entries(GCAT_FILES).map(([k, f]) => [k, join(DIR, f)])) as Record<keyof typeof GCAT_FILES, string>;

type Row = Record<string, string>;
export type LaunchEvent = Omit<EventInput, 'sourceId' | 'datasetId'>;

/** GCAT's TSVs: a `#`-prefixed header, a `# Updated 2026 Oct 17 1831:51` line, then space-padded fields. */
export function parseTsv(body: string): { updated: string | null; rows: Row[] } {
  let header: string[] | null = null;
  let updated: string | null = null;
  const rows: Row[] = [];
  for (const line of body.split(/\r?\n/)) {
    if (!line.trim()) continue;
    if (line.startsWith('#')) {
      const m = /^# Updated (\d{4} \w{3} +\d{1,2})/.exec(line);
      if (m) updated = m[1];
      else if (!header) header = line.slice(1).split('\t').map(h => h.trim());
      continue;
    }
    if (!header) continue;
    const cells = line.split('\t');
    rows.push(Object.fromEntries(header.map((h, i) => [h, (cells[i] ?? '').trim()])));
  }
  return { updated, rows };
}

/** GCAT writes "-" for an empty field. */
const val = (s: string | undefined) => (s && s !== '-' ? s : null);

const MONTHS = 'jan feb mar apr may jun jul aug sep oct nov dec'.split(' ');
const DATE = /^(\d{4})(?: (?:([a-z]{3})(?: (\d{1,2})(?: (\d{2})(\d{2})(?::(\d{2}))?)?)?|q([1-4])))?$/i;

export type GcatDate = { t: number; prec: Prec; tEnd?: number; endPrec?: Prec; uncertain: boolean };

/** GCAT's vague dates: "1957 Oct 4 1928:34" to the second, "1942 Jun 13 1052", a day, a month, "1960 Q1", a year; "?" marks a guess. */
export function gcatDate(raw: string): GcatDate | null {
  let s = raw.trim().replace(/\s+/g, ' ');
  const uncertain = s.endsWith('?');
  if (uncertain) s = s.slice(0, -1).trim();
  const m = DATE.exec(s);
  if (!m) return null;
  const year = Number(m[1]);
  if (m[7]) {
    const first = Number(m[7]) * 3 - 2;
    return { t: utc(year, first), prec: Prec.month, tEnd: utc(year, first + 2), endPrec: Prec.month, uncertain };
  }
  if (!m[2]) return { t: utc(year), prec: Prec.year, uncertain };
  const month = MONTHS.indexOf(m[2].toLowerCase()) + 1;
  if (!month) return null;
  if (!m[3]) return { t: utc(year, month), prec: Prec.month, uncertain };
  const day = Number(m[3]);
  if (day < 1 || day > 31) return null;
  const base = utc(year, month, day);
  if (!m[4]) return { t: base, prec: Prec.day, uncertain };
  const [h, min, sec] = [Number(m[4]), Number(m[5]), Number(m[6] ?? 0)];
  if (h > 23 || min > 59 || sec > 59) return null;
  return { t: base + ((h * 60 + min) * 60 + sec) * 1000, prec: m[6] ? Prec.second : Prec.minute, uncertain };
}

/**
 * LaunchCode's first letter. Deep-space and near-orbital flights count as space launches; atmospheric, test,
 * high-altitude, reentry-test and crewed suborbital rockets as suborbital; lofted ICBM tests as missile tests.
 */
export const LAUNCH_KIND: Record<string, string> = {
  O: 'space.launch', D: 'space.launch', N: 'space.launch',
  S: 'space.suborbital', A: 'space.suborbital', H: 'space.suborbital', T: 'space.suborbital', R: 'space.suborbital', Y: 'space.suborbital',
  M: 'missile.test', L: 'missile.test',
};

const OUTCOME: Record<string, string> = { S: 'success', F: 'failure', U: 'unknown', E: 'pad explosion', A: 'pad abort' };

/** LaunchCode's second letter, with GCAT's success fraction when it gives one ("OF40"). */
export function outcome(code: string): string | null {
  const m = /^.([A-Z])(\d{2})?$/.exec(code);
  if (!m || !OUTCOME[m[1]]) return null;
  if (!m[2]) return OUTCOME[m[1]];
  return m[1] === 'S' ? `partial success (${Number(m[2])}%)` : `partial failure (${Number(m[2])}% success)`;
}

/** Sites on other worlds carry selenographic coordinates. */
const OFF_EARTH = new Set(['LUNA', 'MARS']);

type Located = { lon: number; lat: number; err: number | null; name: string | null };

const located = (r: Row | undefined): Located | null => {
  const lon = num(r?.Longitude);
  const lat = num(r?.Latitude);
  return r && validLonLat(lon, lat) ? { lon: lon!, lat: lat!, err: num(r.Error), name: val(r.Name) } : null;
};

/** The source's stated error in degrees: a pad is usually exact, a range or an ocean box is not. */
const precOf = (err: number | null) => (err !== null && err <= 0.01 ? GeoPrec.exact : err === null || err <= 0.5 ? GeoPrec.area : GeoPrec.approximate);

export type GcatTables = { sites: Row[]; pads: Row[]; orgs: Row[] };

/** One event per launch, at its pad when GCAT has the pad's point, else at its site; air launches at the drop point. */
export function gcatEvents(launches: Row[], t: GcatTables, rep: Reporter): LaunchEvent[] {
  const sites = new Map(t.sites.map(s => [s.Site, s]));
  const pads = new Map(t.pads.map(p => [`${p.Site}|${p.Code}`, p]));
  const orgs = new Map<string, string>();
  for (const o of t.orgs) if (!orgs.has(o.Code)) orgs.set(o.Code, val(o.EName) ?? val(o.Name) ?? o.Code);
  const kinds: Record<string, number> = {};
  const events: LaunchEvent[] = [];

  for (const r of launches) {
    rep.rows++;
    const tag = r.Launch_Tag;
    const code = r.LaunchCode;
    if (code.startsWith('!')) {
      rep.reject('not a real launch (code !)', tag);
      continue;
    }
    const kind = LAUNCH_KIND[code[0]];
    const ascent = val(r.Ascent_Site);
    const siteCode = (ascent ?? r.Launch_Site).replace(/\?$/, '');
    const padCode = val(ascent ? r.Ascent_Pad : r.Launch_Pad)?.replace(/\?$/, '');
    const site = sites.get(siteCode);
    if (code.startsWith('X') || OFF_EARTH.has(site?.StateCode ?? '')) {
      rep.reject('launched from another world', tag);
      continue;
    }
    if (!kind) {
      rep.reject(`unknown launch category ${code}`, tag);
      continue;
    }
    const date = gcatDate(r.Launch_Date);
    if (!date) {
      rep.reject('unreadable date', `${tag} ${r.Launch_Date}`);
      continue;
    }
    const pad = padCode ? located(pads.get(`${siteCode}|${padCode}`)) : null;
    const at = pad ?? located(site);
    if (!at) {
      rep.reject('no coordinates for the site', `${tag} ${ascent ?? r.Launch_Site}`);
      continue;
    }
    const guessed = (ascent ?? r.Launch_Site).endsWith('?');
    // A name cut short at the column width ("…Poligon,") ends with a comma; Location finishes it.
    const fullName = val(site?.Name);
    const siteName = (fullName?.endsWith(',') && val(site?.Location) ? `${fullName} ${site!.Location}` : fullName) ?? siteCode;
    const vehicle = [val(r.LV_Type), val(r.Variant)].filter(Boolean).join(' ') || null;
    const payload = val(r.Flight) ?? val(r.Mission);
    const apogee = num(r.Apogee);
    const agency = val(r.Agency)?.split('/').map(a => orgs.get(a) ?? a).join(', ') ?? null;
    kinds[kind] = (kinds[kind] ?? 0) + 1;
    events.push({
      kind,
      sourceRecordId: tag,
      title: [vehicle ?? 'Rocket', payload].filter(Boolean).join(' — '),
      tStart: date.t,
      tStartPrec: date.prec,
      tEnd: date.tEnd ?? null,
      tEndPrec: date.endPrec ?? null,
      lon: at.lon,
      lat: at.lat,
      geoPrec: guessed ? GeoPrec.approximate : precOf(at.err),
      ...(date.uncertain ? { confidence: 0.8 } : {}),
      attrs: {
        outcome: outcome(code),
        mission: val(r.Mission) !== payload ? val(r.Mission) : null,
        agency,
        site: siteName,
        pad: pad ? (pad.name ?? padCode) : (padCode ?? null),
        apogee_km: apogee !== null && apogee > 0 ? (r.Apoflag === '?' ? `~${apogee}` : apogee) : null,
        purpose: kind === 'space.launch' ? null : val(r.Category),
        vehicle,
        payload,
        flight_id: val(r.Flight_ID),
        platform: val(r.Platform),
        launch_tag: tag,
        ...(guessed ? { placed_at: `likely launch site, ${siteName} (the source marks it uncertain)` } : {}),
        ...(date.uncertain ? { date_uncertain: true } : {}),
      },
    });
  }
  rep.extra.kinds = kinds;
  return events;
}

const read = (path: string) => parseTsv(readFileSync(path, 'utf8'));

/** GCAT launches 1942 → now (J. McDowell, CC BY 4.0): orbital and deep-space, suborbital rockets and missile tests. */
export async function importGcat(ctx: Ctx) {
  const launches = read(FILES.launches);
  // The log is updated weekly; its own date names the version.
  const updated = launches.updated ? gcatDate(launches.updated) : null;
  const asOf = new Date(updated?.t ?? Date.now()).toISOString().slice(0, 10);
  await importDataset(ctx, { source: 'gcat-launches', version: asOf, asOf, files: Object.values(FILES), importerVersion: '1' }, async ds => {
    const events = gcatEvents(launches.rows, { sites: read(FILES.sites).rows, pads: read(FILES.pads).rows, orgs: read(FILES.orgs).rows }, ds.report);
    const batch = new EventBatch(ctx, ds);
    for (const e of events) batch.add(e);
    return batch.finish();
  });
}
