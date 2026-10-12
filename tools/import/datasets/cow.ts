import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { expand, Prec } from '@takip/core/time';
import { GeoPrec, type EventEntityRow } from '@takip/db';
import { type Ctx, type Dataset, importDataset, mergePublish, type Reporter, RAW, sourceId } from '../context';
import { num, readCsv, text } from '../csv';
import { type Stated, ymd } from '../dates';
import { anchor, EventBatch, resolveCanonical } from '../events';
import { Resolver } from '../resolver';

const DIR = join(RAW, 'wars');
const f = (name: string) => join(DIR, name);
/** The Kaggle compilation's file date; it adds rows up to 2022 to COW v4.0. */
const AS_OF = '2023-10-26';

const WAR_LIST = f('war_list_1816_2010.csv');
const TERRITORIAL = f('territorial_changes_since_1816.csv');

/** The compiler's rows: not COW data. */
const EXTRA_WARS = new Set(['99999', '999999', '99999900']);

/** Name-only rows (ccode NA): parties read off WarName, and where the fighting was when the row's own point is wrong. */
const NAME_ONLY: Record<string, { parties: string[]; foughtIn?: string }> = {
  '99999': { parties: ['371', '373'] },
  '999999': { parties: ['365', '369'], foughtIn: '369' },
};

/** stage.manual_fix: coordinates dropped, the event falls back to its parties. */
const DROP_POINT: Record<string, string> = {
  '999999': 'lat/lng 36.305,50.251 is in northern Iran',
};

/**
 * COW wars that WAC also lists, matched by hand (dataset-import-map.md §2.2), never fuzzily at run time.
 * same_as when both describe one war; part_of when COW codes only the interstate phase of a longer WAC war.
 */
export const WAC_MATCHES: [warNum: string, wac: string, rel: 'same_as' | 'part_of', confidence: number][] = [
  ['106', 'CNF-0001', 'same_as', 1], // World War I
  ['139', 'CNF-0013', 'same_as', 1], // World War II
  ['109', 'CNF-0006', 'same_as', 1], // Russo-Polish / Polish-Soviet War
  ['124', 'CNF-0008', 'same_as', 1], // Chaco
  ['127', 'CNF-0009', 'same_as', 1], // Conquest of Ethiopia / Second Italo-Ethiopian War
  ['130', 'CNF-0011', 'same_as', 0.8], // Third Sino-Japanese; COW ends it where it merges into WWII
  ['142', 'CNF-0012', 'same_as', 1], // Russo-Finnish / Winter War
  ['147', 'CNF-0017', 'same_as', 1], // First Kashmir
  ['148', 'CNF-0018', 'same_as', 1], // Arab-Israeli 1948
  ['151', 'CNF-0019', 'same_as', 1], // Korean
  ['155', 'CNF-0023', 'same_as', 1], // Sinai War / Suez Crisis
  ['160', 'CNF-0050', 'same_as', 1], // Assam / Sino-Indian War
  ['166', 'CNF-0027', 'same_as', 1], // Second Kashmir / Indo-Pakistani War of 1965
  ['169', 'CNF-0028', 'same_as', 1], // Six-Day War
  ['175', 'CNF-0031', 'same_as', 1], // Football War
  ['181', 'CNF-0033', 'same_as', 1], // Yom Kippur War
  ['184', 'CNF-0051', 'same_as', 1], // Turco-Cypriot / Turkish Invasion of Cyprus
  ['187', 'CNF-0047', 'same_as', 1], // Second Ogaden War, Phase 2 / Ogaden War
  ['189', 'CNF-0048', 'same_as', 0.8], // Vietnamese-Cambodian; WAC runs on through the occupation
  ['193', 'CNF-0049', 'same_as', 1], // Sino-Vietnamese Punitive
  ['199', 'CNF-0039', 'same_as', 1], // Iran-Iraq
  ['202', 'CNF-0040', 'same_as', 1], // Falklands
  ['205', 'CNF-0042', 'same_as', 1], // War over Lebanon / 1982 Lebanon War
  ['211', 'CNF-0053', 'same_as', 1], // Gulf War
  ['219', 'CNF-0073', 'same_as', 1], // Badme Border / Eritrean-Ethiopian War
  ['221', 'CNF-0057', 'same_as', 0.8], // War for Kosovo; WAC also covers 1998
  ['223', 'CNF-0072', 'same_as', 1], // Kargil
  ['99999', 'CNF-0090', 'same_as', 1], // Armenia v Azerbaijan / Second Nagorno-Karabakh War
  ['999999', 'CNF-0092', 'same_as', 1], // 2022 Russo-Ukraine war
  ['115', 'CNF-0007', 'part_of', 1], // Second Greco-Turkish → Turkish War of Independence
  ['116', 'CNF-0007', 'part_of', 1], // Franco-Turkish → Turkish War of Independence
  ['163', 'CNF-0026', 'part_of', 1], // Vietnam War, Phase 2 → Vietnam War
  ['178', 'CNF-0032', 'part_of', 1], // Bangladesh (Dec 1971) → Bangladesh Liberation War
  ['186', 'CNF-0035', 'part_of', 1], // War over Angola → Angolan Civil War
  ['215', 'CNF-0056', 'part_of', 1], // Bosnian Independence → Bosnian War
  ['216', 'CNF-0063', 'part_of', 1], // Azeri-Armenian → First Nagorno-Karabakh War
  ['225', 'CNF-0078', 'part_of', 1], // Invasion of Afghanistan → War in Afghanistan (2001-2021)
  ['227', 'CNF-0079', 'part_of', 1], // Invasion of Iraq → Iraq War
  ['99999900', 'CNF-0013', 'part_of', 1], // World War II in Asia (approx) → World War II
];

