import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { Prec } from '@takip/core/time';
import { GeoPrec, type EventEntityRow } from '@takip/db';
import { type Ctx, importDataset, RAW } from '../context';
import { csvRecords, num } from '../csv';
import { utc, ymd } from '../dates';
import { anchor, EventBatch, validLonLat } from '../events';
import { normName } from '../names';
import { Resolver } from '../resolver';

const FILE = join(RAW, 'globalterrorism.csv');
const AS_OF = '2018-07-01';
const SENTINELS = ['-9', '-99'];

const KEY_COLS = ['iyear', 'imonth', 'iday', 'country', 'provstate', 'city', 'latitude', 'longitude', 'attacktype1', 'targtype1', 'target1', 'gname', 'nkill', 'nwound'];

/** eventid is Excel-mangled (1.97E+11) in this file, so rows are keyed by a hash of their identifying fields. */
export const rowHash = (rec: Record<string, string>) =>
  createHash('sha1').update(KEY_COLS.map(c => rec[c] ?? '').join('\x1f')).digest('hex');

const GEO: Record<string, GeoPrec> = { 1: GeoPrec.exact, 2: GeoPrec.city, 3: GeoPrec.area, 4: GeoPrec.area };

/** GTD names the seed has no polity for yet, by iso3. */
const LOCAL_ALIASES: Record<string, string> = { 'Northern Ireland': 'GBR', Corsica: 'FRA' };

const MONTHS = 'Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec';
const EXCEL_DATE = new RegExp(`^\\d{1,2}-(${MONTHS})$|^(${MONTHS})-\\d{2}$`);
/** Group names Excel turned into dates: 09-Feb, 01-May, Sep-11. */
export const excelDamaged = (s: string) => EXCEL_DATE.test(s.trim());

/** `m/d/yyyy` as epoch ms; dashed resolutions are ambiguous (d-m or m-d) and impossible days are refused. */
export function parseResolution(s: string): number | null {
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [mo, d, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1) return null;
  const t = utc(y, mo, d);
  return new Date(t).getUTCMonth() === mo - 1 ? t : null;
}

// log10(1 + dead + wounded/10): 0 none, 1 ≈ 9 dead, 2 ≈ 99 dead, 3 ≈ 999 dead.
export function severity(nkill: number | null, nwound: number | null) {
  if (nkill === null && nwound === null) return null;
  return Math.round(Math.log10(1 + (nkill ?? 0) + (nwound ?? 0) / 10) * 1000) / 1000;
}

const str = (v: string | undefined) => v?.trim() || null;

/** Drops nulls, empty strings and empty arrays/objects, so attrs carry only what the row has. */
export function compact(v: unknown): unknown {
  if (v === null || v === undefined || v === '') return undefined;
  if (Array.isArray(v)) {
    const a = v.map(compact).filter(x => x !== undefined);
    return a.length ? a : undefined;
  }
  if (typeof v === 'object') {
    const o: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) {
      const c = compact(x);
      if (c !== undefined) o[k] = c;
    }
    return Object.keys(o).length ? o : undefined;
  }
  return v;
}

/** Rows whose `related` lists share a GTD eventid, as groups of keys; a list need not include its own row's id. */
export function relatedGroups(lists: ReadonlyMap<string, readonly string[]>): string[][] {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r) ?? r;
    parent.set(x, r);
    return r;
  };
  for (const ids of lists.values()) {
    for (const id of ids) if (!parent.has(id)) parent.set(id, id);
    for (const id of ids.slice(1)) parent.set(find(id), find(ids[0]));
  }
  const groups = new Map<string, string[]>();
  for (const [key, ids] of lists) {
    if (!ids.length) continue;
    const root = find(ids[0]);
    groups.set(root, [...(groups.get(root) ?? []), key]);
  }
  return [...groups.values()].filter(g => g.length > 1);
}

const relatedIds = (s: string) => s.split(',').map(t => t.trim()).filter(t => /^\d{12}$/.test(t));

