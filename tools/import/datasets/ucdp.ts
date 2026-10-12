import { join } from 'node:path';
import { Prec } from '@takip/core/time';
import { GeoPrec, PointFlag, type EventEntityRow } from '@takip/db';
import { type Ctx, type Gap, importDataset, mergePublish, RAW } from '../context';
import { num, readCsv, text } from '../csv';
import { utc } from '../dates';
import { anchor, EventBatch } from '../events';
import { Resolver } from '../resolver';
import { SeriesBatch } from '../series';

const FILE = join(RAW, 'battledeaths_global_1946_2025.csv');
const AS_OF = '2026-04-12';
const PRELIMINARY = '26.0';

const INCOMPATIBILITY: Record<string, string> = { 1: 'territory', 2: 'government', 3: 'territory and government' };
const TYPE: Record<string, string> = { 1: 'extrasystemic', 2: 'interstate', 3: 'intrastate', 4: 'internationalized intrastate' };
const REGION: Record<string, string> = { 1: 'Europe', 2: 'Middle East', 3: 'Asia', 4: 'Africa', 5: 'Americas' };

type Row = Record<string, string>;

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
    { source: 'ucdp-brd', version: '25.1', asOf: AS_OF, files: [FILE], importerVersion: '1' },
    async ds => {
      const r = new Resolver(ctx);
      const rep = ds.report;
      const rows = await readCsv(FILE);

      const isState = (row: Row) => !!row.gwno_b && splitActors(row.side_b).some(n => n.startsWith('Government of ') || r.byName(n, utc(Number(row.year))) !== undefined);
      const { known, ambiguous } = actorNames(
        rows.filter(row => row.version !== PRELIMINARY && !isState(row)).map(row => {
          const ids = codes(row.side_b_id);
          return { ids, names: ids.length === 1 ? [row.side_b.trim()] : splitActors(row.side_b) };
        }),
      );
      rep.extra.actors = { named: known.size, ambiguous: Object.fromEntries(ambiguous) };

      /** Codes and names don't pair by position, so they compare as sets; names win when all resolve (26.0 rows miscode). */
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
      const prelimYears = new Set<number>();
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
          const prelim = row.version === PRELIMINARY;
          if (prelim) prelimYears.add(year);
          for (const e of states(row, 'gwno_loc', splitActors(row.location_inc), t)) parties.add(e, 'location', 0, year);
          for (const e of states(row, 'gwno_a', splitActors(row.side_a), t)) parties.add(e, 'side_a', 1, year);
          for (const e of states(row, 'gwno_a_2nd', splitActors(row.side_a_2nd), t)) parties.add(e, 'supporter', 1, year);
          for (const e of states(row, 'gwno_b_2nd', splitActors(row.side_b_2nd), t)) parties.add(e, 'supporter', 2, year);
          if (isState(row)) for (const e of states(row, 'gwno_b', splitActors(row.side_b), t)) parties.add(e, 'side_b', 2, year);
          else
            for (const actor of codes(row.side_b_id)) {
              // The 26.0 rows number their actors 1–10, which are not UCDP actor ids; minting those would collide later.
              if (prelim) {
                rep.miss(`ucdp_actor:${actor} ${row.side_b} (${PRELIMINARY} row, id not UCDP's)`);
                continue;
              }
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
        batch.add({
          kind: 'conflict.armed',
          sourceRecordId: id,
          title: `${first.location_inc}: ${territory ?? 'Government'}`,
          tStart: utc(Number(first.year)),
          tStartPrec: Prec.year,
          tEnd: utc(Number(last.year)),
          tEndPrec: Prec.year,
          ...anchor(r, null, null, GeoPrec.country, parties.ids('location')),
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
            ...(years.some(y => y.version === PRELIMINARY) ? { preliminary: years.filter(y => y.version === PRELIMINARY).map(y => Number(y.year)) } : {}),
          },
          entities: parties.rows(),
        });
      }
      const events = batch.finish();

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
            series.add(metricId, 'event', eventId, {
              t: utc(Number(row.year)),
              v: num(row[col]),
              prec: Prec.year,
              flags: row.version === PRELIMINARY ? PointFlag.preliminary : 0,
            });
      }

      const gaps: Gap[] = [...prelimYears].sort((a, b) => a - b).map(y => ({
        tLo: utc(y),
        tHi: utc(y + 1),
        kind: 'preliminary',
        note: `${y} rows are UCDP version ${PRELIMINARY}, preliminary`,
      }));
      return mergePublish(events, { ...series.finish(), gaps });
    },
  );
}
