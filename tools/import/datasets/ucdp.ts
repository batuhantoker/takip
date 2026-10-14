import { join } from 'node:path';
import { Prec } from '@takip/core/time';
import { GeoPrec, type EventEntityRow } from '@takip/db';
import { type Ctx, type Dataset, importDataset, mergePublish, RAW_MORE, sourceId } from '../context';
import { num, readCsv, text } from '../csv';
import { utc } from '../dates';
import { anchor, EventBatch, resolveCanonical } from '../events';
import { Resolver } from '../resolver';
import { SeriesBatch } from '../series';
import { readWikiTable, wikiTablePath } from '../wiki';
import { middleEvent, readGedPoints } from './ucdp-ged';

const DIR = join(RAW_MORE, 'ucdp');
const FILE = join(DIR, 'BattleDeaths_v26_1_conf.csv');
/** Only places the conflicts: the user chose not to load GED's events (2026-10-14). */
const GED = join(DIR, 'GEDEvent_v26_1.csv');
const AS_OF = '2026-06-08';

const INCOMPATIBILITY: Record<string, string> = { 1: 'territory', 2: 'government', 3: 'territory and government' };
const TYPE: Record<string, string> = { 1: 'extrasystemic', 2: 'interstate', 3: 'intrastate', 4: 'internationalized intrastate' };
const REGION: Record<string, string> = { 1: 'Europe', 2: 'Middle East', 3: 'Asia', 4: 'Africa', 5: 'Americas' };

type Row = Record<string, string>;

/**
 * UCDP conflicts that WAC or COW also list, matched by hand like cow.ts's WAC_MATCHES: `from rel to`, each
 * `ucdp:`, `wac:` or `cow:` and that source's id. BRD starts in 1989, so a same_as UCDP row can be a war's
 * tail. part_of runs from the narrower one: a WAC war inside a UCDP conflict, or a UCDP dyad inside a WAC war.
 */