/** COW Inter-State War v4.0 codebook. */
const WHERE_FOUGHT: Record<number, string> = {
  1: 'W. Hemisphere',
  2: 'Europe',
  4: 'Africa',
  6: 'Middle East',
  7: 'Asia',
  9: 'Oceania',
  11: 'Europe & Middle East',
  12: 'Europe & Asia',
  13: 'W. Hemisphere & Asia',
  14: 'Europe, Africa & Middle East',
  15: 'Europe, Africa, Middle East & Asia',
  16: 'Africa, Middle East, Asia & Oceania',
  17: 'Asia & Oceania',
  18: 'Africa & Middle East',
  19: 'Europe, Africa, Middle East, Asia & Oceania',
};

const OUTCOME: Record<number, string> = {
  1: 'winner',
  2: 'loser',
  3: 'compromise',
  4: 'transformed into another type of war',
  5: 'ongoing',
  6: 'stalemate',
  7: 'continues below war level',
  8: 'changed sides',
};

type CowDate = Stated & { raw?: string };

/** COW date parts: -9 (unknown) and NA lower the precision; a -8 or missing year means there is no date. */
export function cowDate(rep: Reporter, y: string, m: string, d: string): CowDate | null {
  const year = num(y);
  if (year === null || year < 0) return null;
  const month = num(m);
  const day = num(d);
  const s = ymd(year, month, day)!;
  if (s.prec === Prec.day) return s;
  if (month === -9) rep.sentinel('month -9 → year prec');
  else if (month === null) rep.sentinel('month NA → year prec');
  else if (day === -9) rep.sentinel('day -9 → month prec');
  else rep.sentinel('day NA → month prec');
  return { ...s, raw: `${y}-${m}-${d}` };
}

const lo = (s: Stated) => expand(s.t, s.prec).lo;
const hi = (s: Stated) => expand(s.t, s.prec).hi;

const tRaw = (start: CowDate, end: CowDate) =>
  start.raw || end.raw ? { t_raw: { ...(start.raw ? { start: start.raw } : {}), ...(end.raw ? { end: end.raw } : {}) } } : {};

/** One event-entity row per (entity, role, side, spell): the store's primary key. */
class Parties {
  rows: EventEntityRow[] = [];
  private keys = new Set<string>();
  add(e: EventEntityRow) {
    const k = `${e.entityId}|${e.role}|${e.side ?? 0}|${e.spell ?? 1}`;
    if (this.keys.has(k)) return;
    this.keys.add(k);
    this.rows.push(e);
  }
}

