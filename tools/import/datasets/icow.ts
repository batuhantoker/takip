import { join } from 'node:path';
import { expand, Prec } from '@takip/core/time';
import { GeoPrec, type EventEntityRow, type EventInput } from '@takip/db';
import { type Ctx, importDataset, mergePublish, type Reporter, RAW } from '../context';
import { num, readCsv, text } from '../csv';
import { type Stated, utc, ymd } from '../dates';
import { EventBatch } from '../events';
import { Resolver } from '../resolver';
import { SeriesBatch } from '../series';

const DIR = join(RAW, 'Disputed Territories and Wars, 1816-2001');
const f = (name: string) => join(DIR, name);
const VERSION = '2019-09-20';
/** Coverage ends here: claims still open are censored, not ended. */
const AS_OF = '2001-12-31';
const CENSORED = '200199';

type Ym = Stated & { raw?: string };

/** YYYYMM; month 00 is unknown and gives year precision. */
export function yyyymm(rep: Reporter, v: string): Ym | null {
  const m = v.trim().match(/^(\d{4})(\d{2})$/);
  if (!m) return null;
  const month = Number(m[2]);
  if (month > 12) return null;
  if (month > 0) return ymd(Number(m[1]), month);
  rep.sentinel('month 00 → year prec');
  return { ...ymd(Number(m[1]))!, raw: v };
}

/** -9 marks a claim still open in 2001: no resolution or violence code yet. */
function code(rep: Reporter, field: string, v: string) {
  if (v.trim() !== '-9') return num(v);
  rep.sentinel(`${field} -9 → null`);
  return null;
}

type Dyad = { row: Record<string, string>; start: Ym; end: Ym | null; ongoing: boolean; entities: EventEntityRow[] };