export const WAR_MATCHES: [from: string, rel: 'same_as' | 'part_of', to: string, confidence: number][] = [
  ['ucdp:275', 'same_as', 'wac:CNF-0045', 1], // Ethiopia: Eritrea / Eritrean War of Independence
  ['ucdp:331', 'same_as', 'wac:CNF-0046', 1], // Morocco: Western Sahara / Western Sahara War
  ['ucdp:327', 'same_as', 'wac:CNF-0035', 1], // Angola: Government (UNITA) / Angolan Civil War
  ['ucdp:352', 'same_as', 'wac:CNF-0043', 1], // Sri Lanka: Eelam / Sri Lankan Civil War
  ['ucdp:371', 'same_as', 'wac:CNF-0053', 1], // Iraq, Kuwait / Gulf War
  ['ucdp:382', 'same_as', 'wac:CNF-0064', 1], // Sierra Leone: Government / Sierra Leone Civil War
  ['ucdp:384', 'same_as', 'wac:CNF-0054', 1], // Serbia: Slovenia / Slovenian War of Independence
  ['ucdp:394', 'same_as', 'wac:CNF-0070', 1], // Moldova: Dniestr / Transnistria War
  ['ucdp:392', 'same_as', 'wac:CNF-0069', 1], // Georgia: Abkhazia / War in Abkhazia
  ['ucdp:403', 'same_as', 'cow:217', 1], // Ecuador, Peru: Cordillera del Condor / Cenepa Valley
  ['ucdp:409', 'same_as', 'wac:CNF-0073', 0.8], // Eritrea, Ethiopia: border / Eritrean-Ethiopian War; UCDP adds a 2016 clash
  ['ucdp:412', 'same_as', 'wac:CNF-0057', 1], // Serbia: Kosovo / Kosovo War
  ['ucdp:13692', 'same_as', 'cow:225', 1], // Afghanistan, UK, USA (2001) / Invasion of Afghanistan
  ['ucdp:420', 'same_as', 'cow:227', 1], // Australia, Iraq, UK, USA (2003) / Invasion of Iraq
  ['ucdp:297', 'same_as', 'wac:CNF-0088', 1], // Nigeria: Government (JAS) / Boko Haram Insurgency
  ['ucdp:299', 'same_as', 'wac:CNF-0085', 1], // Syria: Government / Syrian Civil War
  ['ucdp:11347', 'same_as', 'wac:CNF-0102', 0.8], // Mali: Government / Mali War; UCDP starts with AQIM in 2009
  ['ucdp:13306', 'same_as', 'wac:CNF-0089', 0.8], // Ukraine: Novorossiya / War in Donbas
  ['ucdp:14129', 'same_as', 'wac:CNF-0104', 1], // Cameroon: Ambazonia / Anglophone Crisis
  ['ucdp:13243', 'same_as', 'wac:CNF-0092', 0.8], // Russia, Ukraine: Crimea / Russo-Ukrainian War (full-scale invasion)
  ['ucdp:260', 'part_of', 'wac:CNF-0041', 1], // Lebanon: Government (Aoun) → Lebanese Civil War
  ['ucdp:376', 'part_of', 'wac:CNF-0063', 1], // USSR: Nagorno-Karabakh → First Nagorno-Karabakh War
  ['ucdp:380', 'part_of', 'wac:CNF-0068', 0.8], // Georgia: Government → Georgian Civil War / South Ossetia War
  ['ucdp:385', 'part_of', 'wac:CNF-0055', 1], // Serbia: Croatia → Croatian War of Independence
  ['ucdp:390', 'part_of', 'wac:CNF-0055', 1], // Croatia: Serb → Croatian War of Independence
  ['ucdp:389', 'part_of', 'wac:CNF-0056', 1], // Bosnia: Serb → Bosnian War
  ['ucdp:398', 'part_of', 'wac:CNF-0056', 1], // Bosnia: Croat → Bosnian War
  ['ucdp:397', 'part_of', 'wac:CNF-0056', 1], // Bosnia: Bihaca Krajina → Bosnian War
  ['ucdp:13246', 'part_of', 'wac:CNF-0089', 1], // Ukraine: Donetsk → War in Donbas
  ['ucdp:13247', 'part_of', 'wac:CNF-0089', 1], // Ukraine: Lugansk → War in Donbas
  ['ucdp:14845', 'part_of', 'wac:CNF-0103', 1], // Mozambique: Islamic State → Cabo Delgado Insurgency
  ['wac:CNF-0037', 'part_of', 'ucdp:332', 1], // Mozambican Civil War → Mozambique: Government
  ['wac:CNF-0074', 'part_of', 'ucdp:309', 1], // Second Sudanese Civil War → Sudan: Government
  ['wac:CNF-0075', 'part_of', 'ucdp:309', 1], // Darfur War → Sudan: Government
  ['wac:CNF-0093', 'part_of', 'ucdp:309', 1], // Sudanese Civil War (2023-) → Sudan: Government (RSF)
  ['wac:CNF-0105', 'part_of', 'ucdp:234', 1], // First Intifada → Israel: Palestine
  ['wac:CNF-0106', 'part_of', 'ucdp:234', 1], // Second Intifada → Israel: Palestine
  ['wac:CNF-0094', 'part_of', 'ucdp:234', 1], // Gaza War → Israel: Palestine
  ['wac:CNF-0095', 'part_of', 'ucdp:426', 1], // Israel-Hezbollah War → Israel: Southern Lebanon
  ['wac:CNF-0063', 'part_of', 'ucdp:388', 1], // First Nagorno-Karabakh War → Azerbaijan: Artsakh
  ['wac:CNF-0090', 'part_of', 'ucdp:388', 1], // Second Nagorno-Karabakh War → Azerbaijan: Artsakh
  ['wac:CNF-0076', 'part_of', 'ucdp:333', 1], // Afghan Civil War (1989-2001) → Afghanistan: Government
  ['wac:CNF-0078', 'part_of', 'ucdp:333', 0.8], // War in Afghanistan (2001-2021) → Afghanistan: Government
  ['wac:CNF-0079', 'part_of', 'ucdp:259', 0.8], // Iraq War → Iraq: Government
  ['wac:CNF-0065', 'part_of', 'ucdp:341', 1], // First Liberian Civil War → Liberia: Government
  ['wac:CNF-0066', 'part_of', 'ucdp:341', 1], // Second Liberian Civil War → Liberia: Government
  ['wac:CNF-0067', 'part_of', 'ucdp:337', 1], // Somali Civil War → Somalia: Government
  ['wac:CNF-0071', 'part_of', 'ucdp:395', 1], // Tajikistani Civil War → Tajikistan: Government
  ['wac:CNF-0061', 'part_of', 'ucdp:401', 1], // First Chechen War → Russia: Chechnya
  ['wac:CNF-0062', 'part_of', 'ucdp:401', 1], // Second Chechen War → Russia: Chechnya
  ['wac:CNF-0059', 'part_of', 'ucdp:283', 1], // First Congo War → DR Congo: Government
  ['wac:CNF-0060', 'part_of', 'ucdp:283', 1], // Second Congo War → DR Congo: Government
  ['wac:CNF-0099', 'part_of', 'ucdp:283', 1], // Kivu Conflict / M23 Resurgence → DR Congo: Government
  ['wac:CNF-0077', 'part_of', 'ucdp:419', 1], // First Ivorian Civil War → Ivory Coast: Government
  ['wac:CNF-0084', 'part_of', 'ucdp:419', 1], // Second Ivorian Civil War → Ivory Coast: Government
  ['wac:CNF-0080', 'part_of', 'ucdp:404', 1], // War in North-West Pakistan → Pakistan: Government
  ['wac:CNF-0082', 'part_of', 'ucdp:393', 1], // Russo-Georgian War → Georgia: South Ossetia
  ['wac:CNF-0083', 'part_of', 'ucdp:11346', 1], // First Libyan Civil War → Libya: Government
  ['wac:CNF-0087', 'part_of', 'ucdp:11346', 1], // Second Libyan Civil War → Libya: Government
  ['wac:CNF-0101', 'part_of', 'ucdp:416', 1], // CAR Civil War → CAR: Government
  ['wac:CNF-0100', 'part_of', 'ucdp:11345', 1], // South Sudanese Civil War → South Sudan: Government
  ['wac:CNF-0086', 'part_of', 'ucdp:230', 1], // Yemeni Civil War → Yemen: Government
  ['wac:CNF-0091', 'part_of', 'ucdp:267', 1], // Tigray War → Ethiopia: Government (TPLF)
  ['wac:CNF-0098', 'part_of', 'ucdp:222', 1], // Myanmar Civil War → Myanmar: Government (NUG)
  ['wac:CNF-0096', 'part_of', 'ucdp:14609', 0.8], // Twelve-Day War → Iran, Israel: Government
  ['wac:CNF-0072', 'part_of', 'ucdp:218', 1], // Kargil War → India, Pakistan: Kashmir
];