export async function importCowInterstate(ctx: Ctx) {
  await importDataset(
    ctx,
    {
      source: 'cow-interstate',
      version: AS_OF,
      asOf: AS_OF,
      files: [WAR_LIST],
      skipped: ['war_list_1816_2010_long_format.csv', 'wars_with_approximate_location.csv'].map(s => ({ file: f(s), duplicateOf: WAR_LIST })),
      importerVersion: '1',
    },
    async ds => {
      const r = new Resolver(ctx);
      const rep = ds.report;

      const wars = new Map<string, Record<string, string>[]>();
      for (const row of await readCsv(WAR_LIST)) {
        rep.rows++;
        const list = wars.get(row.WarNum) ?? [];
        list.push(row);
        wars.set(row.WarNum, list);
      }

      const cow = new EventBatch(ctx, ds);
      const extraSrc = sourceId(ctx, 'cow-extra');
      const extra = new EventBatch(ctx, ds, extraSrc);
      const fixes: { record: string; fix: string }[] = [];

      for (const [warNum, rows] of wars) {
        const isExtra = EXTRA_WARS.has(warNum) || rows.some(p => p.ccode === 'NA');
        const parties = new Parties();
        const seen = new Set<string>();
        const spans: [CowDate, CowDate][] = [];
        const span = (s: CowDate, e: CowDate) => spans.push([s, e]);
        const whereFought = new Set<number>();

        for (const p of rows) {
          const s1 = cowDate(rep, p.StartYear1, p.StartMonth1, p.StartDay1);
          if (!s1) {
            rep.reject('no start year', `${warNum}:${p.ccode}`);
            continue;
          }
          const e1 = cowDate(rep, p.EndYear1, p.EndMonth1, p.EndDay1) ?? s1;
          span(s1, e1);
          if (p.ccode === 'NA') continue;

          // The compiler's country join duplicated one Cyprus row (war 184) with a different centroid.
          const key = `${p.ccode}|${p.Side}`;
          if (seen.has(key)) {
            rep.reject('duplicate participant row', `${warNum}:${p.ccode}:${p.Side}`);
            continue;
          }
          seen.add(key);

          const side = p.Side === '1' ? 1 : p.Side === '2' ? 2 : 0;
          const role = side === 1 ? 'side_a' : side === 2 ? 'side_b' : 'participant';
          const where = num(p.WhereFought);
          if (where !== null) whereFought.add(where);
          if (p.BatDeath === '-9') rep.sentinel('BatDeath -9 → null');
          if (p.TransFrom === '-8') rep.sentinel('TransFrom -8 → null');
          if (p.TransTo === '-8') rep.sentinel('TransTo -8 → null');
          const outcome = num(p.Outcome);
          const attrs = {
            outcome,
            outcome_label: outcome === null ? null : (OUTCOME[outcome] ?? null),
            trans_from: num(p.TransFrom, ['-8']),
            trans_to: num(p.TransTo, ['-8']),
            bat_death: num(p.BatDeath, ['-9']),
            where_fought: where,
            ...tRaw(s1, e1),
          };

          const id = r.resolve('cow', p.ccode, s1.t);
          if (id === undefined) rep.miss(`cow:${p.ccode} ${p.StateName}`);
          else {
            parties.add({ entityId: id, role, side, spell: 1, tLo: lo(s1), tHi: hi(e1), attrs });
            if (p.Initiator === '1') parties.add({ entityId: id, role: 'initiator', side, spell: 1, tLo: lo(s1), tHi: hi(e1) });
          }

          const s2 = cowDate(rep, p.StartYear2, p.StartMonth2, p.StartDay2);
          if (!s2) {
            if (p.StartYear2 === '-8') rep.sentinel('StartYear2 -8 → no second spell');
            continue;
          }
          const e2 = cowDate(rep, p.EndYear2, p.EndMonth2, p.EndDay2) ?? s2;
          span(s2, e2);
          const id2 = r.resolve('cow', p.ccode, s2.t);
          if (id2 === undefined) rep.miss(`cow:${p.ccode} ${p.StateName}`);
          else parties.add({ entityId: id2, role, side, spell: 2, tLo: lo(s2), tHi: hi(e2), attrs: tRaw(s2, e2) });
        }
        if (!spans.length) continue;
        const start = spans.map(s => s[0]).reduce((a, b) => (lo(b) < lo(a) || (lo(b) === lo(a) && b.prec > a.prec) ? b : a));
        const end = spans.map(s => s[1]).reduce((a, b) => (hi(b) > hi(a) || (hi(b) === hi(a) && b.prec > a.prec) ? b : a));

        const named = NAME_ONLY[warNum];
        for (const code of named?.parties ?? []) {
          const id = r.resolve('cow', code, start.t);
          if (id === undefined) rep.miss(`cow:${code}`);
          else parties.add({ entityId: id, role: 'participant', attrs: { inferred_from: 'WarName' } });
        }

        const first = rows[0];
        let lon = num(first.lng);
        let lat = num(first.lat);
        if (DROP_POINT[warNum]) {
          fixes.push({ record: `cow-extra:${warNum}`, fix: `${DROP_POINT[warNum]}; dropped, anchored at the parties` });
          lon = lat = null;
        }
        const fallback = named?.foughtIn ? [r.resolve('cow', named.foughtIn, start.t)] : parties.rows.map(e => e.entityId);
        const at = anchor(r, lon, lat, GeoPrec.approximate, fallback);
        const deaths = num(first.total_battle_deaths);

        (isExtra ? extra : cow).add({
          kind: 'war.interstate',
          sourceRecordId: warNum,
          title: text(first.WarName),
          tStart: start.t,
          tStartPrec: start.prec,
          tEnd: end.t,
          tEndPrec: end.prec,
          ...at,
          magnitude: deaths === null ? null : Math.round(deaths),
          confidence: isExtra ? 0.5 : 1,
          attrs: {
            where_fought: [...whereFought].sort((a, b) => a - b).map(c => ({ code: c, label: WHERE_FOUGHT[c] ?? null })),
            total_battle_deaths: deaths,
            ...(isExtra ? { added_by_compiler: true } : {}),
            ...tRaw(start, end),
          },
          entities: parties.rows,
        });
      }

      const publish = mergePublish(cow.finish(), extra.finish());
      rep.extra.manual_fixes = fixes;
      linkWac(ctx, ds, extraSrc);
      return publish;
    },
  );
}