export async function importGtd(ctx: Ctx) {
  await importDataset(
    ctx,
    { source: 'gtd', version: '2018-07', asOf: AS_OF, files: [FILE], importerVersion: '2' },
    async ds => {
      const r = new Resolver(ctx);
      const rep = ds.report;
      const manualFix: Record<string, unknown>[] = [];

      const n = (rec: Record<string, string>, col: string) => {
        const v = rec[col]?.trim();
        if (v && SENTINELS.includes(v)) rep.sentinel(`${col} ${v} → null`);
        return num(v, SENTINELS);
      };

      const polity = (code: string, name: string, t: number) => {
        if (!code) return undefined;
        const known = r.resolve('gtd', code, t);
        if (known !== undefined) return known;
        const id = LOCAL_ALIASES[name] ? r.resolve('iso3', LOCAL_ALIASES[name], t) : r.byName(name, t);
        if (id === undefined) rep.miss(`gtd:${code} ${name}`);
        else r.remember('gtd', code, id, ds.sourceId);
        return id;
      };

      const batch = new EventBatch(ctx, ds);
      const seen = new Map<string, number>();
      const related = new Map<string, string[]>();
      for await (const rec of csvRecords(FILE)) {
        if (rec.__header__) continue;
        rep.rows++;
        const hash = rowHash(rec);
        const ordinal = seen.get(hash) ?? 0;
        seen.set(hash, ordinal + 1);
        const key = `row:${hash}:${ordinal}`;
        if (rec.related?.trim()) related.set(key, relatedIds(rec.related));

        const start = ymd(num(rec.iyear), num(rec.imonth), num(rec.iday));
        if (!start) {
          rep.reject('bad iyear', `${key} ${rec.iyear}`);
          continue;
        }
        const tRaw: Record<string, string> = {};
        if (start.prec !== Prec.day) {
          tRaw.start = `${rec.iyear}-${rec.imonth}-${rec.iday}`;
          rep.sentinel(start.prec === Prec.year ? 'imonth 0 → year precision' : 'iday 0 → month precision');
        }
        let tEnd: number | null = null;
        const res = rec.resolution.trim();
        if (res) {
          const end = rec.extended === '1' ? parseResolution(res) : null;
          if (end !== null && end >= start.t) tEnd = end;
          else {
            tRaw.end = res;
            rep.sentinel(
              rec.extended !== '1' ? 'resolution without extended → t_raw' : end === null ? 'resolution not m/d/yyyy → t_raw' : 'resolution before start → t_raw',
            );
          }
        }

        const countryId = polity(rec.country, rec.country_txt, start.t);
        let lon = num(rec.longitude);
        let lat = num(rec.latitude);
        if ((lon !== null || lat !== null) && !validLonLat(lon, lat)) {
          manualFix.push({ key, eventid: rec.eventid, latitude: rec.latitude, longitude: rec.longitude, fix: 'country point used' });
          lon = lat = null;
        } else if (lon === null || lat === null) rep.sentinel('latitude/longitude blank → country point');
        if (rec.specificity === '5') lon = lat = null;
        const at = anchor(r, lon, lat, GEO[rec.specificity] ?? GeoPrec.approximate, [countryId]);

        const parties = new Map<string, EventEntityRow>();
        const add = (entityId: number | undefined, role: string, attrs?: unknown) => {
          if (entityId === undefined || parties.has(`${entityId}|${role}`)) return;
          parties.set(`${entityId}|${role}`, { entityId, role, ...(attrs ? { attrs: attrs as Record<string, unknown> } : {}) });
        };
        add(countryId, 'location');
        const unlinked: string[] = [];
        for (const [g, sub, unsure] of [['gname', 'gsubname', 'guncertain1'], ['gname2', 'gsubname2', 'guncertain2'], ['gname3', 'gsubname3', 'guncertain3']]) {
          const name = str(rec[g]);
          if (!name || name === 'Unknown') continue;
          if (excelDamaged(name)) {
            rep.miss(`gtd:${g} excel-damaged ${name}`);
            unlinked.push(name);
            continue;
          }
          const org = r.ensure('org', 'native:gtd', normName(name), name, ds.sourceId);
          add(org, 'perpetrator', compact({ sub: str(rec[sub]), uncertain: rec[unsure] === '1' ? 1 : null }));
        }
        for (const i of ['1', '2', '3']) add(polity(rec[`natlty${i}`], rec[`natlty${i}_txt`], start.t), 'target_nationality');

        const nkill = n(rec, 'nkill');
        const nwound = n(rec, 'nwound');
        const place = [rec.city, rec.provstate, rec.country_txt].map(str).find(s => s && s !== 'Unknown');
        const attrs = compact({
          eventid: str(rec.eventid),
          related: str(rec.related),
          t_raw: tRaw,
          approxdate: str(rec.approxdate),
          region: str(rec.region_txt),
          provstate: str(rec.provstate),
          city: str(rec.city),
          location: str(rec.location),
          specificity: n(rec, 'specificity'),
          vicinity: n(rec, 'vicinity'),
          summary: str(rec.summary),
          crit: { 1: n(rec, 'crit1'), 2: n(rec, 'crit2'), 3: n(rec, 'crit3') },
          doubtterr: n(rec, 'doubtterr'),
          alternative: str(rec.alternative_txt),
          multiple: n(rec, 'multiple'),
          success: n(rec, 'success'),
          suicide: n(rec, 'suicide'),
          attack: [str(rec.attacktype1_txt), str(rec.attacktype2_txt), str(rec.attacktype3_txt)],
          targets: ['1', '2', '3'].map(i =>
            rec[`targtype${i}`]
              ? { type: str(rec[`targtype${i}_txt`]), subtype: str(rec[`targsubtype${i}_txt`]), corp: str(rec[`corp${i}`]), target: str(rec[`target${i}`]), natlty: str(rec[`natlty${i}_txt`]) }
              : null,
          ),
          groups_unlinked: unlinked,
          motive: str(rec.motive),
          individual: n(rec, 'individual'),
          nperps: n(rec, 'nperps'),
          nperpcap: n(rec, 'nperpcap'),
          claimed: n(rec, 'claimed'),
          claimmode: [str(rec.claimmode_txt), str(rec.claimmode2_txt), str(rec.claimmode3_txt)],
          compclaim: n(rec, 'compclaim'),
          weapons: ['1', '2', '3', '4'].map(i => (rec[`weaptype${i}`] ? { type: str(rec[`weaptype${i}_txt`]), subtype: str(rec[`weapsubtype${i}_txt`]) } : null)),
          weapdetail: str(rec.weapdetail),
          nkillus: n(rec, 'nkillus'),
          nkillter: n(rec, 'nkillter'),
          nwound,
          nwoundus: n(rec, 'nwoundus'),
          nwoundte: n(rec, 'nwoundte'),
          property: n(rec, 'property'),
          propextent: str(rec.propextent_txt),
          propvalue: n(rec, 'propvalue'),
          propcomment: str(rec.propcomment),
          hostages:
            rec.ishostkid === '1'
              ? {
                  n: n(rec, 'nhostkid'),
                  n_us: n(rec, 'nhostkidus'),
                  hours: n(rec, 'nhours'),
                  days: n(rec, 'ndays'),
                  divert: str(rec.divert),
                  country: str(rec.kidhijcountry),
                  ransom: n(rec, 'ransom'),
                  ransom_amt: n(rec, 'ransomamt'),
                  ransom_amt_us: n(rec, 'ransomamtus'),
                  ransom_paid: n(rec, 'ransompaid'),
                  ransom_paid_us: n(rec, 'ransompaidus'),
                  ransom_note: str(rec.ransomnote),
                  outcome: str(rec.hostkidoutcome_txt),
                  released: n(rec, 'nreleased'),
                }
              : null,
          addnotes: str(rec.addnotes),
          scite: [str(rec.scite1), str(rec.scite2), str(rec.scite3)],
          dbsource: str(rec.dbsource),
          int: { log: n(rec, 'INT_LOG'), ideo: n(rec, 'INT_IDEO'), misc: n(rec, 'INT_MISC'), any: n(rec, 'INT_ANY') },
        }) as Record<string, unknown>;

        batch.add({
          kind: 'attack.terror',
          sourceRecordId: key,
          title: `${str(rec.attacktype1_txt) ?? 'Attack'} — ${place ?? 'Unknown'}`,
          tStart: start.t,
          tStartPrec: start.prec,
          tEnd,
          tEndPrec: tEnd === null ? null : Prec.day,
          ...at,
          magnitude: nkill,
          severity: severity(nkill, nwound),
          attrs,
          entities: [...parties.values()],
        });
      }
      rep.extra.manual_fix = manualFix;
      rep.extra.duplicate_rows = [...seen.values()].reduce((s, c) => s + c - 1, 0);

      const publish = batch.finish();
      ctx.events.clearRelations(ds.sourceId);
      let links = 0;
      ctx.history.transaction(() => {
        for (const group of relatedGroups(related)) {
          const ids = group.map(k => ctx.events.eventId(ds.sourceId, k)).filter((id): id is number => id !== undefined);
          for (let i = 0; i < ids.length; i++) {
            for (let j = i + 1; j < ids.length; j++) ctx.events.relate(ids[i], 'related', ids[j], 1, ds.sourceId);
          }
          links += (ids.length * (ids.length - 1)) / 2;
        }
      })();
      rep.extra.links = { related: links };

      return {
        ...publish,
        gaps: [{ tLo: utc(1993), tHi: utc(1994), kind: 'missing', note: 'GTD lost its 1993 records; this release has none' }],
      };
    },
  );
}