const codes = (v: string | undefined) => (v ?? '').split(',').map(s => s.trim()).filter(Boolean);
const labels = (v: string | undefined, map: Record<string, string>) => codes(v).map(c => map[c] ?? c);

/** Splits an actor list on ", " except inside parentheses: "Military faction (forces of Honasan, Abenina & Zumel)". */
export function splitActors(s: string): string[] {
  const out: string[] = [];
  let cur = '';
  for (const part of s.split(', ')) {
    cur = cur ? `${cur}, ${part}` : part;
    if ((cur.match(/\(/g)?.length ?? 0) <= (cur.match(/\)/g)?.length ?? 0)) {
      out.push(cur.trim());
      cur = '';
    }
  }
  if (cur) out.push(cur.trim());
  return out.filter(Boolean);
}

/** side_b_id is sorted by number and side_b by name, so ids are pinned by intersecting rows, then elimination. */
export function actorNames(rows: { ids: string[]; names: string[] }[]) {
  const cand = new Map<string, Set<string>>();
  for (const { ids, names } of rows)
    for (const id of ids) {
      const prev = cand.get(id);
      cand.set(id, prev ? new Set([...prev].filter(n => names.includes(n))) : new Set(names));
    }
  const known = new Map<string, string>();
  for (let changed = true; changed; ) {
    changed = false;
    for (const [id, names] of cand)
      if (!known.has(id) && names.size === 1) {
        known.set(id, [...names][0]);
        changed = true;
      }
    for (const { ids, names } of rows) {
      const taken = new Set(ids.map(i => known.get(i)));
      const openIds = ids.filter(i => !known.has(i));
      const openNames = names.filter(n => !taken.has(n));
      if (openIds.length === 1 && openNames.length === 1) {
        known.set(openIds[0], openNames[0]);
        changed = true;
      }
    }
  }
  // Names repeat across conflicts (BRA, NRF), so only names pinned within the same row are ruled out.
  const ambiguous = new Map<string, string[]>();
  for (const { ids, names } of rows) {
    const taken = new Set(ids.map(i => known.get(i)));
    for (const id of ids.filter(i => !known.has(i))) {
      const open = names.filter(n => !taken.has(n));
      const prev = ambiguous.get(id);
      ambiguous.set(id, prev ? prev.filter(n => open.includes(n)) : open);
    }
  }
  for (const list of ambiguous.values()) list.sort();
  return { known, ambiguous };
}