/** same_as / part_of to WAC from the checked-in table, then WAC becomes canonical (newer, counts civilians). */
function linkWac(ctx: Ctx, ds: Dataset, extraSrc: number) {
  const wac = sourceId(ctx, 'wac1914');
  if (ctx.events.eventId(wac, 'CNF-0001') === undefined) {
    ds.report.extra.links = 'skipped: wac1914 is not loaded; re-run cow-interstate after it';
    return;
  }
  const n = { same_as: 0, part_of: 0 };
  ctx.history.transaction(() => {
    // Rebuilt from the table each run, so a row dropped from it doesn't linger.
    ctx.events.clearRelations(ds.sourceId);
    for (const [warNum, cnf, rel, confidence] of WAC_MATCHES) {
      const from = ctx.events.eventId(ds.sourceId, warNum) ?? ctx.events.eventId(extraSrc, warNum);
      const to = ctx.events.eventId(wac, cnf);
      if (from === undefined || to === undefined) {
        ds.report.miss(`link ${warNum} → ${cnf}`);
        continue;
      }
      ctx.events.relate(from, rel, to, confidence, ds.sourceId);
      n[rel]++;
    }
  })();
  const canonical = resolveCanonical(ctx);
  // Canonical ids changed after the batches rebuilt the bins; only canonical events are counted.
  ctx.events.rebuildTimeline([ctx.events.family('war.interstate')]);
  ds.report.extra.links = { ...n, canonical_updated: canonical };
}

/**
 * iso3c is the modern successor's code and names are COW's for the whole span ("Germany", "Russia", "Yugoslavia").
 * The polity's own COW code at `t` gives the state of the day: DEU in 1866 is Prussia, RUS in 1940 the USSR.
 */
function stateOfTheDay(ctx: Ctx, r: Resolver) {
  const codes = new Map<number, Set<string>>();
  const rows = ctx.catalog.prepare(`
    SELECT i.entity_id AS id, i.value FROM core_entity_identifier i JOIN core_id_scheme s USING (scheme_id) WHERE s.code = 'cow'
  `).all() as { id: number; value: string }[];
  for (const row of rows) {
    const set = codes.get(row.id) ?? new Set();
    set.add(row.value);
    codes.set(row.id, set);
  }
  return (id: number, t: number) => {
    for (const c of codes.get(id) ?? []) {
      const e = r.resolve('cow', c, t);
      if (e !== undefined) return e;
    }
    return id;
  };
}