export async function importIcow(ctx: Ctx) {
  await importDataset(
    ctx,
    {
      source: 'icow',
      version: VERSION,
      asOf: AS_OF,
      files: ['territories.csv', 'years.csv', 'states.csv'].map(f),
      importerVersion: '1',
    },
    async ds => {
      const r = new Resolver(ctx);
      const rep = ds.report;

      const known = ctx.catalog.prepare(`
        SELECT 1 FROM core_entity_identifier i JOIN core_id_scheme s USING (scheme_id) WHERE s.code = 'cow' AND i.value = ? LIMIT 1
      `).pluck();
      const added: string[] = [];
      const states = await readCsv(f('states.csv'));
      ctx.catalog.transaction(() => {
        for (const s of states) {
          rep.rows++;
          if (known.get(s.state_code)) continue;
          const id = r.byName(s.state_name, Date.now(), { politiesOnly: true });
          if (id === undefined) rep.miss(`cow:${s.state_code} ${s.state_name}`);
          else {
            r.remember('cow', s.state_code, id, ds.sourceId);
            added.push(`${s.state_code} ${s.state_name}`);
          }
        }
      })();
      rep.extra.cow_identifiers_added = added;

      const claims = new Map<string, Dyad[]>();
      for (const row of await readCsv(f('territories.csv'))) {
        rep.rows++;
        const start = yyyymm(rep, row.start_claim);
        if (!start) {
          rep.reject('bad start_claim', `${row.claimstates_id} ${row.start_claim}`);
          continue;
        }
        const ongoing = row.end_claim.trim() === CENSORED;
        const end = ongoing ? null : yyyymm(rep, row.end_claim);
        if (ongoing) rep.sentinel(`end_claim ${CENSORED} → ongoing`);
        else if (!end) rep.reject('bad end_claim (kept as an instant)', `${row.claimstates_id} ${row.end_claim}`);

        const entities: EventEntityRow[] = [];
        for (const [state, side] of [[row.state1, 1], [row.state2, 2]] as const) {
          const id = r.resolve('cow', state, start.t);
          if (id === undefined) rep.miss(`cow:${state}`);
          else entities.push({ entityId: id, role: 'claimant', side });
        }
        const list = claims.get(row.claim_id) ?? [];
        list.push({ row, start, end, ongoing, entities });
        claims.set(row.claim_id, list);
      }

      const point = (entities: EventEntityRow[]) => {
        const p = r.midpoint(entities.map(e => e.entityId));
        return p ? { lon: p.lon, lat: p.lat, geoPrec: GeoPrec.approximate } : { lon: null, lat: null, geoPrec: GeoPrec.none };
      };
      const ongoingAttrs = (start: Ym, end: Ym | null, ongoing: boolean) => {
        const raw = { ...(start.raw ? { start: start.raw } : {}), ...(ongoing ? { end: CENSORED } : end?.raw ? { end: end.raw } : {}) };
        return { ...(ongoing ? { censored_at: '2001-12' } : {}), ...(Object.keys(raw).length ? { t_raw: raw } : {}) };
      };
      const lo = (s: Stated) => expand(s.t, s.prec).lo;
      const hi = (s: Stated) => expand(s.t, s.prec).hi;

      const batch = new EventBatch(ctx, ds);
      const children: Omit<EventInput, 'sourceId' | 'datasetId'>[] = [];
      for (const [claimId, dyads] of claims) {
        const names = new Map<string, number>();
        for (const d of dyads) names.set(d.row.name, (names.get(d.row.name) ?? 0) + 1);
        // Ties go to the first dyad's name: Map keeps insertion order and sort is stable.
        const title = [...names].sort((a, b) => b[1] - a[1])[0][0];

        const start = dyads.map(d => d.start).reduce((a, b) => (lo(b) < lo(a) ? b : a));
        const ongoing = dyads.some(d => d.ongoing);
        const end = ongoing ? null : dyads.map(d => d.end ?? d.start).reduce((a, b) => (hi(b) > hi(a) ? b : a));
        const claimants = new Map<number, EventEntityRow>();
        for (const d of dyads) for (const e of d.entities) claimants.set(e.entityId, { entityId: e.entityId, role: 'claimant' });

        batch.add({
          kind: 'claim.territorial',
          sourceRecordId: `claim:${claimId}`,
          title: text(title),
          tStart: start.t,
          tStartPrec: start.prec,
          tEnd: end?.t ?? null,
          tEndPrec: end?.prec ?? null,
          ongoing,
          ...point([...claimants.values()]),
          attrs: { names: [...names.keys()], dyads: dyads.length, region: num(dyads[0].row.region), ...ongoingAttrs(start, end, ongoing) },
          entities: [...claimants.values()],
        });

        for (const { row, start, end, ongoing: open, entities } of dyads) {
          children.push({
            kind: 'claim.territorial',
            sourceRecordId: `dyad:${row.claimstates_id}`,
            parentRecordId: `claim:${claimId}`,
            title: text(row.name),
            tStart: start.t,
            tStartPrec: start.prec,
            tEnd: end?.t ?? null,
            tEndPrec: end?.prec ?? null,
            ongoing: open,
            ...point(entities),
            attrs: {
              region: num(row.region),
              claim_resolution: code(rep, 'claim_resolution', row.claim_resolution),
              claim_violence: code(rep, 'claim_violence', row.claim_violence),
              significance: num(row.significance),
              significance_index: num(row.significance_index),
              significance_state1: num(row.significance_state1),
              significance_state2: num(row.significance_state2),
              tangible_significance: num(row.tangible_significance),
              intangible_significance: num(row.intangible_significance),
              intangible_significance_state1: num(row.intangible_significance_state1),
              intangible_significance_state2: num(row.intangible_significance_state2),
              militarized_disputes: num(row.militarized_disputes),
              fatal_militarized_disputes: num(row.fatal_militarized_disputes),
              interstate_wars: num(row.interstate_wars),
              ...ongoingAttrs(start, end, open),
            },
            entities,
          });
        }
      }
      // The store looks parents up by source_record_id, so they must be written first.
      batch.flush();
      for (const c of children) batch.add(c);
      const events = batch.finish();

      const dyadEvent = new Map<string, number>();
      for (const c of children) {
        const id = ctx.events.eventId(ds.sourceId, c.sourceRecordId);
        if (id !== undefined) dyadEvent.set(c.sourceRecordId, id);
      }
      const series = new SeriesBatch(ctx, ds);
      const metric = (code: string, name: string, column: string, max: number) =>
        series.metric({ code, name, unit: `index 0–${max}`, granularity: 'year', agg: 'mean', topic: 'territorial', attrs: { source_column: column } });
      const salience = metric('icow:salience', 'ICOW claim salience', 'significance', 12);
      const salience1 = metric('icow:salience_s1', 'ICOW claim salience to state 1', 'significance_state1', 6);
      const salience2 = metric('icow:salience_s2', 'ICOW claim salience to state 2', 'significance_state2', 6);
      for (const y of await readCsv(f('years.csv'))) {
        rep.rows++;
        const ev = dyadEvent.get(`dyad:${y.claimstates_id}`);
        const year = num(y.year);
        if (ev === undefined || year === null) {
          rep.reject('dyad-year without a dyad event', `${y.claimstates_id} ${y.year}`);
          continue;
        }
        const t = utc(year);
        series.add(salience, 'event', ev, { t, v: num(y.significance), prec: Prec.year });
        series.add(salience1, 'event', ev, { t, v: num(y.significance_state1), prec: Prec.year });
        series.add(salience2, 'event', ev, { t, v: num(y.significance_state2), prec: Prec.year });
      }
      rep.extra.skipped = 'years.csv typed columns: x_icow.claim_year does not exist yet';
      return mergePublish(events, series.finish());
    },
  );
}