/** Collects one conflict's parties across its years; each row gets the span of years it held. */
class Parties {
  private m = new Map<string, { entityId: number; role: string; side: number; lo: number; hi: number }>();
  add(entityId: number, role: string, side: number, year: number) {
    const key = `${entityId}|${role}|${side}`;
    const p = this.m.get(key);
    if (!p) this.m.set(key, { entityId, role, side, lo: year, hi: year });
    else {
      p.lo = Math.min(p.lo, year);
      p.hi = Math.max(p.hi, year);
    }
  }
  ids(role: string) {
    return [...this.m.values()].filter(p => p.role === role).map(p => p.entityId);
  }
  rows(): EventEntityRow[] {
    return [...this.m.values()].map(p => ({ entityId: p.entityId, role: p.role, side: p.side, tLo: utc(p.lo), tHi: utc(p.hi + 1) }));
  }
}

const bareName = (n: string) => n.replace(/^Government of /, '');

export async function importUcdp(ctx: Ctx) {
  await importDataset(
    ctx,
    {
      source: 'ucdp-brd',
      version: '26.1',
      asOf: AS_OF,
      files: [FILE, GED, wikiTablePath('ucdp-brd')],
      skipped: [
        { file: join(DIR, 'ucdp-brd-conf-261-csv.zip'), duplicateOf: FILE },
        { file: join(DIR, 'ged261-csv.zip'), duplicateOf: GED },
        ...['GEDEvent_v26_01_26_06.csv', 'GEDEvent_v26_0_7.csv', 'GEDEvent_v26_0_8.csv'].map(f => ({ file: join(DIR, f), reason: 'GED Candidate 2026: not loaded' })),
      ],
      importerVersion: '4',
    },
    async ds => {
      const r = new Resolver(ctx);
      const rep = ds.report;
      const rows = await readCsv(FILE);
      const wiki = await readWikiTable('ucdp-brd');
      const ged = await readGedPoints(GED);

      const isState = (row: Row) => !!row.gwno_b && splitActors(row.side_b).some(n => n.startsWith('Government of ') || r.byName(n, utc(Number(row.year))) !== undefined);
      const { known, ambiguous } = actorNames(
        rows.filter(row => !isState(row)).map(row => {
          const ids = codes(row.side_b_id);
          return { ids, names: ids.length === 1 ? [row.side_b.trim()] : splitActors(row.side_b) };
        }),
      );
      rep.extra.actors = { named: known.size, ambiguous: Object.fromEntries(ambiguous) };

      /** Codes and names don't pair by position, so they compare as sets; names win when all resolve. */
      const states = (row: Row, codeCol: string, names: string[], t: number) => {
        const named = names.map(n => r.byName(bareName(n), t));
        const byNames = named.length && named.every(id => id !== undefined) ? new Set(named as number[]) : undefined;
        const out = new Set<number>();
        for (const c of codes(row[codeCol])) {
          const id = r.resolve('gw', c, t);
          if (id === undefined) rep.miss(byNames ? `gw:${c} (names used)` : `gw:${c}`);
          else out.add(id);
        }
        if (!byNames) return [...out];
        if ([...out].some(id => !byNames.has(id)))
          rep.reject(`${codeCol} codes disagree with their names (names used)`, `${row.conflict_id} ${row.year}: ${row[codeCol]} vs ${names.join('; ')}`);
        return [...byNames];
      };

      const conflicts = new Map<string, Row[]>();
      for (const row of rows) {
        rep.rows++;
        if (num(row.year) === null) {
          rep.reject('bad year', `${row.conflict_id} ${row.year}`);
          continue;
        }
        const list = conflicts.get(row.conflict_id) ?? [];
        list.push(row);
        conflicts.set(row.conflict_id, list);
      }

      const batch = new EventBatch(ctx, ds);
      let placed = 0;
      for (const [id, years] of conflicts) {
        years.sort((a, b) => Number(a.year) - Number(b.year));
        const first = years[0];
        const last = years[years.length - 1];
        const parties = new Parties();
        const dyads = new Set<number>();
        const sideB: string[] = [];
        const types: string[] = [];
        let deaths = 0;
        for (const row of years) {
          const year = Number(row.year);
          const t = utc(year);
          for (const e of states(row, 'gwno_loc', splitActors(row.location_inc), t)) parties.add(e, 'location', 0, year);
          for (const e of states(row, 'gwno_a', splitActors(row.side_a), t)) parties.add(e, 'side_a', 1, year);
          for (const e of states(row, 'gwno_a_2nd', splitActors(row.side_a_2nd), t)) parties.add(e, 'supporter', 1, year);
          for (const e of states(row, 'gwno_b_2nd', splitActors(row.side_b_2nd), t)) parties.add(e, 'supporter', 2, year);
          if (isState(row)) for (const e of states(row, 'gwno_b', splitActors(row.side_b), t)) parties.add(e, 'side_b', 2, year);
          else
            for (const actor of codes(row.side_b_id)) {
              const cands = ambiguous.get(actor);
              const name = known.get(actor) ?? (cands?.length ? `${cands.join(' / ')} (UCDP actor ${actor})` : `UCDP actor ${actor}`);
              if (!known.has(actor)) rep.miss(`ucdp_actor:${actor} name ambiguous: ${cands?.join(' | ') ?? row.side_b}`);
              parties.add(r.ensure('org', 'ucdp_actor', actor, name, ds.sourceId), 'side_b', 2, year);
            }
          for (const d of codes(row.dyad_id)) dyads.add(Number(d));
          for (const n of codes(row.side_b_id).length === 1 ? [row.side_b.trim()] : splitActors(row.side_b)) if (!sideB.includes(n)) sideB.push(n);
          const type = TYPE[row.type_of_conflict] ?? row.type_of_conflict;
          if (!types.includes(type)) types.push(type);
          deaths += num(row.bd_best) ?? 0;
        }

        const territory = text(first.territory_name);
        const events = ged.get(id) ?? [];
        const middle = middleEvent(events);
        if (middle) placed++;
        else rep.miss(`ged:${id} (no placed events; country midpoint used)`);
        batch.add({
          kind: 'conflict.armed',
          sourceRecordId: id,
          title: `${first.location_inc}: ${territory ?? 'Government'}`,
          tStart: utc(Number(first.year)),
          tStartPrec: Prec.year,
          tEnd: utc(Number(last.year)),
          tEndPrec: Prec.year,
          ...(middle ? { lon: middle.lon, lat: middle.lat, geoPrec: GeoPrec.area } : anchor(r, null, null, GeoPrec.country, parties.ids('location'))),
          magnitude: deaths,
          attrs: {
            incompatibility: INCOMPATIBILITY[first.incompatibility] ?? first.incompatibility,
            type_of_conflict: TYPE[last.type_of_conflict] ?? last.type_of_conflict,
            ...(types.length > 1 ? { types_of_conflict: types } : {}),
            territory_name: territory,
            region: labels(first.region, REGION),
            location: first.location_inc,
            side_a: first.side_a,
            side_b: sideB,
            dyads: [...dyads].sort((a, b) => a - b),
            ...(middle ? { placed_at: `middle of its ${events.length.toLocaleString('en-US')} recorded clashes (UCDP GED)` } : {}),
            wiki: wiki.get(id) ?? null,
          },
          entities: parties.rows(),
        });
      }
      const published = batch.finish();
      rep.extra.ged = { placed, conflicts: conflicts.size };

      const series = new SeriesBatch(ctx, ds);
      const metric = (code: string, name: string) =>
        series.metric({ code: `ucdp:${code}`, name, unit: 'deaths', granularity: 'year', agg: 'sum', topic: 'conflict' });
      const metrics = [
        ['bd_best', metric('bd_best', 'Battle-related deaths (best estimate)')],
        ['bd_low', metric('bd_low', 'Battle-related deaths (low estimate)')],
        ['bd_high', metric('bd_high', 'Battle-related deaths (high estimate)')],
      ] as const;
      for (const [id, years] of conflicts) {
        const eventId = ctx.events.eventId(ds.sourceId, id);
        if (eventId === undefined) throw new Error(`ucdp-brd: event ${id} was not written`);
        for (const row of years)
          for (const [col, metricId] of metrics)
            series.add(metricId, 'event', eventId, { t: utc(Number(row.year)), v: num(row[col]), prec: Prec.year });
      }

      const publish = mergePublish(published, series.finish());
      linkWars(ctx, ds);
      return publish;
    },
  );
}