export async function importCowTerritorial(ctx: Ctx) {
  await importDataset(
    ctx,
    {
      source: 'cow-territorial',
      version: AS_OF,
      asOf: AS_OF,
      files: [TERRITORIAL],
      skipped: ['territorial_changes_since_1945.csv', 'conquests_since_1816.csv', 'conquests_since_1945.csv'].map(s => ({ file: f(s), duplicateOf: TERRITORIAL })),
      importerVersion: '1',
    },
    async ds => {
      const r = new Resolver(ctx);
      const rep = ds.report;
      const ofTheDay = stateOfTheDay(ctx, r);
      const eras = new Map<string, number>();
      const names = new Map<number, string>();
      for (const e of ctx.catalog.prepare(`SELECT entity_id AS id, name FROM core_entity`).all() as { id: number; name: string }[]) names.set(e.id, e.name);

      const polity = (iso3: string, name: string | null, t: number) => {
        if (!name) {
          rep.sentinel('country NA → no polity (non-state)');
          return undefined;
        }
        const found = r.resolve('iso3', text(iso3), t) ?? r.byName(name, t, { politiesOnly: true });
        if (found === undefined) {
          rep.miss(text(iso3) ? `iso3:${iso3} ${name}` : `name:${name}`);
          return undefined;
        }
        const id = ofTheDay(found, t);
        if (id !== found) {
          const k = `${name} → ${names.get(id)}`;
          eras.set(k, (eras.get(k) ?? 0) + 1);
        }
        return id;
      };

      const batch = new EventBatch(ctx, ds);
      const seen = new Map<string, Set<string>>();
      for (const row of await readCsv(TERRITORIAL)) {
        rep.rows++;
        const year = num(row.year);
        const t = year === null ? null : ymd(year);
        if (!t) {
          rep.reject('bad year', JSON.stringify(row));
          continue;
        }
        const type = row.type.replace(/\s*\n\s*/g, ' ').trim();
        const gainName = text(row.country_gaining);
        const loseName = text(row.country_losing);
        if (!gainName && !loseName) {
          rep.reject('gaining and losing both NA (not drawable)', JSON.stringify(row));
          continue;
        }

        const hash = createHash('sha1').update([row.year, row.country_gaining, row.country_losing, type, row.area].join('\x1f')).digest('hex');
        const full = Object.values(row).join('\x1f');
        const same = seen.get(hash) ?? new Set();
        seen.set(hash, same);
        if (same.has(full)) {
          rep.reject('exact duplicate row', `${row.year} ${gainName} ← ${loseName}: ${type}`);
          continue;
        }
        const ordinal = same.size;
        same.add(full);

        const gaining = polity(row.iso3c_gaining, gainName, t.t);
        const losing = polity(row.iso3c_losing, loseName, t.t);
        const entities: EventEntityRow[] = [];
        if (gaining !== undefined) entities.push({ entityId: gaining, role: 'gaining' });
        if (losing !== undefined) entities.push({ entityId: losing, role: 'losing' });

        if (row.pop.trim() === '.') rep.sentinel('pop . → null');
        if (row.area.trim() === '.') rep.sentinel('area . → null');
        const word = type.split(' ')[0].toLowerCase();
        const process = word === 'mandated' ? 'mandate' : word;

        batch.add({
          kind: 'change.territorial',
          sourceRecordId: `${hash}:${ordinal}`,
          title: `${loseName ?? 'Non-state territory'} → ${gainName ?? 'non-state entity'} (${process})`,
          tStart: t.t,
          tStartPrec: Prec.year,
          ...anchor(r, null, null, GeoPrec.country, [losing ?? gaining]),
          attrs: {
            process,
            type,
            pop: num(row.pop),
            area_km2: num(row.area),
            gaining: gainName,
            losing: loseName,
          },
          entities,
        });
      }
      rep.extra.state_of_the_day = Object.fromEntries([...eras].sort((a, b) => b[1] - a[1]));
      return batch.finish();
    },
  );
}