/** WAR_MATCHES as relations; WAC and COW stay canonical because CANONICAL_ORDER ranks them first. */
function linkWars(ctx: Ctx, ds: Dataset) {
  const sources = { ucdp: [ds.sourceId], wac: [sourceId(ctx, 'wac1914')], cow: [sourceId(ctx, 'cow-interstate'), sourceId(ctx, 'cow-extra')] };
  const find = (key: string) => {
    const [scheme, record] = key.split(':') as [keyof typeof sources, string];
    for (const s of sources[scheme]) {
      const id = ctx.events.eventId(s, record);
      if (id !== undefined) return id;
    }
    return undefined;
  };
  if (find('wac:CNF-0001') === undefined || find('cow:106') === undefined) {
    ds.report.extra.links = 'skipped: wac1914 or cow-interstate is not loaded; re-run ucdp-brd after them';
    return;
  }
  const n = { same_as: 0, part_of: 0 };
  ctx.history.transaction(() => {
    ctx.events.clearRelations(ds.sourceId);
    for (const [from, rel, to, confidence] of WAR_MATCHES) {
      const a = find(from);
      const b = find(to);
      if (a === undefined || b === undefined) {
        ds.report.miss(`link ${from} → ${to}`);
        continue;
      }
      ctx.events.relate(a, rel, b, confidence, ds.sourceId);
      n[rel]++;
    }
  })();
  const canonical = resolveCanonical(ctx);
  ctx.events.rebuildTimeline([ctx.events.family('conflict.armed')]);
  ds.report.extra.links = { ...n, canonical_updated: canonical };
}
